#!/usr/bin/env python3
"""Build a country-organized index of 16th-century composers with online scores.

Scope: IMSLP composer categories with one or more composition pages whose
documented lifetime or active period intersects 1501–1600. Medieval,
Renaissance and Baroque era categories are scanned because IMSLP classifies
several transitional composers outside the Renaissance category.
"""

from __future__ import annotations

import json
import re
import shutil
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / "frontend" / "public" / "classical" / "catalog"
COUNTRIES_ROOT = OUTPUT_ROOT / "countries"
INDEX_PATH = OUTPUT_ROOT / "renaissance-composers.json"
API = "https://imslp.org/api.php"
USER_AGENT = "MySpotifyRenaissanceAtlas/1.0 (local development project)"
ERA_CATEGORIES = (
    "People from the Medieval era",
    "People from the Renaissance era",
    "People from the Baroque era",
)

COUNTRY_NAMES = {
    "American": "США",
    "Austrian": "Австрия",
    "Belgian": "Бельгия",
    "Bosnian": "Босния и Герцеговина",
    "Bohemian": "Богемия",
    "British": "Великобритания",
    "Bulgarian": "Болгария",
    "Catalan": "Каталония",
    "Croatian": "Хорватия",
    "Czech": "Чешские земли",
    "Danish": "Дания",
    "Dutch": "Нидерланды",
    "Ecuadorian": "Эквадор",
    "English": "Англия",
    "Flemish": "Фландрия",
    "Franco-Flemish": "Франко-фламандская школа",
    "French": "Франция",
    "German": "Германские земли",
    "Greek": "Греция",
    "Guatemalan": "Гватемала",
    "Hungarian": "Венгрия",
    "Italian": "Италия",
    "Irish": "Ирландия",
    "Mexican": "Мексика",
    "Netherlandish": "Нидерланды",
    "Polish": "Польша",
    "Portuguese": "Португалия",
    "Scottish": "Шотландия",
    "Slovenian": "Словения",
    "Spanish": "Испания",
    "Swedish": "Швеция",
    "Swiss": "Швейцария",
    "Turkish": "Османская империя",
    "Welsh": "Уэльс",
    "Unknown": "Страна не установлена",
}

COUNTRY_SLUGS = {
    "Австрия": "austria",
    "Англия": "england",
    "Бельгия": "belgium",
    "Богемия": "bohemia",
    "Болгария": "bulgaria",
    "Босния и Герцеговина": "bosnia-and-herzegovina",
    "Великобритания": "great-britain",
    "Венгрия": "hungary",
    "Гватемала": "guatemala",
    "Германские земли": "german-lands",
    "Греция": "greece",
    "Дания": "denmark",
    "Ирландия": "ireland",
    "Испания": "spain",
    "Италия": "italy",
    "Каталония": "catalonia",
    "Мексика": "mexico",
    "Нидерланды": "netherlands",
    "Османская империя": "ottoman-empire",
    "Польша": "poland",
    "Португалия": "portugal",
    "Словения": "slovenia",
    "США": "usa",
    "Страна не установлена": "undetermined",
    "Уэльс": "wales",
    "Фландрия": "flanders",
    "Франко-фламандская школа": "franco-flemish-school",
    "Франция": "france",
    "Хорватия": "croatia",
    "Чешские земли": "czech-lands",
    "Швейцария": "switzerland",
    "Швеция": "sweden",
    "Шотландия": "scotland",
    "Эквадор": "ecuador",
}


def api_request(params: dict[str, str]) -> dict:
    request = urllib.request.Request(
        API,
        data=urllib.parse.urlencode(params).encode("utf-8"),
        headers={"User-Agent": USER_AGENT},
    )
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.load(response)
        except Exception:
            if attempt == 5:
                raise
            time.sleep(2**attempt)
    raise RuntimeError("unreachable")


def category_members(category: str) -> list[str]:
    members: list[str] = []
    continuation: str | None = None
    while True:
        params = {
            "action": "query",
            "format": "json",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmnamespace": "14",
            "cmlimit": "500",
        }
        if continuation:
            params["cmcontinue"] = continuation
        payload = api_request(params)
        members.extend(row["title"] for row in payload.get("query", {}).get("categorymembers", []))
        continuation = (
            payload.get("continue", {}).get("cmcontinue")
            or payload.get("query-continue", {}).get("categorymembers", {}).get("cmcontinue")
        )
        if not continuation:
            return members
        time.sleep(0.35)


def chunks(values: list[str], size: int) -> list[list[str]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def field(raw: str, *names: str) -> str:
    for name in names:
        match = re.search(rf"\|\s*{re.escape(name)}\s*=\s*([^\n|}}]+)", raw, flags=re.IGNORECASE)
        if match:
            return clean_markup(match.group(1))
    return ""


def field_line(raw: str, *names: str) -> str:
    """Return a complete template field line, including nested template values."""
    for name in names:
        match = re.search(
            rf"\|\s*{re.escape(name)}\s*=\s*(.*?)(?=\n|\|\s*[A-Za-z][^|=\n]*=|$)",
            raw,
            flags=re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()
    return ""


def date_field(raw: str, *names: str) -> str:
    value = field_line(raw, *names)
    if not value:
        return ""
    value = re.sub(
        r"{{\s*fl\s*\|([^{}]+)}}",
        lambda match: "fl. " + "–".join(
            part.strip() for part in match.group(1).split("|")
            if part.strip().lower() not in {"white", "black", "gray", "grey"}
        ),
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(
        r"{{\s*(?:ca|circa)\s*\|([^{}]+)}}",
        lambda match: "ca. " + "–".join(part.strip() for part in match.group(1).split("|") if part.strip()),
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"{{[^{}|]+\|([^{}]+)}}", lambda match: match.group(1).replace("|", " "), value)
    return clean_markup(value)


def clean_markup(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value)
    value = re.sub(r"\[\[(?:[^]|]+\|)?([^]]+)]]", r"\1", value)
    value = re.sub(r"{{[^{}]*}}", "", value)
    value = value.replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", value).strip()


def year_from(value: str) -> int | None:
    years = [int(item) for item in re.findall(r"(?<!\d)(1[3-7]\d{2})(?!\d)", value)]
    return years[0] if years else None


def intersects_sixteenth_century(raw: str, era_categories: set[str]) -> bool:
    birth_text = " ".join(filter(None, (field_line(raw, "Birth Date"), field_line(raw, "Born Year"))))
    death_text = " ".join(filter(None, (field_line(raw, "Death Date"), field_line(raw, "Died Year"))))
    active_text = field_line(raw, "Flourished", "Active")
    born = year_from(birth_text)
    died = year_from(death_text)
    birth_is_floruit = bool(re.search(r"(?:{{\s*fl\b|\bfl\.)", birth_text, flags=re.IGNORECASE))
    death_is_floruit = bool(re.search(r"(?:{{\s*fl\b|\bfl\.)", death_text, flags=re.IGNORECASE))
    floruit_text = " ".join(text for text, is_floruit in ((birth_text, birth_is_floruit), (death_text, death_is_floruit)) if is_floruit)
    if birth_is_floruit:
        born = None
    if death_is_floruit:
        died = None
    active_years = [int(item) for item in re.findall(r"(?<!\d)(1[3-7]\d{2})(?!\d)", f"{active_text} {floruit_text}")]
    period = field(raw, "Time Period")

    if born is not None and died is not None:
        return born <= 1600 and died >= 1501
    if born is not None:
        return 1400 <= born <= 1600
    if died is not None:
        return 1501 <= died <= 1625
    if active_years:
        return any(1501 <= year <= 1600 for year in active_years)
    if re.search(r"\b(?:17|18)th\s+century\b", f"{birth_text} {death_text} {active_text}", flags=re.IGNORECASE):
        return False
    return period == "Renaissance" and "Category:People from the Renaissance era" in era_categories


def display_name(category_title: str) -> str:
    name = category_title.removeprefix("Category:")
    if ", " in name:
        surname, given = name.split(", ", 1)
        return f"{given} {surname}"
    return name


def country_for(raw: str, categories: set[str]) -> tuple[str, str]:
    nationality = field(raw, "Nationality")
    nationality = re.sub(r"\s*\([^)]*\)\s*", "", nationality).strip()
    if not nationality:
        people = sorted(
            item.removeprefix("Category:").removesuffix(" people")
            for item in categories
            if item.endswith(" people") and not item.startswith(("Category:Male", "Category:Female"))
        )
        nationality = people[0] if people else "Unknown"
    key = next((candidate for candidate in sorted(COUNTRY_NAMES, key=len, reverse=True) if candidate.lower() in nationality.lower()), nationality)
    return COUNTRY_NAMES.get(key, key or "Не определено"), nationality or "Unknown"


def slugify(value: str) -> str:
    if value in COUNTRY_SLUGS:
        return COUNTRY_SLUGS[value]
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return slug or "unknown"


def composer_records(titles: list[str]) -> list[dict]:
    records: list[dict] = []
    title_batches = chunks(sorted(titles), 50)
    for batch_number, batch in enumerate(title_batches, start=1):
        payload = api_request({
            "action": "query",
            "format": "json",
            "titles": "|".join(batch),
            "prop": "revisions|categories|categoryinfo",
            "rvprop": "content",
            "cllimit": "500",
        })
        for page in payload.get("query", {}).get("pages", {}).values():
            categories = {item["title"] for item in page.get("categories", [])}
            work_count = page.get("categoryinfo", {}).get("pages", 0)
            if "Category:Composers" not in categories or work_count < 1 or page["title"] == "Category:Anonymous":
                continue
            raw = page.get("revisions", [{}])[0].get("*", "")
            if not intersects_sixteenth_century(raw, categories):
                continue
            country, nationality = country_for(raw, categories)
            category_name = page["title"].removeprefix("Category:")
            records.append({
                "id": slugify(category_name),
                "name": display_name(page["title"]),
                "imslpName": category_name,
                "country": country,
                "countrySlug": slugify(country),
                "nationality": nationality,
                "born": date_field(raw, "Birth Date", "Born Year") or None,
                "died": date_field(raw, "Death Date", "Died Year") or None,
                "period": field(raw, "Time Period") or "Renaissance",
                "workCount": work_count,
                "scoresUrl": "https://imslp.org/wiki/Category:" + urllib.parse.quote(category_name.replace(" ", "_"), safe="_,'-"),
            })
        print(f"metadata batch {batch_number}/{len(title_batches)}", flush=True)
        time.sleep(0.15)
    return sorted(records, key=lambda item: (item["country"], item["name"]))


def write_outputs(records: list[dict]) -> None:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        grouped[record["country"]].append(record)

    if COUNTRIES_ROOT.exists():
        shutil.rmtree(COUNTRIES_ROOT)
    COUNTRIES_ROOT.mkdir(parents=True, exist_ok=True)

    countries = []
    for country, composers in sorted(grouped.items()):
        slug = composers[0]["countrySlug"]
        folder = COUNTRIES_ROOT / slug
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "composers.json").write_text(
            json.dumps({"country": country, "composers": composers}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        lines = [f"# {country}", "", f"Композиторов с открытыми страницами нот: {len(composers)}.", ""]
        lines.extend(f"- [{item['name']}]({item['scoresUrl']}) — {item['workCount']} стр. нот" for item in composers)
        (folder / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        countries.append({
            "name": country,
            "slug": slug,
            "composerCount": len(composers),
            "workPageCount": sum(item["workCount"] for item in composers),
            "composers": composers,
        })

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(
        json.dumps({
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "source": "IMSLP MediaWiki API",
            "sourceUrl": "https://imslp.org/",
            "definition": "Composer categories with at least one online composition page and a documented lifetime or active period intersecting 1501–1600.",
            "composerCount": len(records),
            "countryCount": len(countries),
            "workPageCount": sum(item["workCount"] for item in records),
            "countries": countries,
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    titles: set[str] = set()
    for category in ERA_CATEGORIES:
        members = category_members(category)
        titles.update(members)
        print(f"{category}: {len(members)} people", flush=True)
    records = composer_records(list(titles))
    write_outputs(records)
    print(f"wrote {len(records)} composers in {len({item['country'] for item in records})} country folders", flush=True)


if __name__ == "__main__":
    main()

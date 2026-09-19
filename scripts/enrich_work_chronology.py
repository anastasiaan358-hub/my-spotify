#!/usr/bin/env python3
"""Attach chronology metadata from IMSLP work pages to the local catalogue.

Composition dates are preferred. When they are absent, an original publication
date no later than 1700 is used as a documented terminus for ordering. Modern
edition dates are deliberately ignored.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import tempfile
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "frontend/public/classical/catalog/imslp-works.json"
CACHE_PATH = ROOT / "reports/imslp-work-chronology-cache.json"
REPORT_PATH = ROOT / "reports/work-chronology-audit.json"
MEDIAWIKI_API = "https://imslp.org/api.php"
USER_AGENT = "MySpotifyChronologyAudit/1.0 (local development project)"
FIELDS = {
    "composition": re.compile(r"^\|[ \t]*Year/Date of Composition[ \t]*=[ \t]*([^\r\n]*)", re.I | re.M),
    "publication": re.compile(r"^\|[ \t]*Year of First Publication[ \t]*=[ \t]*([^\r\n]*)", re.I | re.M),
}
YEAR = re.compile(r"(?<!\d)(1[3-6]\d{2}|1700)(?!\d)")


def title_from_url(url: str) -> str:
    return urllib.parse.unquote(url.rsplit("/wiki/", 1)[-1]).replace("_", " ")


def clean_wiki_value(value: str) -> str:
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(r"<br\s*/?>", "; ", value, flags=re.I)
    value = re.sub(r"<ref.*?</ref>|<ref[^>]*/>", "", value, flags=re.I | re.S)
    value = re.sub(r"\{\{(?:LinkYear|ca|circa)\|([^{}|]+)(?:\|[^{}]*)?\}\}", r"\1", value, flags=re.I)
    value = re.sub(r"\{\{[^{}]*\}\}", "", value)
    value = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", value)
    value = re.sub(r"'{2,}", "", value)
    return " ".join(html.unescape(value).split()).strip(" ;")


def chronology_from_wikitext(wikitext: str) -> dict[str, object] | None:
    values = {
        name: clean_wiki_value(match.group(1)) if (match := pattern.search(wikitext)) else ""
        for name, pattern in FIELDS.items()
    }
    for source in ("composition", "publication"):
        value = values[source]
        years = [int(item) for item in YEAR.findall(value)]
        if not years:
            continue
        year = min(years)
        return {
            "dateSort": year,
            "dateLabel": value if source == "composition" else f"{value} · первая публикация",
            "dateSource": source,
        }
    return None


def fetch_wikitext(titles: list[str], retries: int = 5) -> dict[str, str]:
    data = urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "prop": "revisions",
            "rvprop": "content",
            "titles": "|".join(titles),
        }
    ).encode()
    request = urllib.request.Request(MEDIAWIKI_API, data=data, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.load(response)
            return {
                page.get("title", ""): page.get("revisions", [{}])[0].get("*", "")
                for page in payload.get("query", {}).get("pages", {}).values()
                if page.get("revisions")
            }
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("unreachable")


def atomic_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--batch-size", type=int, default=40)
    args = parser.parse_args()

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    works = [work for artist in catalog["artists"].values() for work in artist["works"]]
    work_by_title: dict[str, list[dict[str, object]]] = {}
    for work in works:
        work_by_title.setdefault(title_from_url(str(work["imslpUrl"])), []).append(work)

    cache: dict[str, dict[str, object] | None] = {}
    if CACHE_PATH.is_file() and not args.refresh:
        cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))

    pending = [title for title in work_by_title if title not in cache]
    batches = [pending[index : index + args.batch_size] for index in range(0, len(pending), args.batch_size)]
    for index, batch in enumerate(batches, start=1):
        pages = fetch_wikitext(batch)
        for title in batch:
            cache[title] = chronology_from_wikitext(pages.get(title, ""))
        if index % 10 == 0 or index == len(batches):
            atomic_json(CACHE_PATH, cache)
            print(f"chronology {index}/{len(batches)} batches; cached={len(cache)}", flush=True)
        time.sleep(0.08)

    for title, matching_works in work_by_title.items():
        chronology = cache.get(title)
        for work in matching_works:
            for key in ("dateSort", "dateLabel", "dateSource"):
                work.pop(key, None)
            if chronology:
                work.update(chronology)

    per_artist: dict[str, dict[str, int]] = {}
    for artist_id, artist in catalog["artists"].items():
        artist_works = artist["works"]
        dated = sum("dateSort" in work for work in artist_works)
        composition = sum(work.get("dateSource") == "composition" for work in artist_works)
        publication = sum(work.get("dateSource") == "publication" for work in artist_works)
        artist["chronology"] = {
            "datedCount": dated,
            "undatedCount": len(artist_works) - dated,
            "compositionDateCount": composition,
            "firstPublicationCount": publication,
        }
        per_artist[artist_id] = artist["chronology"]

    unique_dated = sum(cache.get(title) is not None for title in work_by_title)
    sources = Counter(
        str(item["dateSource"])
        for item in cache.values()
        if item is not None
    )
    report = {
        "method": "IMSLP Year/Date of Composition; historical Year of First Publication fallback through 1700",
        "uniqueWorks": len(work_by_title),
        "datedUniqueWorks": unique_dated,
        "undatedUniqueWorks": len(work_by_title) - unique_dated,
        "compositionDates": sources["composition"],
        "firstPublicationFallbacks": sources["publication"],
        "catalogEntries": len(works),
        "perArtist": per_artist,
    }
    catalog["chronology"] = report
    atomic_json(CATALOG_PATH, catalog)
    atomic_json(REPORT_PATH, report)
    print(json.dumps(report | {"perArtist": "see report"}, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()

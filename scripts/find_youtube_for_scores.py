#!/usr/bin/env python3
"""Find one relevant YouTube video for every work in the public catalogue.

The script uses YouTube's public web search, saves progress after every request,
and creates Markdown/CSV reports that separate matches from missing works.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import json
import re
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "frontend/public/classical/catalog/imslp-works.json"
REPORT_DIR = ROOT / "reports"
CACHE_PATH = REPORT_DIR / "youtube-score-search.jsonl"
CSV_PATH = REPORT_DIR / "youtube-score-links.csv"
MARKDOWN_PATH = REPORT_DIR / "youtube-score-links.md"
FOUND_MARKDOWN_PATH = REPORT_DIR / "youtube-found-links.md"
MISSING_PATH = REPORT_DIR / "youtube-score-links-missing.csv"
MISSING_MARKDOWN_PATH = REPORT_DIR / "youtube-score-links-missing.md"

VIDEO_FILTER = "EgIQAQ=="
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
)
STOPWORDS = {
    "a",
    "al",
    "alla",
    "and",
    "book",
    "complete",
    "da",
    "de",
    "del",
    "della",
    "der",
    "di",
    "die",
    "du",
    "et",
    "from",
    "il",
    "in",
    "la",
    "le",
    "les",
    "liber",
    "libro",
    "no",
    "nr",
    "of",
    "op",
    "opus",
    "the",
    "vol",
    "volume",
}
CATALOGUE_SUFFIX = re.compile(
    r",?\s+(?:pdpwv|swv|wv|sv|fvb|vdgs|igg|mot|nje|mb|f)\s*[0-9]+(?:[.][0-9]+)*.*$",
    re.I,
)


@dataclass(frozen=True)
class Work:
    key: str
    composer: str
    category_name: str
    artist_id: str
    work_id: str
    title: str
    sheet_url: str


@dataclass
class SearchResult:
    key: str
    composer: str
    artist_id: str
    work_id: str
    title: str
    sheet_url: str
    query: str
    status: str
    youtube_url: str = ""
    youtube_title: str = ""
    channel: str = ""
    confidence: float = 0.0
    composer_verified: bool = False
    error: str = ""


def display_composer(category_name: str) -> str:
    if "," not in category_name:
        return category_name
    family, given = (part.strip() for part in category_name.split(",", 1))
    return f"{given} {family}"


def load_works() -> list[Work]:
    payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    works: list[Work] = []
    seen: set[str] = set()
    for artist_id, artist in payload["artists"].items():
        category_name = urllib.parse.unquote(
            artist["catalogUrl"].split("Category:", 1)[-1]
        ).replace("_", " ")
        composer = display_composer(category_name)
        for item in artist["works"]:
            key = f"{category_name}|{item['id']}"
            if key in seen:
                continue
            seen.add(key)
            works.append(
                Work(
                    key=key,
                    composer=composer,
                    category_name=category_name,
                    artist_id=artist_id,
                    work_id=str(item["id"]),
                    title=item["title"],
                    sheet_url=(
                        f"http://127.0.0.1:5175/scores/{artist_id}/{item['id']}"
                        if item.get("printUrl")
                        else ""
                    ),
                )
            )
    return sorted(works, key=lambda work: (work.composer.casefold(), work.title.casefold()))


def text_value(value: dict[str, Any] | None) -> str:
    if not value:
        return ""
    return "".join(run.get("text", "") for run in value.get("runs", [])) or value.get(
        "simpleText", ""
    )


def walk_video_renderers(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        renderer = value.get("videoRenderer")
        if renderer:
            yield renderer
        for child in value.values():
            yield from walk_video_renderers(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_video_renderers(child)


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.casefold())
    value = "".join(char for char in value if not unicodedata.combining(char))
    return " ".join(re.findall(r"[a-z0-9]+", value))


def meaningful_tokens(value: str) -> list[str]:
    return [
        token
        for token in normalize(value).split()
        if token not in STOPWORDS and (len(token) >= 3 or token.isdigit())
    ]


def core_title(value: str) -> str:
    return CATALOGUE_SUFFIX.sub("", value).strip(" ,") or value


COMPOSER_ALIASES = {
    "Lassus, Orlande de": {"lasso", "lassus"},
    "Josquin Desprez": {"josquin", "desprez", "despres"},
}
ORDINALS = {
    "decima",
    "decimo",
    "duodecima",
    "duodecimo",
    "eighth",
    "eleventh",
    "fifth",
    "first",
    "fourth",
    "ninth",
    "nona",
    "nono",
    "ottava",
    "ottavo",
    "prima",
    "primo",
    "quarto",
    "quinta",
    "quinto",
    "second",
    "seconda",
    "secondo",
    "seventh",
    "sixth",
    "tenth",
    "terza",
    "terzo",
    "third",
    "twelfth",
    "undecima",
    "undecimo",
}


def composer_identity_tokens(work: Work) -> set[str]:
    if "," in work.category_name:
        identity = work.category_name.split(",", 1)[0]
    else:
        identity = work.category_name
    tokens = {token for token in meaningful_tokens(identity) if len(token) >= 4}
    tokens.update(COMPOSER_ALIASES.get(work.category_name, set()))
    return tokens


def composer_matches(work: Work, haystack_tokens: set[str]) -> bool:
    identity_tokens = composer_identity_tokens(work)
    if not identity_tokens.intersection(haystack_tokens):
        return False
    if work.category_name.startswith("Gabrieli,"):
        given_name = normalize(work.category_name.split(",", 1)[1]).split()[0]
        return given_name in haystack_tokens
    return True


def catalogue_marks(value: str) -> set[tuple[str, str]]:
    normalized = normalize(value)
    return {
        (label, number)
        for label, number in re.findall(
            r"\b(pdpwv|swv|wv|sv|fvb|vdgs|igg|mot)\s*([0-9]+[a-z]?)\b",
            normalized,
        )
    }


def best_phrase_similarity(needle: str, candidate: str) -> float:
    needle_tokens = normalize(needle).split()
    candidate_tokens = normalize(candidate).split()
    if not needle_tokens or not candidate_tokens:
        return 0.0
    best = 0.0
    for size in range(max(1, len(needle_tokens) - 1), len(needle_tokens) + 3):
        for start in range(max(1, len(candidate_tokens) - size + 1)):
            window = " ".join(candidate_tokens[start : start + size])
            best = max(
                best,
                difflib.SequenceMatcher(None, " ".join(needle_tokens), window).ratio(),
            )
    return best


def match_details(work: Work, renderer: dict[str, Any]) -> tuple[float, bool]:
    video_title = text_value(renderer.get("title"))
    owner = text_value(renderer.get("ownerText"))
    description = text_value(renderer.get("descriptionSnippet"))
    haystack = normalize(f"{video_title} {owner} {description}")
    haystack_tokens = set(haystack.split())
    title_without_catalogue = core_title(work.title)
    title_norm = normalize(title_without_catalogue)
    video_title_tokens = set(normalize(video_title).split())
    work_tokens = meaningful_tokens(title_without_catalogue)
    if not work_tokens:
        return 0.0, False
    matched = sum(token in video_title_tokens for token in work_tokens)
    coverage = matched / len(work_tokens)
    composer_match = composer_matches(work, haystack_tokens)
    video_title_norm = normalize(video_title)
    exact_title = bool(title_norm and title_norm in video_title_norm)
    similarity = best_phrase_similarity(title_without_catalogue, video_title)
    work_numbers = set(re.findall(r"\d+", title_norm))
    candidate_numbers = set(re.findall(r"\d+", video_title_norm))
    numbers_match = not work_numbers or work_numbers.issubset(candidate_numbers)
    work_marks = catalogue_marks(work.title)
    candidate_marks = catalogue_marks(video_title)
    # A video title may legitimately omit the catalogue number. Reject only a
    # conflicting number that is actually present in the candidate title.
    marks_match = not work_marks or not candidate_marks or work_marks.issubset(candidate_marks)
    work_romans = {token.casefold() for token in re.findall(r"\b[IVXLCDM]{2,}\b", work.title)}
    candidate_romans = {token.casefold() for token in re.findall(r"\b[IVXLCDM]{2,}\b", video_title)}
    romans_match = not work_romans or work_romans.issubset(candidate_romans)
    work_ordinals = set(normalize(work.title).split()).intersection(ORDINALS)
    ordinals_match = not work_ordinals or work_ordinals.issubset(video_title_tokens)

    if len(work_tokens) == 1:
        relevant = exact_title and composer_match
    else:
        relevant = bool(
            composer_match
            and numbers_match
            and marks_match
            and romans_match
            and ordinals_match
            and (exact_title or coverage >= 0.8 or similarity >= 0.88)
        )

    score = coverage * 0.5 + similarity * 0.25 + (0.25 if composer_match else 0.0)
    if exact_title:
        score = max(score, 0.85 + (0.15 if composer_match else 0.0))
    return min(score, 1.0), relevant


def match_confidence(work: Work, renderer: dict[str, Any]) -> float:
    return match_details(work, renderer)[0]


class YouTubeSearch:
    def __init__(self) -> None:
        self.api_key, self.client_version = self._load_web_config()
        self.local = threading.local()

    @staticmethod
    def _request(url: str, data: bytes | None = None) -> bytes:
        request = urllib.request.Request(
            url,
            data=data,
            headers={
                "User-Agent": USER_AGENT,
                "Accept-Language": "en-US,en;q=0.9",
                "Content-Type": "application/json",
                "Origin": "https://www.youtube.com",
            },
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()

    def _load_web_config(self) -> tuple[str, str]:
        html = self._request("https://www.youtube.com").decode("utf-8", "replace")
        key_match = re.search(r'"INNERTUBE_API_KEY":"([^"]+)"', html)
        version_match = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', html)
        if not key_match or not version_match:
            raise RuntimeError("YouTube web search configuration was not found")
        return key_match.group(1), version_match.group(1)

    def search(self, work: Work) -> SearchResult:
        query = f"{work.composer} {core_title(work.title)}"
        body = json.dumps(
            {
                "context": {
                    "client": {
                        "clientName": "WEB",
                        "clientVersion": self.client_version,
                        "hl": "en",
                        "gl": "US",
                    }
                },
                "query": query,
                "params": VIDEO_FILTER,
            }
        ).encode("utf-8")
        endpoint = "https://www.youtube.com/youtubei/v1/search?key=" + urllib.parse.quote(
            self.api_key
        )

        last_error = ""
        for attempt in range(4):
            try:
                payload = json.loads(self._request(endpoint, body))
                candidates: list[tuple[float, bool, dict[str, Any]]] = []
                seen: set[str] = set()
                for renderer in walk_video_renderers(payload):
                    video_id = renderer.get("videoId")
                    if not video_id or video_id in seen:
                        continue
                    seen.add(video_id)
                    confidence, relevant = match_details(work, renderer)
                    candidates.append((confidence, relevant, renderer))
                candidates.sort(key=lambda pair: (pair[1], pair[0]), reverse=True)
                if candidates and candidates[0][1]:
                    confidence, _, renderer = candidates[0]
                    return SearchResult(
                        key=work.key,
                        composer=work.composer,
                        artist_id=work.artist_id,
                        work_id=work.work_id,
                        title=work.title,
                        sheet_url=work.sheet_url,
                        query=query,
                        status="found",
                        youtube_url=("https://www.youtube.com/watch?v=" + renderer["videoId"]),
                        youtube_title=text_value(renderer.get("title")),
                        channel=text_value(renderer.get("ownerText")),
                        confidence=round(confidence, 3),
                        composer_verified=True,
                    )
                return SearchResult(
                    key=work.key,
                    composer=work.composer,
                    artist_id=work.artist_id,
                    work_id=work.work_id,
                    title=work.title,
                    sheet_url=work.sheet_url,
                    query=query,
                    status="missing",
                    confidence=round(candidates[0][0], 3) if candidates else 0.0,
                )
            except (
                urllib.error.URLError,
                TimeoutError,
                OSError,
                json.JSONDecodeError,
            ) as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                time.sleep(1.5 * (attempt + 1))

        return SearchResult(
            key=work.key,
            composer=work.composer,
            artist_id=work.artist_id,
            work_id=work.work_id,
            title=work.title,
            sheet_url=work.sheet_url,
            query=query,
            status="error",
            error=last_error,
        )


def load_cache() -> dict[str, SearchResult]:
    cache: dict[str, SearchResult] = {}
    if not CACHE_PATH.exists():
        return cache
    for line in CACHE_PATH.read_text(encoding="utf-8").splitlines():
        if line.strip():
            item = SearchResult(**json.loads(line))
            cache[item.key] = item
    return cache


def append_cache(item: SearchResult, lock: threading.Lock) -> None:
    with lock, CACHE_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(asdict(item), ensure_ascii=False) + "\n")


def write_reports(results: list[SearchResult]) -> None:
    fields = list(SearchResult.__dataclass_fields__)
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(asdict(item) for item in results)

    missing = [item for item in results if item.status != "found"]
    with MISSING_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(asdict(item) for item in missing)

    found_count = sum(item.status == "found" for item in results)
    lines = [
        "# YouTube-ссылки для произведений каталога",
        "",
        f"Проверено произведений: **{len(results)}**. Найдено: **{found_count}**. "
        f"Не найдено: **{len(results) - found_count}**.",
        "",
        "При наличии ссылка SHEET ведёт на внутренний просмотр партитуры. Для YouTube указан "
        "наиболее точный найденный результат по композитору и названию.",
        "",
    ]
    current_composer = ""
    for item in results:
        if item.composer != current_composer:
            current_composer = item.composer
            lines.extend([f"## {current_composer}", ""])
        sheet = f"[SHEET]({item.sheet_url})" if item.sheet_url else "SHEET отсутствует"
        if item.status == "found":
            youtube = f"[YouTube]({item.youtube_url})"
            details = f" — {item.youtube_title}"
            if item.channel:
                details += f" / {item.channel}"
            lines.append(f"- **{item.title}** — {sheet} · {youtube}{details}")
        elif item.status == "error":
            lines.append(f"- **{item.title}** — {sheet} · ошибка проверки YouTube")
        else:
            lines.append(f"- **{item.title}** — {sheet} · **YouTube не найден**")
    MARKDOWN_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    found_lines = [
        "# Найденные онлайн-записи",
        "",
        f"Подтверждено записей: **{found_count}**.",
        "",
    ]
    current_composer = ""
    for item in (item for item in results if item.status == "found"):
        if item.composer != current_composer:
            current_composer = item.composer
            found_lines.extend([f"## {current_composer}", ""])
        found_lines.append(
            f"- **{item.title}** — [YouTube]({item.youtube_url})"
            + (f" · [SHEET]({item.sheet_url})" if item.sheet_url else "")
        )
    FOUND_MARKDOWN_PATH.write_text("\n".join(found_lines) + "\n", encoding="utf-8")

    missing_lines = [
        "# Произведения без найденного видео на YouTube",
        "",
        f"Не найдено подходящее видео: **{len(missing)}** из **{len(results)}** произведений.",
        "",
    ]
    current_composer = ""
    for item in missing:
        if item.composer != current_composer:
            current_composer = item.composer
            missing_lines.extend([f"## {current_composer}", ""])
        missing_lines.append(
            f"- **{item.title}**"
            + (f" — [SHEET]({item.sheet_url})" if item.sheet_url else "")
        )
    MISSING_MARKDOWN_PATH.write_text("\n".join(missing_lines) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--artist", help="Only process one internal artist id")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--recheck-found", action="store_true")
    parser.add_argument("--recheck-missing", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    works = load_works()
    if args.artist:
        works = [work for work in works if work.artist_id == args.artist]
    if args.limit:
        works = works[: args.limit]
    cache = {} if args.refresh else load_cache()
    pending = [
        work
        for work in works
        if (
            work.key not in cache
            or cache[work.key].status == "error"
            or (args.recheck_found and cache[work.key].status == "found")
            or (args.recheck_missing and cache[work.key].status == "missing")
        )
    ]
    print(
        f"works={len(works)} cached={len(works) - len(pending)} pending={len(pending)}",
        flush=True,
    )

    if pending:
        search = YouTubeSearch()
        cache_lock = threading.Lock()
        completed = 0
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = {executor.submit(search.search, work): work for work in pending}
            for future in as_completed(futures):
                item = future.result()
                cache[item.key] = item
                append_cache(item, cache_lock)
                completed += 1
                if completed % 25 == 0 or completed == len(pending):
                    processed = [cache[work.key] for work in works if work.key in cache]
                    found = sum(item.status == "found" for item in processed)
                    missing = sum(item.status == "missing" for item in processed)
                    errors = sum(item.status == "error" for item in processed)
                    print(
                        f"progress={completed}/{len(pending)} found={found} "
                        f"missing={missing} errors={errors}",
                        flush=True,
                    )

    results = [cache[work.key] for work in works if work.key in cache]
    write_reports(results)
    print(f"markdown={MARKDOWN_PATH}", flush=True)
    print(f"found_markdown={FOUND_MARKDOWN_PATH}", flush=True)
    print(f"csv={CSV_PATH}", flush=True)
    print(f"missing_csv={MISSING_PATH}", flush=True)
    print(f"missing_markdown={MISSING_MARKDOWN_PATH}", flush=True)


if __name__ == "__main__":
    main()

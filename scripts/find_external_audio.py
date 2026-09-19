#!/usr/bin/env python3
"""Find exact, freely streamable recordings outside YouTube.

The search is intentionally conservative: the composer must be present in the
file or item metadata and an individual audio file must match the work title.
Progress is cached per unique IMSLP work so a full run can be resumed.
"""

from __future__ import annotations

import argparse
import difflib
import html
import json
import re
import tempfile
import threading
import time
import unicodedata
import urllib.parse
import xml.etree.ElementTree as ET
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "frontend/public/classical/catalog/imslp-works.json"
PLAYBACK_REPORT_PATH = ROOT / "reports/playback-catalog-audit.json"
CACHE_PATH = ROOT / "reports/external-audio-search-cache.json"
COMMONS_INDEX_PATH = ROOT / "reports/commons-audio-index.json"
MUTOPIA_INDEX_PATH = ROOT / "reports/mutopia-audio-index.json"
MUSOPEN_INDEX_PATH = ROOT / "reports/musopen-audio-index.json"
OPENVERSE_INDEX_PATH = ROOT / "reports/openverse-audio-index.json"
GALLICA_INDEX_PATH = ROOT / "reports/gallica-audio-index.json"
MANIFEST_PATH = ROOT / "frontend/public/classical/catalog/external-audio.json"
REPORT_PATH = ROOT / "reports/external-audio-search.md"
EXTERNAL_AUDIO_DIR = ROOT / "frontend/public/classical/audio/external"
INTERNET_ARCHIVE_SEARCH = "https://archive.org/advancedsearch.php"
INTERNET_ARCHIVE_METADATA = "https://archive.org/metadata/{identifier}"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
MUTOPIA_LISTING = "https://www.mutopiaproject.org/cgibin/make-table.cgi"
MUSOPEN_API = "https://api.musopen.org/v2"
OPENVERSE_API = "https://api.openverse.org/v1/audio/"
BNF_SRU_API = "https://catalogue.bnf.fr/api/SRU"
USER_AGENT = "MySpotifyExternalAudioDiscovery/1.0 (local research catalogue)"
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
)
thread_local = threading.local()
metadata_cache: dict[str, dict[str, Any]] = {}
metadata_lock = threading.Lock()
commons_index: dict[str, list[dict[str, Any]]] = {}
mutopia_index: dict[str, list[dict[str, Any]]] = {}
musopen_index: dict[str, list[dict[str, Any]]] = {}
openverse_index: dict[str, list[dict[str, Any]]] = {}
gallica_index: dict[str, list[dict[str, Any]]] = {}
musopen_recording_cache: dict[int, list[dict[str, Any]]] = {}
musopen_recording_lock = threading.Lock()

MUTOPIA_COMPOSERS = {
    "Allegri, Gregorio": "AllegriG",
    "Arbeau, Thoinot": "ArbeauT",
    "Dowland, John": "DowlandJ",
    "Galilei, Vincenzo": "GalileiV",
    "Gastoldi, Giovanni Giacomo": "GastoldiG",
    "Gesualdo, Carlo": "GesualdoC",
    "Gibbons, Orlando": "GibbonsO",
    "Janequin, Clément": "JanequinC",
    "Japart, Jean": "JapartJ",
    "Josquin Desprez": "PresJd",
    "Lassus, Orlande de": "LassusOd",
    "Marenzio, Luca": "MarenzioL",
    "Milán, Luis": "MilanL",
    "Monte, Philippe de": "MontePd",
    "Monteverdi, Claudio": "MonteverdiC",
    "Morley, Thomas": "MorleyT",
    "Scheidemann, Heinrich": "ScheidemannH",
    "Tallis, Thomas": "TallisT",
    "Victoria, Tomás Luis de": "VictoriaTLd",
}

STOPWORDS = {
    "a", "alla", "and", "book", "da", "de", "del", "della", "der", "di",
    "die", "du", "et", "from", "il", "in", "la", "le", "liber", "libro",
    "no", "nr", "of", "op", "opus", "the", "vol", "volume",
}
ANNOTATION_WORDS = {
    "anthem", "canzionetta", "chant", "choir", "chorus", "complete", "disc",
    "excerpt", "fantasia", "live", "madrigal", "motet", "recording", "sacra",
    "song", "track", "voices",
}
CATALOGUE_MARK = re.compile(
    r",?\s+(?:pdpwv|swv|wv|sv|fvb|vdgs|igg|mot|nje|mb|f)\s*[0-9]+(?:[.][0-9]+)*.*$",
    re.I,
)
SUPPORTED_SUFFIXES = (".mp3", ".ogg", ".opus", ".flac", ".m4a")


def atomic_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def atomic_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("wb", dir=path.parent, delete=False) as handle:
        handle.write(payload)
        temporary = Path(handle.name)
    temporary.replace(path)


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", html.unescape(value).casefold())
    value = "".join(character for character in value if not unicodedata.combining(character))
    return " ".join(re.findall(r"[a-z0-9]+", value))


def strip_html(value: object) -> str:
    return re.sub(r"<[^>]+>", " ", str(value or ""))


def duration_seconds(value: object) -> int | None:
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return round(float(text))
    except ValueError:
        parts = text.split(":")
        if all(part.isdigit() for part in parts) and 1 < len(parts) <= 3:
            total = 0
            for part in parts:
                total = total * 60 + int(part)
            return total
    return None


def meaningful_tokens(value: str) -> list[str]:
    return [
        token for token in normalize(value).split()
        if token not in STOPWORDS and (len(token) >= 3 or token.isdigit())
    ]


def display_composer(category_name: str) -> str:
    if "," not in category_name:
        return category_name
    family, given = (part.strip() for part in category_name.split(",", 1))
    return f"{given} {family}"


def composer_tokens(category_name: str) -> set[str]:
    normalized = normalize(category_name)
    family, _, given = normalized.partition(" ")
    tokens = {token for token in normalized.split() if len(token) >= 4}
    tokens.add(family)
    if "lassus" in tokens:
        tokens.add("lasso")
    if "desprez" in tokens:
        tokens.update({"despres", "josquin"})
    if family == "monte":
        tokens.add("philippe")
    if family == "gabrieli" and given:
        tokens.add(given.split()[0])
    return tokens


def composer_matches(category_name: str, candidate: str) -> bool:
    candidate_tokens = set(normalize(candidate).split())
    required = composer_tokens(category_name)
    family = normalize(category_name).split()[0]
    if family not in candidate_tokens and not required.intersection(candidate_tokens):
        return False
    if family == "gabrieli":
        given = normalize(category_name).split()[1:2]
        return bool(given and given[0] in candidate_tokens)
    if family == "monte":
        return "philippe" in candidate_tokens
    return True


def search_title(title: str) -> str:
    cleaned = CATALOGUE_MARK.sub("", title).strip(" ,")
    return cleaned if len(meaningful_tokens(cleaned)) >= 2 else title


def title_matches(work_title: str, candidate_title: str) -> tuple[bool, float]:
    expected = normalize(search_title(work_title))
    candidate = normalize(candidate_title)
    if not expected or not candidate:
        return False, 0.0
    work_tokens = meaningful_tokens(expected)
    candidate_tokens = [token for token in meaningful_tokens(candidate) if token not in ANNOTATION_WORDS]
    if not work_tokens:
        return False, 0.0
    coverage = sum(token in candidate_tokens for token in work_tokens) / len(work_tokens)
    similarity = difflib.SequenceMatcher(None, expected, candidate).ratio()
    exact_phrase = expected in candidate or candidate in expected
    work_numbers = set(re.findall(r"\d+", expected))
    candidate_numbers = set(re.findall(r"\d+", candidate))
    numbers_match = not work_numbers or work_numbers.issubset(candidate_numbers)
    if len(work_tokens) == 1:
        matched = expected == candidate or candidate.startswith(f"{expected} ")
    else:
        matched = numbers_match and coverage == 1 and (exact_phrase or similarity >= 0.78)
    return matched, max(similarity, coverage)


def client() -> httpx.Client:
    existing = getattr(thread_local, "client", None)
    if existing is None:
        existing = httpx.Client(
            timeout=httpx.Timeout(30, connect=10),
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        )
        thread_local.client = existing
    return existing


def request_json(url: str, *, params: dict[str, object] | None = None, retries: int = 4) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = client().get(url, params=params)
            if response.status_code == 429:
                retry_after = min(60, max(2, int(response.headers.get("retry-after", "5"))))
                time.sleep(retry_after + 0.5)
                continue
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            last_error = exc
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(str(last_error))


def request_xml(url: str, *, params: dict[str, object], retries: int = 4) -> ET.Element:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = client().get(
                url,
                params=params,
                headers={"User-Agent": BROWSER_USER_AGENT, "Accept": "application/xml,text/xml,*/*"},
            )
            response.raise_for_status()
            return ET.fromstring(response.content)
        except (httpx.HTTPError, ET.ParseError) as exc:
            last_error = exc
            time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(str(last_error))


def archive_metadata(identifier: str) -> dict[str, Any]:
    with metadata_lock:
        cached = metadata_cache.get(identifier)
    if cached is not None:
        return cached
    payload = request_json(INTERNET_ARCHIVE_METADATA.format(identifier=urllib.parse.quote(identifier)))
    with metadata_lock:
        metadata_cache[identifier] = payload
    return payload


def archive_stream_url(identifier: str, filename: str) -> str:
    return "https://archive.org/download/" + urllib.parse.quote(identifier) + "/" + urllib.parse.quote(filename, safe="/")


def choose_archive_file(work: dict[str, Any], item: dict[str, Any]) -> dict[str, Any] | None:
    metadata = item.get("metadata", {})
    identifier = str(metadata.get("identifier") or "")
    if not identifier or metadata.get("is_dark") or metadata.get("access-restricted-item") is True:
        return None
    # Do not use a compilation description to establish authorship: it may list
    # many unrelated composers and would turn a generic track title into a false
    # match. File-level attribution is preferred, followed by item creator/title.
    item_identity = " ".join(map(str, [metadata.get("creator", ""), metadata.get("title", "")]))
    matches: list[tuple[float, dict[str, Any]]] = []
    for file in item.get("files", []):
        name = str(file.get("name") or "")
        if not name.casefold().endswith(SUPPORTED_SUFFIXES):
            continue
        candidate_title = str(file.get("title") or Path(name).stem)
        matched, confidence = title_matches(work["title"], candidate_title)
        if not matched:
            continue
        file_identity = " ".join(map(str, [file.get("creator", ""), file.get("artist", ""), item_identity]))
        if not composer_matches(work["categoryName"], file_identity):
            continue
        if file.get("private") is True or file.get("viruscheck") == "failed":
            continue
        format_priority = 0.04 if name.casefold().endswith(".mp3") else 0.02 if name.casefold().endswith((".ogg", ".opus")) else 0.0
        matches.append((confidence + format_priority, file))
    if not matches:
        return None
    _, selected = max(matches, key=lambda pair: pair[0])
    filename = str(selected["name"])
    stream_url = archive_stream_url(identifier, filename)
    try:
        response = client().head(stream_url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if not (content_type.startswith("audio/") or filename.casefold().endswith((".mp3", ".m4a"))):
            return None
    except httpx.HTTPError:
        return None
    creator = selected.get("creator") or metadata.get("creator") or ""
    if isinstance(creator, list):
        creator = ", ".join(map(str, creator))
    return {
        "provider": "Internet Archive",
        "sourceType": "internet-archive",
        "streamUrl": stream_url,
        "sourceUrl": f"https://archive.org/details/{urllib.parse.quote(identifier)}",
        "sourceTitle": str(metadata.get("title") or identifier),
        "trackTitle": str(selected.get("title") or Path(filename).stem),
        "performer": str(creator),
        "license": str(metadata.get("licenseurl") or metadata.get("rights") or "Публичный поток Internet Archive"),
        "durationSeconds": duration_seconds(selected.get("length")),
        "confidence": 1.0,
        "playbackStatus": "playable",
    }


def find_archive(work: dict[str, Any]) -> dict[str, Any] | None:
    phrase = search_title(work["title"]).replace('"', " ")
    family = work["categoryName"].split(",", 1)[0].replace('"', " ")
    query = f'"{phrase}" AND "{family}" AND mediatype:audio'
    payload = request_json(
        INTERNET_ARCHIVE_SEARCH,
        params={
            "q": query,
            "fl[]": ["identifier"],
            "rows": 8,
            "output": "json",
        },
    )
    for document in payload.get("response", {}).get("docs", []):
        identifier = str(document.get("identifier") or "")
        if not identifier:
            continue
        match = choose_archive_file(work, archive_metadata(identifier))
        if match:
            return match
    return None


def find_archive_batch(works: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    if not works:
        return {}
    family = works[0]["categoryName"].split(",", 1)[0].replace('"', " ")
    phrases = [search_title(work["title"]).replace('"', " ") for work in works]
    title_query = " OR ".join(f'"{phrase}"' for phrase in dict.fromkeys(phrases))
    query = f'({title_query}) AND "{family}" AND mediatype:audio'
    results = {
        work["url"]: {"status": "missing", "searchedSources": ["archive"], "sourceErrors": {}}
        for work in works
    }
    try:
        payload = request_json(
            INTERNET_ARCHIVE_SEARCH,
            params={
                "q": query,
                "fl[]": ["identifier"],
                "rows": 200,
                "output": "json",
            },
        )
        items = [
            archive_metadata(str(document["identifier"]))
            for document in payload.get("response", {}).get("docs", [])
            if document.get("identifier")
        ]
        for work in works:
            for item in items:
                match = choose_archive_file(work, item)
                if match:
                    results[work["url"]] = {
                        "status": "found",
                        "match": match,
                        "searchedSources": ["archive"],
                        "sourceErrors": {},
                    }
                    break
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        for work in works:
            results[work["url"]] = {
                "status": "error",
                "searchedSources": [],
                "sourceErrors": {"archive": error},
            }
    return results


def find_archive_composer_batch(works: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Scan audio files inside the most relevant Archive items for one composer.

    Archive's main search often indexes an album title but not its individual
    track names.  This broader pass finds albums by composer, then checks every
    audio filename and file-level title against the catalogue locally.
    """
    if not works:
        return {}
    category_name = works[0]["categoryName"]
    normalized_name = normalize(category_name)
    name_tokens = [token for token in normalized_name.split() if len(token) >= 4]
    family = name_tokens[0] if name_tokens else normalized_name
    distinguishing = name_tokens[1] if len(name_tokens) > 1 else ""
    identity_query = f'"{family}"' + (f' AND "{distinguishing}"' if distinguishing else "")
    query = f"{identity_query} AND mediatype:audio"
    results = {
        work["url"]: {
            "status": "missing",
            "searchedSources": ["archive-broad"],
            "sourceErrors": {},
        }
        for work in works
    }
    try:
        payload = request_json(
            INTERNET_ARCHIVE_SEARCH,
            params={
                "q": query,
                "fl[]": ["identifier"],
                "rows": 100,
                "sort[]": "downloads desc",
                "output": "json",
            },
        )
        items = [
            archive_metadata(str(document["identifier"]))
            for document in payload.get("response", {}).get("docs", [])
            if document.get("identifier")
        ]
        for work in works:
            for item in items:
                match = choose_archive_file(work, item)
                if match:
                    results[work["url"]] = {
                        "status": "found",
                        "match": match,
                        "searchedSources": ["archive-broad"],
                        "sourceErrors": {},
                    }
                    break
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        for work in works:
            results[work["url"]] = {
                "status": "error",
                "searchedSources": [],
                "sourceErrors": {"archive-broad": error},
            }
    return results


def load_commons_index(works: list[dict[str, Any]], refresh: bool) -> dict[str, list[dict[str, Any]]]:
    cache: dict[str, list[dict[str, Any]]] = {}
    if COMMONS_INDEX_PATH.is_file() and not refresh:
        cache = json.loads(COMMONS_INDEX_PATH.read_text(encoding="utf-8"))
    categories = sorted({work["categoryName"] for work in works})
    for index, category_name in enumerate(categories, start=1):
        if category_name in cache:
            continue
        composer = display_composer(category_name)
        try:
            payload = request_json(
                COMMONS_API,
                params={
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": f'"{composer}" filetype:audio',
                    "gsrnamespace": 6,
                    "gsrlimit": 500,
                    "prop": "imageinfo",
                    "iiprop": "url|mime|size|extmetadata",
                    "format": "json",
                    "formatversion": 2,
                    "maxlag": 5,
                },
            )
            cache[category_name] = payload.get("query", {}).get("pages", [])
        except Exception as exc:
            print(f"commons-index-error {category_name}: {exc}", flush=True)
            continue
        atomic_json(COMMONS_INDEX_PATH, cache)
        print(f"commons-index={index}/{len(categories)} files={len(cache[category_name])}", flush=True)
        time.sleep(3.5)
    return cache


def find_commons(work: dict[str, Any]) -> dict[str, Any] | None:
    if work["categoryName"] not in commons_index:
        raise RuntimeError(f"Wikimedia Commons index unavailable for {work['categoryName']}")
    for page in commons_index.get(work["categoryName"], []):
        info = (page.get("imageinfo") or [{}])[0]
        mime = str(info.get("mime") or "")
        if not mime.startswith("audio/"):
            continue
        metadata = info.get("extmetadata", {})
        candidate_title = str(page.get("title") or "").removeprefix("File:")
        matched, confidence = title_matches(work["title"], candidate_title)
        identity = " ".join(
            strip_html(metadata.get(field, {}).get("value", ""))
            for field in ("Artist", "Credit", "ImageDescription")
        ) + " " + candidate_title
        if not matched or not composer_matches(work["categoryName"], identity):
            continue
        stream_url = str(info.get("url") or "")
        if not stream_url:
            continue
        return {
            "provider": "Wikimedia Commons",
            "sourceType": "wikimedia-commons",
            "streamUrl": stream_url,
            "sourceUrl": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(str(page["title"]).replace(" ", "_"), safe=":()_,"),
            "sourceTitle": candidate_title,
            "trackTitle": candidate_title,
            "performer": strip_html(metadata.get("Artist", {}).get("value", "")),
            "license": strip_html(metadata.get("LicenseShortName", {}).get("value", "")) or "См. страницу файла",
            "durationSeconds": None,
            "confidence": round(confidence, 3),
            "playbackStatus": "playable",
        }
    return None


def load_mutopia_index(works: list[dict[str, Any]], refresh: bool) -> dict[str, list[dict[str, Any]]]:
    cache: dict[str, list[dict[str, Any]]] = {}
    if MUTOPIA_INDEX_PATH.is_file() and not refresh:
        cache = json.loads(MUTOPIA_INDEX_PATH.read_text(encoding="utf-8"))
    categories = sorted({work["categoryName"] for work in works if work["categoryName"] in MUTOPIA_COMPOSERS})
    for index, category_name in enumerate(categories, start=1):
        if category_name in cache:
            continue
        response = client().get(MUTOPIA_LISTING, params={"Composer": MUTOPIA_COMPOSERS[category_name]})
        response.raise_for_status()
        entries: list[dict[str, Any]] = []
        blocks = re.findall(r'<table class="table-bordered result-table">(.*?)</table>', response.text, re.S | re.I)
        for block in blocks:
            title_match = re.search(r"<tr><td>(.*?)</td>", block, re.S | re.I)
            midi_match = re.search(r'href="([^"]+\.(?:mid|midi))"', block, re.I)
            if not title_match or not midi_match:
                continue
            info_match = re.search(r'href="(piece-info\.cgi\?id=\d+)"', block, re.I)
            license_match = re.search(r'legal\.html#[^"]+">([^<]+)</a>', block, re.I)
            title = html.unescape(strip_html(title_match.group(1))).strip()
            stream_url = html.unescape(midi_match.group(1))
            entries.append({
                "title": title,
                "streamUrl": stream_url,
                "sourceUrl": urllib.parse.urljoin(MUTOPIA_LISTING, info_match.group(1)) if info_match else stream_url,
                "license": html.unescape(license_match.group(1)).strip() if license_match else "См. страницу произведения",
            })
        cache[category_name] = entries
        atomic_json(MUTOPIA_INDEX_PATH, cache)
        print(f"mutopia-index={index}/{len(categories)} works={len(entries)}", flush=True)
    return cache


def find_mutopia(work: dict[str, Any]) -> dict[str, Any] | None:
    candidates: list[tuple[float, dict[str, Any]]] = []
    for entry in mutopia_index.get(work["categoryName"], []):
        matched, confidence = title_matches(work["title"], str(entry["title"]))
        if matched:
            candidates.append((confidence, entry))
    if not candidates:
        return None
    confidence, selected = max(candidates, key=lambda pair: pair[0])
    stream_url = str(selected["streamUrl"])
    try:
        response = client().head(stream_url)
        response.raise_for_status()
        if int(response.headers.get("content-length", "1") or "1") <= 0:
            return None
    except httpx.HTTPError:
        return None
    return {
        "provider": "Mutopia Project",
        "sourceType": "mutopia-midi",
        "streamUrl": stream_url,
        "sourceUrl": str(selected["sourceUrl"]),
        "sourceTitle": str(selected["title"]),
        "trackTitle": str(selected["title"]),
        "performer": "Компьютерное воспроизведение партитуры",
        "license": str(selected["license"]),
        "durationSeconds": None,
        "confidence": round(confidence, 3),
        "playbackStatus": "playable",
        "mediaType": "midi",
    }


def musopen_composer_name(composer: dict[str, Any]) -> str:
    return " ".join(
        part for part in (str(composer.get("first_name") or ""), str(composer.get("last_name") or ""))
        if part
    )


def load_musopen_index(works: list[dict[str, Any]], refresh: bool) -> dict[str, list[dict[str, Any]]]:
    cache: dict[str, list[dict[str, Any]]] = {}
    if MUSOPEN_INDEX_PATH.is_file() and not refresh:
        cache = json.loads(MUSOPEN_INDEX_PATH.read_text(encoding="utf-8"))
    categories = sorted({work["categoryName"] for work in works})
    for index, category_name in enumerate(categories, start=1):
        if category_name in cache:
            continue
        family = category_name.split(",", 1)[0].split()[0]
        try:
            payload = request_json(
                f"{MUSOPEN_API}/composers/",
                params={"search": family, "limit": 20},
            )
            candidates = [
                composer for composer in payload.get("results", [])
                if composer_matches(category_name, musopen_composer_name(composer))
            ]
            if not candidates:
                cache[category_name] = []
                atomic_json(MUSOPEN_INDEX_PATH, cache)
                continue
            composer = max(
                candidates,
                key=lambda item: difflib.SequenceMatcher(
                    None,
                    normalize(display_composer(category_name)),
                    normalize(musopen_composer_name(item)),
                ).ratio(),
            )
            pieces: list[dict[str, Any]] = []
            next_url: str | None = f"{MUSOPEN_API}/pieces/"
            params: dict[str, object] | None = {"composer": composer["id"], "limit": 100}
            while next_url:
                page = request_json(next_url, params=params)
                pieces.extend(page.get("results", []))
                next_url = page.get("next")
                params = None
            cache[category_name] = [
                {"id": piece["id"], "title": str(piece.get("title") or "")}
                for piece in pieces
                if piece.get("id") and piece.get("title")
            ]
            atomic_json(MUSOPEN_INDEX_PATH, cache)
            print(
                f"musopen-index={index}/{len(categories)} composer={musopen_composer_name(composer)} "
                f"pieces={len(cache[category_name])}",
                flush=True,
            )
        except Exception as exc:
            print(f"musopen-index-error {category_name}: {exc}", flush=True)
    return cache


def musopen_recordings(piece_id: int) -> list[dict[str, Any]]:
    with musopen_recording_lock:
        cached = musopen_recording_cache.get(piece_id)
    if cached is not None:
        return cached
    payload = request_json(f"{MUSOPEN_API}/pieces/{piece_id}/recordings/")
    recordings = [
        recording for recording in payload.get("results", [])
        if recording.get("fileurl") or recording.get("hq_fileurl")
    ]
    with musopen_recording_lock:
        musopen_recording_cache[piece_id] = recordings
    return recordings


def find_musopen(work: dict[str, Any]) -> dict[str, Any] | None:
    candidates: list[tuple[float, dict[str, Any]]] = []
    for piece in musopen_index.get(work["categoryName"], []):
        matched, confidence = title_matches(work["title"], str(piece["title"]))
        if matched:
            candidates.append((confidence, piece))
    for confidence, piece in sorted(candidates, key=lambda pair: pair[0], reverse=True):
        recordings = musopen_recordings(int(piece["id"]))
        if not recordings:
            continue
        recording = max(
            recordings,
            key=lambda item: (bool(item.get("hq_fileurl")), float(item.get("rating") or 0)),
        )
        stream_url = str(recording.get("hq_fileurl") or recording.get("fileurl") or "")
        try:
            response = client().get(
                stream_url,
                headers={
                    "User-Agent": BROWSER_USER_AGENT,
                    "Referer": "https://player.musopen.org/",
                    "Range": "bytes=0-31",
                },
            )
            if response.status_code not in {200, 206} or not response.content:
                continue
        except httpx.HTTPError:
            continue
        performer = recording.get("performer") or {}
        return {
            "provider": "Musopen",
            "sourceType": "musopen",
            "streamUrl": stream_url,
            "sourceUrl": f"https://player.musopen.org/pieces/{piece['id']}",
            "sourceTitle": str(piece["title"]),
            "trackTitle": str(recording.get("title") or piece["title"]),
            "performer": str(performer.get("name") or ""),
            "license": str(recording.get("license") or "См. страницу записи"),
            "durationSeconds": duration_seconds(recording.get("length")),
            "confidence": round(confidence, 3),
            "playbackStatus": "playable",
        }
    return None


def load_openverse_index(works: list[dict[str, Any]], refresh: bool) -> dict[str, list[dict[str, Any]]]:
    cache: dict[str, list[dict[str, Any]]] = {}
    if OPENVERSE_INDEX_PATH.is_file() and not refresh:
        cache = json.loads(OPENVERSE_INDEX_PATH.read_text(encoding="utf-8"))
    categories = sorted({work["categoryName"] for work in works})
    for index, category_name in enumerate(categories, start=1):
        if category_name in cache:
            continue
        family = category_name.split(",", 1)[0].split()[0]
        entries: list[dict[str, Any]] = []
        try:
            for page_number in range(1, 6):
                payload = request_json(
                    OPENVERSE_API,
                    params={"q": family, "page": page_number, "page_size": 20},
                )
                page_entries = [
                    item for item in payload.get("results", [])
                    if str(item.get("source") or "").casefold() not in {"soundcloud", "spotify"}
                    and item.get("url")
                ]
                entries.extend(page_entries)
                if page_number >= int(payload.get("page_count") or 0):
                    break
            cache[category_name] = entries
            atomic_json(OPENVERSE_INDEX_PATH, cache)
            print(
                f"openverse-index={index}/{len(categories)} query={family} audio={len(entries)}",
                flush=True,
            )
        except Exception as exc:
            print(f"openverse-index-error {category_name}: {exc}", flush=True)
    return cache


def find_openverse(work: dict[str, Any]) -> dict[str, Any] | None:
    candidates: list[tuple[float, dict[str, Any]]] = []
    for entry in openverse_index.get(work["categoryName"], []):
        title = str(entry.get("title") or "")
        matched, confidence = title_matches(work["title"], title)
        audio_set = entry.get("audio_set") or {}
        identity = " ".join(
            str(value or "")
            for value in (
                title,
                entry.get("creator"),
                entry.get("attribution"),
                audio_set.get("title"),
                audio_set.get("creator"),
            )
        )
        if matched and composer_matches(work["categoryName"], identity):
            candidates.append((confidence, entry))
    for confidence, selected in sorted(candidates, key=lambda pair: pair[0], reverse=True):
        stream_url = str(selected.get("url") or "")
        try:
            response = client().get(
                stream_url,
                headers={"User-Agent": BROWSER_USER_AGENT, "Range": "bytes=0-31"},
            )
            content_type = response.headers.get("content-type", "")
            if response.status_code not in {200, 206} or not response.content:
                continue
            if not (content_type.startswith("audio/") or "format=mp3" in stream_url):
                continue
        except httpx.HTTPError:
            continue
        source = str(selected.get("source") or selected.get("provider") or "Openverse")
        license_name = str(selected.get("license") or "")
        license_version = str(selected.get("license_version") or "")
        return {
            "provider": "Openverse",
            "sourceType": "openverse",
            "streamUrl": stream_url,
            "sourceUrl": str(selected.get("foreign_landing_url") or selected.get("detail_url") or stream_url),
            "sourceTitle": str(selected.get("title") or ""),
            "trackTitle": str(selected.get("title") or ""),
            "performer": str(selected.get("creator") or ""),
            "license": " ".join(part for part in (license_name, license_version) if part) or "См. страницу записи",
            "durationSeconds": round(float(selected.get("duration") or 0) / 1000) or None,
            "confidence": round(confidence, 3),
            "playbackStatus": "playable",
            "indexedSource": source,
        }
    return None


def marc_subfields(record: ET.Element, tag: str, code: str) -> list[str]:
    values: list[str] = []
    for field in record:
        if not field.tag.endswith("datafield") or field.get("tag") != tag:
            continue
        values.extend(
            (subfield.text or "").strip()
            for subfield in field
            if subfield.tag.endswith("subfield")
            and subfield.get("code") == code
            and (subfield.text or "").strip()
        )
    return values


def load_gallica_index(works: list[dict[str, Any]], refresh: bool) -> dict[str, list[dict[str, Any]]]:
    """Index freely accessible digitized sound recordings from BnF/Gallica."""
    cache: dict[str, list[dict[str, Any]]] = {}
    if GALLICA_INDEX_PATH.is_file() and not refresh:
        cache = json.loads(GALLICA_INDEX_PATH.read_text(encoding="utf-8"))
    categories = sorted({work["categoryName"] for work in works})
    srw_namespace = "{http://www.loc.gov/zing/srw/}"
    marc_record_tag = "{info:lc/xmlns/marcxchange-v2}record"
    for index, category_name in enumerate(categories, start=1):
        if category_name in cache:
            continue
        family = category_name.split(",", 1)[0].split()[0]
        query = (
            '(bib.set any "music") and (bib.doctype any "g") '
            f'and (bib.author all "{family}") and (bib.digitized all "freeAccess")'
        )
        entries: list[dict[str, Any]] = []
        start_record = 1
        try:
            while True:
                root = request_xml(
                    BNF_SRU_API,
                    params={
                        "version": "1.2",
                        "operation": "searchRetrieve",
                        "query": query,
                        "startRecord": start_record,
                        "maximumRecords": 100,
                        "recordSchema": "unimarcXchange",
                    },
                )
                total = int(root.findtext(f".//{srw_namespace}numberOfRecords") or 0)
                records = list(root.iter(marc_record_tag))
                for record in records:
                    links = [
                        link.replace("http://", "https://", 1)
                        for link in marc_subfields(record, "856", "u")
                        if "gallica.bnf.fr/ark:/12148/" in link
                    ]
                    if not links:
                        continue
                    candidate_titles = list(
                        dict.fromkeys(
                            title
                            for tag, code in (("200", "a"), ("423", "t"), ("464", "t"), ("500", "a"))
                            for title in marc_subfields(record, tag, code)
                        )
                    )
                    if not candidate_titles:
                        continue
                    performers = marc_subfields(record, "200", "g")
                    identity_parts = marc_subfields(record, "200", "f")
                    for author_tag in ("700", "701", "702"):
                        identity_parts.extend(marc_subfields(record, author_tag, "a"))
                        identity_parts.extend(marc_subfields(record, author_tag, "b"))
                    for source_url in links:
                        ark = source_url.rstrip("/").rsplit("/", 1)[-1]
                        entries.append(
                            {
                                "candidateTitles": candidate_titles,
                                "sourceTitle": " / ".join(candidate_titles),
                                "performer": " / ".join(performers),
                                "identity": " ".join(identity_parts),
                                "sourceUrl": source_url,
                                "streamUrl": f"https://gallica.bnf.fr/ark:/12148/{ark}.audio",
                            }
                        )
                start_record += len(records)
                if not records or start_record > total:
                    break
            cache[category_name] = entries
            atomic_json(GALLICA_INDEX_PATH, cache)
            print(
                f"gallica-index={index}/{len(categories)} query={family} audio={len(entries)}",
                flush=True,
            )
        except Exception as exc:
            print(f"gallica-index-error {category_name}: {exc}", flush=True)
    return cache


def find_gallica(work: dict[str, Any]) -> dict[str, Any] | None:
    candidates: list[tuple[float, str, dict[str, Any]]] = []
    for entry in gallica_index.get(work["categoryName"], []):
        if not composer_matches(work["categoryName"], str(entry.get("identity") or "")):
            continue
        for title in entry.get("candidateTitles", []):
            matched, confidence = title_matches(work["title"], str(title))
            if matched:
                candidates.append((confidence, str(title), entry))
    for confidence, matched_title, selected in sorted(candidates, key=lambda pair: pair[0], reverse=True):
        stream_url = str(selected["streamUrl"])
        try:
            with client().stream(
                "GET",
                stream_url,
                headers={"User-Agent": BROWSER_USER_AGENT, "Range": "bytes=0-31"},
            ) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "")
                first_bytes = next(response.iter_bytes(), b"")
                if not first_bytes or not content_type.startswith("audio/"):
                    continue
        except httpx.HTTPError:
            continue
        return {
            "provider": "Gallica",
            "sourceType": "gallica",
            "streamUrl": stream_url,
            "sourceUrl": str(selected["sourceUrl"]),
            "sourceTitle": str(selected["sourceTitle"]),
            "trackTitle": matched_title,
            "performer": str(selected.get("performer") or ""),
            "license": "Свободный доступ Gallica / BnF",
            "durationSeconds": None,
            "confidence": round(confidence, 3),
            "playbackStatus": "playable",
        }
    return None


def load_missing_works() -> list[dict[str, Any]]:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    audit = json.loads(PLAYBACK_REPORT_PATH.read_text(encoding="utf-8"))
    existing_cache = json.loads(CACHE_PATH.read_text(encoding="utf-8")) if CACHE_PATH.is_file() else {}
    known_external_urls = {
        work_url for work_url, result in existing_cache.items() if result.get("match")
    }
    works_by_url: dict[str, dict[str, Any]] = {}
    for artist_id, artist in catalog["artists"].items():
        category_name = urllib.parse.unquote(artist["catalogUrl"].split("Category:", 1)[-1]).replace("_", " ")
        statuses = audit["perArtist"][artist_id]["works"]
        for work in artist["works"]:
            if (
                statuses[str(work["id"])] != "recording-not-found"
                and work["imslpUrl"] not in known_external_urls
            ):
                continue
            entry = works_by_url.setdefault(
                work["imslpUrl"],
                {
                    "url": work["imslpUrl"],
                    "artistId": artist_id,
                    "workId": str(work["id"]),
                    "title": work["title"],
                    "categoryName": category_name,
                    "aliases": [],
                },
            )
            entry["aliases"].append({"artistId": artist_id, "workId": str(work["id"]), "title": work["title"]})
    return sorted(works_by_url.values(), key=lambda work: (work["categoryName"].casefold(), work["title"].casefold()))


def find_for_work(work: dict[str, Any], sources: tuple[str, ...]) -> dict[str, Any]:
    attempted: list[str] = []
    errors: dict[str, str] = {}
    match: dict[str, Any] | None = None
    for source in sources:
        try:
            match = (
                find_archive(work) if source == "archive"
                else find_commons(work) if source == "commons"
                else find_mutopia(work) if source == "mutopia"
                else find_musopen(work) if source == "musopen"
                else find_openverse(work) if source == "openverse"
                else find_gallica(work)
            )
            attempted.append(source)
            if match:
                break
        except Exception as exc:
            errors[source] = f"{type(exc).__name__}: {exc}"
    if match:
        return {"status": "found", "match": match, "searchedSources": attempted, "sourceErrors": errors}
    return {
        "status": "error" if errors else "missing",
        "searchedSources": attempted,
        "sourceErrors": errors,
    }


def merge_result(existing: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    searched = list(dict.fromkeys([*existing.get("searchedSources", []), *current.get("searchedSources", [])]))
    errors = {**existing.get("sourceErrors", {}), **current.get("sourceErrors", {})}
    for source in current.get("searchedSources", []):
        errors.pop(source, None)
    match = current.get("match") or existing.get("match")
    return {
        "status": "found" if match else "error" if errors else "missing",
        **({"match": match} if match else {}),
        "searchedSources": searched,
        "sourceErrors": errors,
    }


def reject_ambiguous_streams(cache: dict[str, dict[str, Any]]) -> None:
    by_stream: dict[str, list[str]] = {}
    for work_url, result in cache.items():
        media_url = result.get("match", {}).get("streamUrl") or result.get("match", {}).get("sourceUrl")
        if media_url:
            by_stream.setdefault(media_url, []).append(work_url)
    for media_url, work_urls in by_stream.items():
        if len(work_urls) < 2:
            continue
        for work_url in work_urls:
            result = cache[work_url]
            result.pop("match", None)
            result["status"] = "ambiguous"
            result["ambiguity"] = {
                "mediaUrl": media_url,
                "workUrls": work_urls,
                "reason": "one audio track matched multiple distinct catalogue works",
            }


def build_manifest(works: list[dict[str, Any]], cache: dict[str, dict[str, Any]]) -> dict[str, Any]:
    artists: dict[str, dict[str, Any]] = {}
    for work in works:
        result = cache.get(work["url"], {})
        match = result.get("match")
        if not match:
            continue
        manifest_match = dict(match)
        if match.get("sourceType") == "mutopia-midi":
            filename = f"{work['artistId']}-{work['workId']}.mid"
            local_path = EXTERNAL_AUDIO_DIR / filename
            if not local_path.is_file() or not local_path.read_bytes()[:4] == b"MThd":
                response = client().get(str(match["streamUrl"]))
                response.raise_for_status()
                if not response.content.startswith(b"MThd"):
                    raise RuntimeError(f"Mutopia returned an invalid MIDI file: {match['streamUrl']}")
                atomic_bytes(local_path, response.content)
            manifest_match["originalStreamUrl"] = match["streamUrl"]
            manifest_match["streamUrl"] = f"/classical/audio/external/{filename}"
        for alias in work["aliases"]:
            artist = artists.setdefault(alias["artistId"], {"availableCount": 0, "works": {}})
            artist["works"][alias["workId"]] = {
                "key": f"{alias['artistId']}|{alias['workId']}",
                "title": alias["title"],
                **manifest_match,
            }
    for artist in artists.values():
        artist["availableCount"] = len(artist["works"])
    found_unique = sum(bool(cache.get(work["url"], {}).get("match")) for work in works)
    return {
        "generatedAt": datetime.now(UTC).isoformat(),
        "playbackMode": "remote-audio",
        "searchedUniqueWorks": len(works),
        "availableUniqueWorks": found_unique,
        "artists": artists,
    }


def write_report(works: list[dict[str, Any]], cache: dict[str, dict[str, Any]]) -> None:
    found = [work for work in works if cache.get(work["url"], {}).get("match")]
    counts = Counter(cache.get(work["url"], {}).get("status", "pending") for work in works)
    lines = [
        "# Поиск внешних аудиозаписей",
        "",
        f"Проверено уникальных произведений: **{len(works)}**. Найдено точных встраиваемых записей: **{len(found)}**.",
        f"Статусы: `{dict(counts)}`.",
        "",
        "## Подключено",
        "",
    ]
    for work in found:
        match = cache[work["url"]]["match"]
        lines.append(
            f"- **{work['title']}** — [{match['provider']}]({match['sourceUrl']}) · "
            f"`{work['artistId']}/{work['workId']}`"
        )
    if not found:
        lines.append("Точных совпадений пока нет.")
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument(
        "--sources",
        choices=(
            "archive",
            "archive-broad",
            "commons",
            "mutopia",
            "musopen",
            "openverse",
            "gallica",
            "all",
        ),
        default="all",
    )
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()
    sources = (
        ("archive", "commons", "mutopia", "musopen", "openverse", "gallica")
        if args.sources == "all"
        else (args.sources,)
    )
    works = load_missing_works()
    if "commons" in sources:
        globals()["commons_index"] = load_commons_index(works, args.refresh)
    if "mutopia" in sources:
        globals()["mutopia_index"] = load_mutopia_index(works, args.refresh)
    if "musopen" in sources:
        globals()["musopen_index"] = load_musopen_index(works, args.refresh)
    if "openverse" in sources:
        globals()["openverse_index"] = load_openverse_index(works, args.refresh)
    if "gallica" in sources:
        globals()["gallica_index"] = load_gallica_index(works, args.refresh)
    cache: dict[str, dict[str, Any]] = {}
    if CACHE_PATH.is_file() and not args.refresh:
        cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    pending = [
        work for work in works
        if not cache.get(work["url"], {}).get("match")
        and not set(sources).issubset(cache.get(work["url"], {}).get("searchedSources", []))
    ]
    if args.limit:
        pending = pending[: args.limit]
    print(f"missing={len(works)} cached={len(works) - len(pending)} pending={len(pending)} sources={','.join(sources)}", flush=True)
    lock = threading.Lock()
    if pending and sources in {("archive",), ("archive-broad",)}:
        grouped: dict[str, list[dict[str, Any]]] = {}
        for work in pending:
            grouped.setdefault(work["categoryName"], []).append(work)
        batches = (
            list(grouped.values())
            if sources == ("archive-broad",)
            else [
                category_works[index : index + max(1, args.batch_size)]
                for category_works in grouped.values()
                for index in range(0, len(category_works), max(1, args.batch_size))
            ]
        )
        completed_works = 0
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            search_batch = (
                find_archive_composer_batch
                if sources == ("archive-broad",)
                else find_archive_batch
            )
            futures = {executor.submit(search_batch, batch): batch for batch in batches}
            for future in as_completed(futures):
                batch_results = future.result()
                with lock:
                    for work_url, result in batch_results.items():
                        cache[work_url] = merge_result(cache.get(work_url, {}), result)
                    completed_works += len(futures[future])
                    atomic_json(CACHE_PATH, cache)
                    counts = Counter(item.get("status") for item in cache.values())
                    print(f"progress={completed_works}/{len(pending)} statuses={dict(counts)}", flush=True)
    elif pending:
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = {executor.submit(find_for_work, work, sources): work for work in pending}
            for index, future in enumerate(as_completed(futures), start=1):
                work = futures[future]
                result = future.result()
                with lock:
                    cache[work["url"]] = merge_result(cache.get(work["url"], {}), result)
                    if index % 20 == 0 or index == len(pending):
                        atomic_json(CACHE_PATH, cache)
                        counts = Counter(item.get("status") for item in cache.values())
                        print(f"progress={index}/{len(pending)} statuses={dict(counts)}", flush=True)
    reject_ambiguous_streams(cache)
    atomic_json(CACHE_PATH, cache)
    manifest = build_manifest(works, cache)
    atomic_json(MANIFEST_PATH, manifest)
    write_report(works, cache)
    print(json.dumps({key: value for key, value in manifest.items() if key != "artists"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

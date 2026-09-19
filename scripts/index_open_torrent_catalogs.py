#!/usr/bin/env python3
"""Index rights-cleared torrent catalogues and match the local work catalogue.

This script deliberately limits itself to Internet Archive collections with an
explicit Creative Commons/public-domain marker or an artist-permission policy.
It downloads catalogue metadata and file lists, never the audio payload.
"""

from __future__ import annotations

import argparse
import csv
import json
import tempfile
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from find_external_audio import (
    composer_matches,
    display_composer,
    meaningful_tokens,
    title_matches,
)

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "frontend/public/classical/catalog/imslp-works.json"
INDEX_PATH = ROOT / "reports/open-torrent-catalog-index.json"
MATCHES_PATH = ROOT / "reports/open-torrent-work-matches.json"
CSV_PATH = ROOT / "reports/open-torrent-work-matches.csv"
REPORT_PATH = ROOT / "reports/open-torrent-work-matches.md"
SEARCH_URL = "https://archive.org/advancedsearch.php"
METADATA_URL = "https://archive.org/metadata/{identifier}"
USER_AGENT = "MySpotifyOpenTorrentIndex/1.0 (local research catalogue)"
SUPPORTED_AUDIO = (".mp3", ".ogg", ".opus", ".flac", ".m4a", ".wav")
SPOKEN_AUDIO_MARKERS = ("read by", "audiobook", "librivox")
ALLOWED_LICENSE_MARKERS = (
    "creativecommons.org/licenses/",
    "creativecommons.org/publicdomain/",
    "rightsstatements.org/vocab/noc-us/",
)

CATALOGS: dict[str, dict[str, str]] = {
    "archive-open-audio": {
        "name": "Internet Archive · открыто лицензированное аудио",
        "filter": (
            'mediatype:audio AND format:"Archive BitTorrent" AND licenseurl:* '
            "AND NOT collection:etree AND NOT collection:netlabels"
        ),
        "policy": "Только элементы с явной Creative Commons или public-domain меткой.",
    },
    "live-music-archive": {
        "name": "Live Music Archive / etree",
        "filter": 'mediatype:audio AND format:"Archive BitTorrent" AND collection:etree',
        "policy": (
            "Коллекция исполнителей, разрешивших некоммерческое распространение концертных записей."
        ),
    },
    "netlabels": {
        "name": "Internet Archive · Netlabels",
        "filter": (
            'mediatype:audio AND format:"Archive BitTorrent" '
            "AND collection:netlabels AND licenseurl:*"
        ),
        "policy": "Только элементы netlabel с явной Creative Commons или public-domain меткой.",
    },
}


def atomic_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, delete=False
    ) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def client() -> httpx.Client:
    return httpx.Client(
        timeout=httpx.Timeout(45, connect=15),
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    )


def get_json(
    http: httpx.Client, url: str, *, params: dict[str, object] | None = None
) -> dict[str, Any]:
    error: Exception | None = None
    for attempt in range(5):
        try:
            response = http.get(url, params=params)
            if response.status_code == 429:
                time.sleep(min(30, 2 ** (attempt + 1)))
                continue
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            error = exc
            time.sleep(0.75 * (attempt + 1))
    raise RuntimeError(str(error))


def load_works() -> list[dict[str, Any]]:
    payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    unique: dict[str, dict[str, Any]] = {}
    for artist_id, artist in payload["artists"].items():
        category_name = urllib.parse.unquote(
            artist["catalogUrl"].split("Category:", 1)[-1]
        ).replace("_", " ")
        for work in artist["works"]:
            item = unique.setdefault(
                work["imslpUrl"],
                {
                    "imslpUrl": work["imslpUrl"],
                    "categoryName": category_name,
                    "composer": display_composer(category_name),
                    "title": work["title"],
                    "aliases": [],
                },
            )
            item["aliases"].append({"artistId": artist_id, "workId": str(work["id"])})
    return sorted(
        unique.values(),
        key=lambda item: (item["categoryName"].casefold(), item["title"].casefold()),
    )


def composer_query(category_name: str) -> str:
    display = display_composer(category_name).replace('"', " ")
    name_parts = category_name.split(",", 1)
    family = name_parts[0].replace('"', " ")
    if len(name_parts) == 1:
        return f'(creator:("{display}") OR title:("{display}"))'
    given = name_parts[1].strip().split()[0].replace('"', " ")
    if family in {"Milán", "Monte", "Victoria"}:
        return (
            f'(creator:("{display}") OR title:("{display}") '
            f'OR ((creator:("{family}") OR title:("{family}")) '
            f'AND (creator:("{given}") OR title:("{given}"))))'
        )
    return (
        f'(creator:("{display}") OR title:("{display}") '
        f'OR creator:("{family}") OR title:("{family}"))'
    )


def licensed_item(metadata: dict[str, Any], catalog_key: str) -> bool:
    if catalog_key == "live-music-archive":
        collection = metadata.get("collection", [])
        if isinstance(collection, str):
            collection = [collection]
        return "etree" in collection
    license_url = str(metadata.get("licenseurl") or "").casefold().replace("http://", "https://")
    return any(marker in license_url for marker in ALLOWED_LICENSE_MARKERS)


def compact_item(
    identifier: str, payload: dict[str, Any], catalog_key: str
) -> dict[str, Any] | None:
    metadata = payload.get("metadata", {})
    if metadata.get("is_dark") or metadata.get("access-restricted-item") is True:
        return None
    if not licensed_item(metadata, catalog_key):
        return None
    files = payload.get("files", [])
    torrents = [
        str(file.get("name"))
        for file in files
        if str(file.get("name") or "").casefold().endswith(".torrent")
    ]
    if not torrents:
        return None
    audio_files = []
    for file in files:
        name = str(file.get("name") or "")
        if not name.casefold().endswith(SUPPORTED_AUDIO) or file.get("private") is True:
            continue
        audio_files.append(
            {
                "name": name,
                "title": str(file.get("title") or ""),
                "creator": str(file.get("creator") or file.get("artist") or ""),
                "format": str(file.get("format") or ""),
                "size": int(file.get("size") or 0),
            }
        )
    if not audio_files:
        return None
    torrent_name = torrents[0]
    encoded_identifier = urllib.parse.quote(identifier)
    return {
        "identifier": identifier,
        "title": str(metadata.get("title") or identifier),
        "creator": metadata.get("creator") or "",
        "date": str(metadata.get("date") or metadata.get("year") or ""),
        "licenseUrl": str(
            metadata.get("licenseurl") or "Artist permission through Live Music Archive"
        ),
        "rights": str(metadata.get("rights") or ""),
        "detailsUrl": f"https://archive.org/details/{encoded_identifier}",
        "torrentUrl": f"https://archive.org/download/{encoded_identifier}/{urllib.parse.quote(torrent_name)}",
        "audioFiles": audio_files,
    }


def fetch_metadata(identifier: str, catalog_key: str) -> dict[str, Any] | None:
    with client() as http:
        payload = get_json(http, METADATA_URL.format(identifier=urllib.parse.quote(identifier)))
    return compact_item(identifier, payload, catalog_key)


def fetch_catalog_composer(catalog_key: str, category_name: str, workers: int) -> dict[str, Any]:
    query = f"{composer_query(category_name)} AND {CATALOGS[catalog_key]['filter']}"
    documents: list[dict[str, Any]] = []
    page = 1
    total = 0
    with client() as http:
        while True:
            payload = get_json(
                http,
                SEARCH_URL,
                params={
                    "q": query,
                    "fl[]": ["identifier"],
                    "rows": 200,
                    "page": page,
                    "sort[]": "identifier asc",
                    "output": "json",
                },
            )
            response = payload.get("response", {})
            total = int(response.get("numFound") or 0)
            batch = response.get("docs", [])
            documents.extend(batch)
            if not batch or len(documents) >= total:
                break
            page += 1
    identifiers = list(
        dict.fromkeys(str(doc["identifier"]) for doc in documents if doc.get("identifier"))
    )
    items: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        futures = {
            executor.submit(fetch_metadata, identifier, catalog_key): identifier
            for identifier in identifiers
        }
        for future in as_completed(futures):
            item = future.result()
            if item:
                items.append(item)
    items.sort(key=lambda item: item["identifier"])
    return {"query": query, "remoteCount": total, "indexedCount": len(items), "items": items}


def file_title(file: dict[str, Any]) -> str:
    if file.get("title"):
        return str(file["title"])
    return Path(str(file.get("name") or "")).stem


def best_match(work: dict[str, Any], catalog_data: dict[str, Any]) -> dict[str, Any] | None:
    candidates: list[tuple[float, dict[str, Any], dict[str, Any]]] = []
    expected_tokens = set(meaningful_tokens(work["title"]))
    for item in catalog_data.get("items", []):
        item_creator = item.get("creator", "")
        if isinstance(item_creator, list):
            item_creator = " ".join(map(str, item_creator))
        item_identity = f"{item_creator} {item.get('title', '')}"
        for audio_file in item.get("audioFiles", []):
            candidate_title = file_title(audio_file)
            media_description = f"{candidate_title} {item.get('title', '')}".casefold()
            if any(marker in media_description for marker in SPOKEN_AUDIO_MARKERS):
                continue
            candidate_tokens = audio_file.get("_matchTokens")
            if candidate_tokens is None:
                candidate_tokens = set(meaningful_tokens(candidate_title))
                audio_file["_matchTokens"] = candidate_tokens
            if not expected_tokens.issubset(candidate_tokens):
                continue
            matched, confidence = title_matches(work["title"], candidate_title)
            if not matched or confidence < 0.78:
                continue
            identity = f"{audio_file.get('creator', '')} {item_identity}"
            if not composer_matches(work["categoryName"], identity):
                continue
            candidates.append((confidence, item, audio_file))
    if not candidates:
        return None
    confidence, item, audio_file = max(candidates, key=lambda row: row[0])
    identifier = str(item["identifier"])
    name = str(audio_file["name"])
    return {
        "confidence": round(confidence, 3),
        "matchedTitle": file_title(audio_file),
        "detailsUrl": item["detailsUrl"],
        "torrentUrl": item["torrentUrl"],
        "streamUrl": (
            f"https://archive.org/download/{urllib.parse.quote(identifier)}/"
            f"{urllib.parse.quote(name, safe='/')}"
        ),
        "licenseUrl": item["licenseUrl"],
        "identifier": identifier,
        "filename": name,
    }


def build_matches(works: list[dict[str, Any]], index: dict[str, Any]) -> dict[str, Any]:
    matches: list[dict[str, Any]] = []
    for work in works:
        found: list[dict[str, Any]] = []
        for catalog_key, catalog in index["catalogs"].items():
            composer_data = catalog.get("composers", {}).get(work["categoryName"], {})
            match = best_match(work, composer_data)
            if match:
                found.append({"catalog": catalog_key, "catalogName": catalog["name"], **match})
        if found:
            matches.append({**work, "matches": found})
    return {
        "generatedAt": datetime.now(UTC).isoformat(),
        "method": (
            "Exact title and composer matching over rights-cleared Archive "
            "BitTorrent metadata; no audio payload downloaded."
        ),
        "catalogUniqueWorks": len(works),
        "matchedUniqueWorks": len(matches),
        "matches": matches,
    }


def write_reports(payload: dict[str, Any], index: dict[str, Any]) -> None:
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "composer",
                "title",
                "artist_ids",
                "work_ids",
                "catalog",
                "matched_title",
                "confidence",
                "details_url",
                "torrent_url",
                "stream_url",
                "license_url",
            ],
        )
        writer.writeheader()
        for work in payload["matches"]:
            for match in work["matches"]:
                writer.writerow(
                    {
                        "composer": work["composer"],
                        "title": work["title"],
                        "artist_ids": "|".join(alias["artistId"] for alias in work["aliases"]),
                        "work_ids": "|".join(alias["workId"] for alias in work["aliases"]),
                        "catalog": match["catalog"],
                        "matched_title": match["matchedTitle"],
                        "confidence": match["confidence"],
                        "details_url": match["detailsUrl"],
                        "torrent_url": match["torrentUrl"],
                        "stream_url": match["streamUrl"],
                        "license_url": match["licenseUrl"],
                    }
                )
    lines = [
        "# Поиск по открытым torrent-каталогам",
        "",
        f"Каталог сайта: **{payload['catalogUniqueWorks']}** уникальных произведений. "
        f"Точные совпадения с подтверждённым композитором: **{payload['matchedUniqueWorks']}**.",
        "",
        "Скачаны только метаданные и списки файлов; аудио не скачивалось.",
        "",
        "## Проиндексированные каталоги",
        "",
    ]
    for catalog in index["catalogs"].values():
        indexed = sum(item.get("indexedCount", 0) for item in catalog.get("composers", {}).values())
        lines.append(
            f"- **{catalog['name']}** — {indexed} релевантных элементов. {catalog['policy']}"
        )
    lines.extend(["", "## Найденные произведения", ""])
    for work in payload["matches"]:
        for match in work["matches"]:
            lines.append(
                f"- **{work['composer']} — {work['title']}** · "
                f"[{match['catalogName']}]({match['detailsUrl']}) · "
                f"[torrent]({match['torrentUrl']}) · confidence `{match['confidence']}`"
            )
    if not payload["matches"]:
        lines.append("Точных совпадений не найдено.")
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--limit-composers", type=int)
    args = parser.parse_args()

    works = load_works()
    categories = sorted({work["categoryName"] for work in works})
    if args.limit_composers:
        categories = categories[: args.limit_composers]
    if INDEX_PATH.is_file() and not args.refresh:
        index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    else:
        index = {"catalogs": {}}
    index["generatedAt"] = datetime.now(UTC).isoformat()

    for catalog_key, spec in CATALOGS.items():
        catalog = index["catalogs"].setdefault(catalog_key, {**spec, "composers": {}})
        for position, category_name in enumerate(categories, start=1):
            if category_name in catalog["composers"] and not args.refresh:
                continue
            result = fetch_catalog_composer(catalog_key, category_name, args.workers)
            catalog["composers"][category_name] = result
            atomic_json(INDEX_PATH, index)
            print(
                f"catalog={catalog_key} composer={position}/{len(categories)} "
                f"name={category_name} remote={result['remoteCount']} "
                f"indexed={result['indexedCount']}",
                flush=True,
            )

    payload = build_matches(works, index)
    atomic_json(MATCHES_PATH, payload)
    write_reports(payload, index)
    print(
        json.dumps(
            {
                "catalogUniqueWorks": payload["catalogUniqueWorks"],
                "matchedUniqueWorks": payload["matchedUniqueWorks"],
                "index": str(INDEX_PATH),
                "report": str(REPORT_PATH),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

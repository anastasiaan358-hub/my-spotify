#!/usr/bin/env python3
"""Export exact non-YouTube recordings for works without a YouTube version."""

from __future__ import annotations

import json
import urllib.parse
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CATALOG_DIR = ROOT / "frontend/public/classical/catalog"
CATALOG_PATH = CATALOG_DIR / "imslp-works.json"
YOUTUBE_PATH = CATALOG_DIR / "youtube-works.json"
EXTERNAL_PATH = CATALOG_DIR / "external-audio.json"
LOCAL_PATH = CATALOG_DIR / "local-audio.json"
OUTPUT_PATH = ROOT / "reports/missing-listening-links.md"
LOCAL_ORIGIN = "http://127.0.0.1:5175"


@dataclass
class CatalogWork:
    composer: str
    title: str
    aliases: list[tuple[str, str]] = field(default_factory=list)


def display_composer(category_name: str) -> str:
    if "," not in category_name:
        return category_name
    family, given = (part.strip() for part in category_name.split(",", 1))
    return f"{given} {family}"


def work_index(payload: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (artist_id, work_id): work
        for artist_id, artist in payload.get("artists", {}).items()
        for work_id, work in artist.get("works", {}).items()
    }


def listening_url(work: dict[str, Any]) -> str:
    original = str(work.get("originalStreamUrl") or "")
    if original:
        return original
    stream = str(work.get("streamUrl") or "")
    if stream.startswith("/"):
        return LOCAL_ORIGIN + stream
    return stream or str(work.get("sourceUrl") or "")


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    youtube = work_index(json.loads(YOUTUBE_PATH.read_text(encoding="utf-8")))
    external = work_index(json.loads(EXTERNAL_PATH.read_text(encoding="utf-8")))
    local = work_index(json.loads(LOCAL_PATH.read_text(encoding="utf-8")))

    grouped: dict[str, CatalogWork] = {}
    for artist_id, artist in catalog["artists"].items():
        category_name = urllib.parse.unquote(
            artist["catalogUrl"].split("Category:", 1)[-1]
        ).replace("_", " ")
        composer = display_composer(category_name)
        for work in artist["works"]:
            grouped_work = grouped.setdefault(
                work["imslpUrl"],
                CatalogWork(composer=composer, title=work["title"]),
            )
            grouped_work.aliases.append((artist_id, str(work["id"])))

    rows: list[tuple[str, str, str]] = []
    youtube_count = 0
    no_recording_count = 0
    for work in grouped.values():
        if any(youtube.get(alias, {}).get("playbackStatus") == "playable" for alias in work.aliases):
            youtube_count += 1
            continue

        alternative = next(
            (
                external[alias]
                for alias in work.aliases
                if external.get(alias, {}).get("playbackStatus") == "playable"
            ),
            None,
        )
        if alternative is None:
            alternative = next(
                (
                    local[alias]
                    for alias in work.aliases
                    if local.get(alias, {}).get("playbackStatus") == "playable"
                ),
                None,
            )
        url = listening_url(alternative) if alternative else ""
        if url:
            rows.append((work.composer, work.title, url))
        else:
            no_recording_count += 1

    rows.sort(key=lambda row: (row[0].casefold(), row[1].casefold()))
    OUTPUT_PATH.write_text("\n".join(url for _, _, url in rows) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "youtube": youtube_count,
                "nonYoutubeLinks": len(rows),
                "notFound": no_recording_count,
                "output": str(OUTPUT_PATH),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Publish verified YouTube recordings for in-app embedded playback.

The script is resumable: by default it appends one batch to the existing
manifest. It never downloads or copies YouTube audiovisual content.
"""

from __future__ import annotations

import argparse
import csv
import json
import tempfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "reports" / "youtube-score-links.csv"
DEFAULT_OUTPUT = ROOT / "frontend" / "public" / "classical" / "catalog" / "youtube-works.json"
DEFAULT_AUDIT = ROOT / "reports" / "youtube-link-audit.json"
DEFAULT_PLAYBACK_AUDIT = ROOT / "reports" / "youtube-stream-audit-cache.json"


def youtube_video_id(url: str) -> str:
    return url.partition("v=")[2].partition("&")[0]


def unavailable_video_ids(path: Path | None) -> set[str]:
    if path is None or not path.is_file():
        return set()
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        identifier
        for identifier, result in payload.get("videos", {}).items()
        if result.get("status") == "unavailable"
    }


def playable_video_ids(path: Path | None) -> set[str] | None:
    """Return videos proven to have audio and permit embedded playback.

    ``None`` keeps the helper backwards-compatible for callers that have not run
    the stronger player audit yet.  The command-line publisher uses the audit by
    default, so unverified search results never reach the application manifest.
    """
    if path is None or not path.is_file():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    videos = payload.get("videos", payload)
    return {
        identifier
        for identifier, result in videos.items()
        if isinstance(result, dict) and result.get("status") == "playable"
    }


def verified_rows(
    path: Path,
    unavailable_ids: set[str] | None = None,
    playable_ids: set[str] | None = None,
) -> list[dict[str, str]]:
    unavailable_ids = unavailable_ids or set()
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [
            row
            for row in csv.DictReader(handle)
            if row.get("status") == "found"
            and (identifier := youtube_video_id(row.get("youtube_url", "")))
            and identifier not in unavailable_ids
            and (playable_ids is None or identifier in playable_ids)
        ]


def existing_keys(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        work["key"]
        for artist in payload.get("artists", {}).values()
        for work in artist.get("works", {}).values()
    }


def build_manifest(
    rows: list[dict[str, str]],
    published_keys: set[str],
) -> dict[str, object]:
    artists: dict[str, dict[str, object]] = {}
    for row in rows:
        if row["key"] not in published_keys:
            continue
        artist = artists.setdefault(row["artist_id"], {"availableCount": 0, "works": {}})
        works = artist["works"]
        assert isinstance(works, dict)
        works[row["work_id"]] = {
            "key": row["key"],
            "title": row["title"],
            "youtubeUrl": row["youtube_url"],
            "youtubeTitle": row["youtube_title"],
            "channel": row["channel"],
            "confidence": row["confidence"],
        }
        artist["availableCount"] = len(works)

    published_count = sum(int(artist["availableCount"]) for artist in artists.values())
    return {
        "generatedAt": datetime.now(UTC).isoformat(),
        "source": "YouTube",
        "playbackMode": "visible-embed",
        "totalAvailable": len(rows),
        "publishedCount": published_count,
        "remainingCount": len(rows) - published_count,
        "artists": artists,
    }


def write_manifest(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=path.parent,
        prefix=f".{path.name}.",
        delete=False,
    ) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def publish(
    source: Path,
    output: Path,
    batch_size: int | None,
    reset: bool,
    audit_path: Path | None = DEFAULT_AUDIT,
    playback_audit_path: Path | None = None,
) -> dict[str, object]:
    rows = verified_rows(
        source,
        unavailable_video_ids(audit_path),
        playable_video_ids(playback_audit_path),
    )
    known = set() if reset else existing_keys(output)
    pending = [row["key"] for row in rows if row["key"] not in known]
    selected = pending if batch_size is None else pending[:batch_size]
    payload = build_manifest(rows, known | set(selected))
    write_manifest(output, payload)
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--audit", type=Path, default=DEFAULT_AUDIT)
    parser.add_argument("--playback-audit", type=Path, default=DEFAULT_PLAYBACK_AUDIT)
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--all", action="store_true", help="Publish every remaining link")
    parser.add_argument("--reset", action="store_true", help="Rebuild the manifest from scratch")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.batch_size <= 0:
        raise SystemExit("--batch-size must be greater than zero")
    payload = publish(
        args.source,
        args.output,
        batch_size=None if args.all else args.batch_size,
        reset=args.reset,
        audit_path=args.audit,
        playback_audit_path=args.playback_audit,
    )
    print(
        f"Published {payload['publishedCount']}/{payload['totalAvailable']} online recordings; "
        f"remaining {payload['remainingCount']}"
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Import locally supplied, licensed recordings into the web catalogue in batches."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "frontend" / "public" / "classical" / "audio" / "incoming" / "catalog.csv"
DEFAULT_OUTPUT = ROOT / "frontend" / "public" / "classical" / "catalog" / "local-audio.json"
DEFAULT_AUDIO_DIR = ROOT / "frontend" / "public" / "classical" / "audio" / "imported"
SUPPORTED_EXTENSIONS = {".flac", ".m4a", ".mid", ".midi", ".mp3", ".ogg", ".wav"}
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")
REQUIRED_FIELDS = {
    "artist_id",
    "work_id",
    "title",
    "file_path",
    "source_name",
    "source_url",
    "license",
}


def read_rows(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        raise SystemExit(f"Input catalogue not found: {path}")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = REQUIRED_FIELDS - set(reader.fieldnames or ())
        if missing:
            raise SystemExit(f"Missing CSV columns: {', '.join(sorted(missing))}")
        rows = [{key: (value or "").strip() for key, value in row.items()} for row in reader]

    seen: set[str] = set()
    for line_number, row in enumerate(rows, start=2):
        for field in REQUIRED_FIELDS:
            if not row[field]:
                raise SystemExit(f"Line {line_number}: {field} is required")
        for field in ("artist_id", "work_id"):
            if not SAFE_ID.fullmatch(row[field]):
                raise SystemExit(f"Line {line_number}: invalid {field}: {row[field]}")
        key = row_key(row)
        if key in seen:
            raise SystemExit(f"Line {line_number}: duplicate work: {key}")
        seen.add(key)
    return rows


def row_key(row: dict[str, str]) -> str:
    return f"{row['artist_id']}:{row['work_id']}"


def media_type(path: Path) -> str:
    return "midi" if path.suffix.lower() in {".mid", ".midi"} else "audio"


def source_file(row: dict[str, str], catalogue_path: Path) -> Path:
    candidate = Path(row["file_path"]).expanduser()
    return candidate if candidate.is_absolute() else catalogue_path.parent / candidate


def destination_file(row: dict[str, str], catalogue_path: Path, audio_dir: Path) -> Path:
    suffix = source_file(row, catalogue_path).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise SystemExit(f"Unsupported audio format for {row_key(row)}: {suffix or '(none)'}")
    return audio_dir / row["artist_id"] / f"{row['work_id']}{suffix}"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def existing_keys(path: Path, audio_dir: Path) -> set[str]:
    if not path.is_file():
        return set()
    payload = json.loads(path.read_text(encoding="utf-8"))
    keys: set[str] = set()
    for artist_id, artist in payload.get("artists", {}).items():
        for work_id, work in artist.get("works", {}).items():
            stream_url = str(work.get("streamUrl", ""))
            prefix = "/classical/audio/imported/"
            if not stream_url.startswith(prefix):
                continue
            relative = Path(stream_url.removeprefix(prefix))
            if (audio_dir / relative).is_file():
                keys.add(f"{artist_id}:{work_id}")
    return keys


def copy_recording(source: Path, destination: Path) -> tuple[int, str]:
    if not source.is_file():
        raise SystemExit(f"Audio file not found: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as handle:
        temporary = Path(handle.name)
    try:
        shutil.copy2(source, temporary)
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return destination.stat().st_size, sha256(destination)


def build_manifest(
    rows: list[dict[str, str]],
    imported_keys: set[str],
    catalogue_path: Path,
    audio_dir: Path,
) -> dict[str, object]:
    artists: dict[str, dict[str, object]] = {}
    for row in rows:
        if row_key(row) not in imported_keys:
            continue
        destination = destination_file(row, catalogue_path, audio_dir)
        artist = artists.setdefault(row["artist_id"], {"availableCount": 0, "works": {}})
        works = artist["works"]
        assert isinstance(works, dict)
        works[row["work_id"]] = {
            "key": row_key(row),
            "title": row["title"],
            "streamUrl": (f"/classical/audio/imported/{row['artist_id']}/{destination.name}"),
            "mediaType": media_type(destination),
            "sourceName": row["source_name"],
            "sourceUrl": row["source_url"],
            "license": row["license"],
            "bytes": destination.stat().st_size,
            "sha256": sha256(destination),
        }
        artist["availableCount"] = len(works)

    imported_count = sum(int(artist["availableCount"]) for artist in artists.values())
    return {
        "generatedAt": datetime.now(UTC).isoformat(),
        "playbackMode": "local-audio",
        "totalEntries": len(rows),
        "importedCount": imported_count,
        "remainingCount": len(rows) - imported_count,
        "artists": artists,
    }


def write_manifest(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False
    ) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def import_audio(
    source: Path,
    output: Path,
    audio_dir: Path,
    batch_size: int | None,
    reset: bool,
) -> dict[str, object]:
    rows = read_rows(source)
    known = set() if reset else existing_keys(output, audio_dir)
    pending = [row for row in rows if row_key(row) not in known]
    selected = pending if batch_size is None else pending[:batch_size]
    imported = set(known)
    for row in selected:
        origin = source_file(row, source)
        destination = destination_file(row, source, audio_dir)
        copy_recording(origin, destination)
        imported.add(row_key(row))
    payload = build_manifest(rows, imported, source, audio_dir)
    write_manifest(output, payload)
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--audio-dir", type=Path, default=DEFAULT_AUDIO_DIR)
    parser.add_argument("--batch-size", type=int, default=25)
    parser.add_argument("--all", action="store_true", help="Import every remaining recording")
    parser.add_argument("--reset", action="store_true", help="Rebuild the manifest from scratch")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.batch_size <= 0:
        raise SystemExit("--batch-size must be greater than zero")
    payload = import_audio(
        args.source,
        args.output,
        args.audio_dir,
        batch_size=None if args.all else args.batch_size,
        reset=args.reset,
    )
    print(
        f"Imported {payload['importedCount']}/{payload['totalEntries']} licensed recordings; "
        f"remaining {payload['remainingCount']}"
    )


if __name__ == "__main__":
    main()

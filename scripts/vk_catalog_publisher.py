from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

ROOT = Path(__file__).resolve().parent.parent
VK_AUDIO_ROOT = ROOT / "frontend/public/classical/audio/vk"
VK_MANIFEST_PATH = ROOT / "frontend/public/classical/catalog/vk-audio.json"
SAFE_ID = re.compile(r"^[A-Za-z0-9-]+$")


class PublishableTrack(Protocol):
    artist_id: str
    work_id: str
    performer: str
    title: str

    @property
    def key(self) -> str: ...


def audio_path(track: PublishableTrack) -> Path:
    if not SAFE_ID.fullmatch(track.artist_id) or not SAFE_ID.fullmatch(track.work_id):
        raise ValueError(f"Некорректный идентификатор произведения: {track.key}")
    return VK_AUDIO_ROOT / track.artist_id / f"{track.work_id}.mp3"


def is_published(track: PublishableTrack) -> bool:
    path = audio_path(track)
    if not path.is_file() or path.stat().st_size == 0:
        return False
    try:
        payload = json.loads(VK_MANIFEST_PATH.read_text(encoding="utf-8"))
        work = payload["artists"][track.artist_id]["works"][track.work_id]
    except (FileNotFoundError, KeyError, json.JSONDecodeError, TypeError):
        return False
    return work.get("playbackStatus") == "playable" and work.get("streamUrl") == public_url(track)


def published_keys() -> set[str]:
    try:
        payload = json.loads(VK_MANIFEST_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()
    keys: set[str] = set()
    for artist_id, composer in payload.get("artists", {}).items():
        for work_id, work in composer.get("works", {}).items():
            path = VK_AUDIO_ROOT / artist_id / f"{work_id}.mp3"
            if (
                work.get("playbackStatus") == "playable"
                and work.get("streamUrl") == f"/classical/audio/vk/{artist_id}/{work_id}.mp3"
                and path.is_file()
                and path.stat().st_size > 0
            ):
                keys.add(f"{artist_id}:{work_id}")
    return keys


def public_url(track: PublishableTrack) -> str:
    return f"/classical/audio/vk/{track.artist_id}/{track.work_id}.mp3"


def publish_mp3(
    source: Path,
    track: PublishableTrack,
    *,
    duration_seconds: int | None = None,
) -> Path:
    if not source.is_file() or source.stat().st_size == 0:
        raise RuntimeError("Нельзя опубликовать отсутствующий или пустой MP3")

    destination = audio_path(track)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_audio = destination.with_suffix(".mp3.part")
    try:
        with source.open("rb") as input_handle, temporary_audio.open("wb") as output_handle:
            shutil.copyfileobj(input_handle, output_handle, length=1024 * 1024)
            output_handle.flush()
            os.fsync(output_handle.fileno())
        temporary_audio.replace(destination)
    finally:
        temporary_audio.unlink(missing_ok=True)

    duration = duration_seconds or probe_duration(destination)
    _update_manifest(track, destination, duration)
    return destination


def probe_duration(path: Path) -> int | None:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return max(1, round(float(result.stdout.strip())))
    except (FileNotFoundError, ValueError, subprocess.SubprocessError):
        return None


def _empty_manifest() -> dict:
    return {
        "generatedAt": datetime.now(UTC).isoformat(),
        "playbackMode": "local-vk-audio",
        "availableCount": 0,
        "artists": {},
    }


def _update_manifest(
    track: PublishableTrack,
    path: Path,
    duration_seconds: int | None,
) -> None:
    try:
        payload = json.loads(VK_MANIFEST_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        payload = _empty_manifest()

    artists = payload.setdefault("artists", {})
    composer = artists.setdefault(track.artist_id, {"availableCount": 0, "works": {}})
    entry = {
        "key": track.key,
        "title": track.title,
        "performer": track.performer,
        "streamUrl": public_url(track),
        "mediaType": "audio",
        "sourceName": "VK",
        "bytes": path.stat().st_size,
        "playbackStatus": "playable",
        "verifiedAt": datetime.now(UTC).isoformat(),
    }
    if duration_seconds:
        entry["durationSeconds"] = duration_seconds
    composer.setdefault("works", {})[track.work_id] = entry
    composer["availableCount"] = len(composer["works"])
    payload["availableCount"] = sum(
        len(value.get("works", {})) for value in artists.values()
    )
    payload["generatedAt"] = datetime.now(UTC).isoformat()
    payload["playbackMode"] = "local-vk-audio"

    VK_MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_manifest = VK_MANIFEST_PATH.with_suffix(".json.part")
    try:
        with temporary_manifest.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        temporary_manifest.replace(VK_MANIFEST_PATH)
    finally:
        temporary_manifest.unlink(missing_ok=True)

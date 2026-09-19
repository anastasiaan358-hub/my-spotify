#!/usr/bin/env python3
"""Verify actual audio formats and embed permission for every assigned video.

The audit reads YouTube player metadata without downloading media. Results are
cached per video so the full catalogue can be resumed safely.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import io
import json
import re
import tempfile
import threading
import time
import unicodedata
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "frontend/public/classical/catalog/imslp-works.json"
YOUTUBE_PATH = ROOT / "frontend/public/classical/catalog/youtube-works.json"
LOCAL_AUDIO_PATH = ROOT / "frontend/public/classical/catalog/local-audio.json"
EXTERNAL_AUDIO_PATH = ROOT / "frontend/public/classical/catalog/external-audio.json"
CACHE_PATH = ROOT / "reports/youtube-stream-audit-cache.json"
REPORT_PATH = ROOT / "reports/playback-catalog-audit.json"
CSV_REPORT_PATH = ROOT / "reports/playback-catalog-audit.csv"
MARKDOWN_REPORT_PATH = ROOT / "reports/playback-catalog-audit.md"
PUBLIC_REPORT_PATH = ROOT / "frontend/public/classical/catalog/playback-audit.json"
PLAYER_ENDPOINT = "https://www.youtube.com/youtubei/v1/player"
ANDROID_CLIENT = {
    "clientName": "ANDROID",
    "clientVersion": "21.26.364",
    "androidSdkVersion": 30,
    "osName": "Android",
    "osVersion": "11",
    "hl": "en",
    "gl": "US",
}
ANDROID_USER_AGENT = "com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip"
thread_local = threading.local()


def normalize_title(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    without_marks = "".join(character for character in decomposed if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", " ", without_marks.casefold()).strip()


def titles_match(first: str, second: str) -> bool:
    first_normalized = normalize_title(first)
    second_normalized = normalize_title(second)
    return (
        first_normalized == second_normalized
        or first_normalized.startswith(f"{second_normalized} ")
        or second_normalized.startswith(f"{first_normalized} ")
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def local_media_status(path: Path, media_type: str) -> str:
    if not path.is_file() or path.stat().st_size == 0:
        return "missing"
    with path.open("rb") as handle:
        header = handle.read(12)
    if media_type == "midi":
        valid = header.startswith(b"MThd")
    elif path.suffix.casefold() in {".ogg", ".opus"}:
        valid = header.startswith(b"OggS")
    elif path.suffix.casefold() == ".flac":
        valid = header.startswith(b"fLaC")
    elif path.suffix.casefold() == ".wav":
        valid = header.startswith(b"RIFF") and header[8:12] == b"WAVE"
    elif path.suffix.casefold() == ".mp3":
        valid = header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 0xFF and header[1] & 0xE0 == 0xE0)
    elif path.suffix.casefold() in {".m4a", ".mp4"}:
        valid = header[4:8] == b"ftyp"
    elif path.suffix.casefold() == ".aac":
        valid = len(header) >= 2 and header[0] == 0xFF and header[1] & 0xF0 == 0xF0
    else:
        valid = False
    return "playable" if valid else "corrupt"


def verify_external_stream(url: str) -> tuple[str, str]:
    if url.startswith("/"):
        path = ROOT / "frontend/public" / url.lstrip("/")
        media_type = "midi" if path.suffix.casefold() in {".mid", ".midi"} else "audio"
        return url, local_media_status(path, media_type)
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
        )
    }
    for attempt in range(3):
        try:
            with httpx.Client(
                timeout=httpx.Timeout(45, connect=10),
                headers=headers,
                follow_redirects=True,
            ) as external_client:
                response = external_client.head(url)
                if (
                    response.status_code in {200, 206}
                    and response.headers.get("content-length") != "0"
                ):
                    return url, "playable"
                with external_client.stream("GET", url, headers={"Range": "bytes=0-31"}) as stream:
                    stream.raise_for_status()
                    if stream.status_code in {200, 206} and next(stream.iter_bytes(), b""):
                        return url, "playable"
        except httpx.HTTPError:
            if attempt < 2:
                time.sleep(0.5 * (attempt + 1))
    return url, "unavailable"


def featured_assets() -> list[dict[str, str]]:
    script_path = ROOT / "scripts/download_classical_assets.py"
    spec = importlib.util.spec_from_file_location("download_classical_assets", script_path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Cannot load featured assets from {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.ASSETS


def add_featured_local_audio(catalog: dict[str, object], local_audio: dict[str, object]) -> int:
    artists = local_audio.setdefault("artists", {})
    assert isinstance(artists, dict)
    for artist_id in list(artists):
        artist = artists[artist_id]
        works = artist.get("works", {})
        artist["works"] = {
            work_id: work
            for work_id, work in works.items()
            if not work.get("featuredAsset") and not work.get("inheritedFrom")
        }
        if not artist["works"]:
            artists.pop(artist_id)

    added = 0
    catalog_artists = catalog.get("artists", {})
    assert isinstance(catalog_artists, dict)
    for asset in featured_assets():
        artist_id = asset["id"]
        extension = "ogg" if asset["audio"].endswith(".ogg") else "mid"
        media_type = "audio" if extension == "ogg" else "midi"
        path = ROOT / f"frontend/public/classical/audio/{artist_id}.{extension}"
        if local_media_status(path, media_type) != "playable":
            continue
        matching_works = [
            work
            for work in catalog_artists.get(artist_id, {}).get("works", [])
            if titles_match(str(work["title"]), asset["title"])
        ]
        if len(matching_works) != 1:
            continue
        work = matching_works[0]
        artist = artists.setdefault(artist_id, {"availableCount": 0, "works": {}})
        works = artist["works"]
        work_id = str(work["id"])
        if work_id in works:
            continue
        works[work_id] = {
            "key": f"{artist_id}:{work_id}",
            "title": work["title"],
            "streamUrl": f"/classical/audio/{artist_id}.{extension}",
            "mediaType": media_type,
            "sourceName": asset.get("source", "Mutopia Project"),
            "sourceUrl": asset.get("source_url", asset["audio"]),
            "license": asset["license"],
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "featuredAsset": True,
        }
        added += 1
    return added


def propagate_media_to_aliases(catalog: dict[str, object], media: dict[str, object]) -> int:
    """Make one recording available in every catalogue row for the same IMSLP work."""
    media_artists = media.setdefault("artists", {})
    assert isinstance(media_artists, dict)
    for artist_id in list(media_artists):
        artist = media_artists[artist_id]
        works = artist.get("works", {})
        artist["works"] = {
            work_id: work for work_id, work in works.items() if not work.get("inheritedFrom")
        }
        if not artist["works"]:
            media_artists.pop(artist_id)

    catalog_entries: dict[str, list[tuple[str, str, str]]] = {}
    source_by_url: dict[str, tuple[str, str, dict[str, object]]] = {}
    for artist_id, artist in catalog["artists"].items():
        media_works = media_artists.get(artist_id, {}).get("works", {})
        for work in artist["works"]:
            work_id = str(work["id"])
            work_url = str(work["imslpUrl"])
            catalog_entries.setdefault(work_url, []).append((artist_id, work_id, str(work["title"])))
            if work_id in media_works:
                source_by_url.setdefault(work_url, (artist_id, work_id, media_works[work_id]))

    added = 0
    for work_url, entries in catalog_entries.items():
        source = source_by_url.get(work_url)
        if not source:
            continue
        source_artist_id, source_work_id, source_work = source
        for artist_id, work_id, title in entries:
            artist = media_artists.setdefault(artist_id, {"availableCount": 0, "works": {}})
            works = artist["works"]
            if work_id in works:
                continue
            clone = dict(source_work)
            clone.update({
                "key": f"{artist_id}|{work_id}",
                "title": title,
                "inheritedFrom": f"{source_artist_id}/{source_work_id}",
            })
            works[work_id] = clone
            added += 1
    return added


def atomic_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def atomic_text(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        handle.write(value)
        temporary = Path(handle.name)
    temporary.replace(path)


def video_id(url: str) -> str | None:
    parsed = urlparse(url)
    candidate = (
        parsed.path.removeprefix("/").split("/", 1)[0]
        if parsed.hostname == "youtu.be"
        else parse_qs(parsed.query).get("v", [None])[0]
    )
    return candidate if candidate and len(candidate) == 11 else None


def client() -> httpx.Client:
    existing = getattr(thread_local, "client", None)
    if existing is None:
        existing = httpx.Client(
            timeout=httpx.Timeout(25, connect=10),
            headers={"User-Agent": ANDROID_USER_AGENT, "Content-Type": "application/json"},
            follow_redirects=True,
        )
        thread_local.client = existing
    return existing


def verify_video(identifier: str) -> tuple[str, dict[str, object]]:
    payload = {
        "context": {"client": ANDROID_CLIENT},
        "videoId": identifier,
        "contentCheckOk": True,
        "racyCheckOk": True,
    }
    last_error = ""
    for attempt in range(3):
        try:
            response = client().post(PLAYER_ENDPOINT, params={"prettyPrint": "false"}, json=payload)
            response.raise_for_status()
            info = response.json()
            playability = info.get("playabilityStatus", {})
            streaming = info.get("streamingData", {})
            formats = [*streaming.get("formats", []), *streaming.get("adaptiveFormats", [])]
            audio_formats = [
                item for item in formats
                if "audio/" in str(item.get("mimeType", ""))
                or item.get("audioQuality")
                or item.get("audioChannels")
            ]
            playable_in_embed = playability.get("playableInEmbed")
            player_status = str(playability.get("status") or "UNKNOWN")
            if player_status != "OK":
                status = "restricted" if player_status == "LOGIN_REQUIRED" else "unavailable"
            elif playable_in_embed is False:
                status = "not-embeddable"
            elif not audio_formats:
                status = "no-audio"
            else:
                status = "playable"
            details = info.get("videoDetails", {})
            return identifier, {
                "status": status,
                "playerStatus": player_status,
                "reason": str(playability.get("reason") or ""),
                "title": str(details.get("title") or ""),
                "durationSeconds": int(details.get("lengthSeconds") or 0) or None,
                "playableInEmbed": playable_in_embed,
                "audioFormatCount": len(audio_formats),
            }
        except (httpx.HTTPError, json.JSONDecodeError, ValueError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            time.sleep(0.5 * (attempt + 1))
    return identifier, {"status": "transient-error", "error": last_error}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    youtube = json.loads(YOUTUBE_PATH.read_text(encoding="utf-8"))
    local_audio = json.loads(LOCAL_AUDIO_PATH.read_text(encoding="utf-8"))
    external_audio = json.loads(EXTERNAL_AUDIO_PATH.read_text(encoding="utf-8"))
    featured_local_count = add_featured_local_audio(catalog, local_audio)
    inherited_youtube_count = propagate_media_to_aliases(catalog, youtube)
    inherited_local_count = propagate_media_to_aliases(catalog, local_audio)
    inherited_external_count = propagate_media_to_aliases(catalog, external_audio)
    assigned = {
        identifier: work["youtubeUrl"]
        for artist in youtube.get("artists", {}).values()
        for work in artist.get("works", {}).values()
        if (identifier := video_id(work.get("youtubeUrl", "")))
    }

    cache: dict[str, dict[str, object]] = {}
    if CACHE_PATH.is_file() and not args.refresh:
        cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    pending = [identifier for identifier in assigned if identifier not in cache or cache[identifier].get("status") == "transient-error"]
    if args.limit:
        pending = pending[: args.limit]
    print(f"videos={len(assigned)} cached={len(assigned) - len(pending)} pending={len(pending)}", flush=True)

    lock = threading.Lock()
    if pending:
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = {executor.submit(verify_video, identifier): identifier for identifier in pending}
            for index, future in enumerate(as_completed(futures), start=1):
                identifier, result = future.result()
                with lock:
                    cache[identifier] = result
                    if index % 20 == 0 or index == len(pending):
                        atomic_json(CACHE_PATH, cache)
                        counts = Counter(item.get("status") for item in cache.values())
                        print(f"progress={index}/{len(pending)} statuses={dict(counts)}", flush=True)

    checked_at = datetime.now(UTC).isoformat()
    for artist in youtube.get("artists", {}).values():
        works = artist.get("works", {})
        for work in works.values():
            identifier = video_id(work.get("youtubeUrl", ""))
            audit = cache.get(identifier or "", {})
            work["playbackStatus"] = audit.get("status", "not-checked")
            work["verifiedAt"] = checked_at if audit else None
            work["durationSeconds"] = audit.get("durationSeconds")
            work["playableInEmbed"] = audit.get("playableInEmbed")
        artist["availableCount"] = sum(work.get("playbackStatus") == "playable" for work in works.values())

    local_file_counts = Counter()
    for artist in local_audio.get("artists", {}).values():
        works = artist.get("works", {})
        for work in works.values():
            local_path = ROOT / "frontend/public" / str(work.get("streamUrl", "")).lstrip("/")
            status = local_media_status(local_path, str(work.get("mediaType", "audio")))
            work["playbackStatus"] = status
            work["verifiedAt"] = checked_at
            local_file_counts[status] += 1
        artist["availableCount"] = sum(work.get("playbackStatus") == "playable" for work in works.values())

    external_urls = {
        str(work.get("streamUrl"))
        for artist in external_audio.get("artists", {}).values()
        for work in artist.get("works", {}).values()
        if work.get("streamUrl")
    }
    external_statuses: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=min(12, max(1, len(external_urls)))) as executor:
        futures = {executor.submit(verify_external_stream, url): url for url in external_urls}
        for future in as_completed(futures):
            url, status = future.result()
            external_statuses[url] = status
    external_stream_counts = Counter(external_statuses.values())
    for artist in external_audio.get("artists", {}).values():
        works = artist.get("works", {})
        for work in works.values():
            work["playbackStatus"] = external_statuses.get(str(work.get("streamUrl")), "unavailable")
            work["verifiedAt"] = checked_at
        artist["availableCount"] = sum(work.get("playbackStatus") == "playable" for work in works.values())

    per_artist: dict[str, dict[str, object]] = {}
    unique_statuses: dict[str, list[str]] = {}
    unique_metadata: dict[str, dict[str, object]] = {}
    entry_statuses = Counter()
    for artist_id, artist in catalog["artists"].items():
        statuses: dict[str, str] = {}
        local_works = local_audio.get("artists", {}).get(artist_id, {}).get("works", {})
        online_works = youtube.get("artists", {}).get(artist_id, {}).get("works", {})
        external_works = external_audio.get("artists", {}).get(artist_id, {}).get("works", {})
        for work in artist["works"]:
            local = local_works.get(str(work["id"]))
            local_path = ROOT / "frontend/public" / str(local.get("streamUrl", "")).lstrip("/") if local else None
            online = online_works.get(str(work["id"]))
            external = external_works.get(str(work["id"]))
            if local and local_path and local.get("playbackStatus") == "playable":
                status = "local-playable"
            elif external and external.get("playbackStatus") == "playable":
                status = "external-playable"
            elif online and online.get("playbackStatus") == "playable":
                status = "online-playable"
            elif online:
                status = str(online.get("playbackStatus") or "not-checked")
            elif external:
                status = "external-unavailable"
            else:
                status = "recording-not-found"
            statuses[str(work["id"])] = status
            entry_statuses[status] += 1
            work_url = str(work["imslpUrl"])
            unique_statuses.setdefault(work_url, []).append(status)
            metadata = unique_metadata.setdefault(
                work_url,
                {
                    "title": work["title"],
                    "artistIds": [],
                    "workId": str(work["id"]),
                    "dateSort": work.get("dateSort"),
                    "dateLabel": work.get("dateLabel", "Дата не установлена"),
                },
            )
            artist_ids = metadata["artistIds"]
            assert isinstance(artist_ids, list)
            artist_ids.append(artist_id)
        counts = Counter(statuses.values())
        per_artist[artist_id] = {
            "totalWorks": len(artist["works"]),
            "playableCount": counts["local-playable"] + counts["external-playable"] + counts["online-playable"],
            "localPlayableCount": counts["local-playable"],
            "externalPlayableCount": counts["external-playable"],
            "onlinePlayableCount": counts["online-playable"],
            "recordingNotFoundCount": counts["recording-not-found"],
            "unavailableAssignedCount": sum(
                count for status, count in counts.items()
                if status not in {"local-playable", "external-playable", "online-playable", "recording-not-found"}
            ),
            "works": statuses,
        }

    unique_counts = Counter()
    unique_final_status: dict[str, str] = {}
    for statuses in unique_statuses.values():
        if "local-playable" in statuses:
            final_status = "local-playable"
        elif "external-playable" in statuses:
            final_status = "external-playable"
        elif "online-playable" in statuses:
            final_status = "online-playable"
        elif all(status == "recording-not-found" for status in statuses):
            final_status = "recording-not-found"
        else:
            final_status = "assigned-unavailable"
        unique_counts[final_status] += 1
    for work_url, statuses in unique_statuses.items():
        if "local-playable" in statuses:
            unique_final_status[work_url] = "local-playable"
        elif "external-playable" in statuses:
            unique_final_status[work_url] = "external-playable"
        elif "online-playable" in statuses:
            unique_final_status[work_url] = "online-playable"
        elif all(status == "recording-not-found" for status in statuses):
            unique_final_status[work_url] = "recording-not-found"
        else:
            unique_final_status[work_url] = "assigned-unavailable"

    video_counts = Counter(item.get("status") for identifier, item in cache.items() if identifier in assigned)
    report: dict[str, object] = {
        "checkedAt": checked_at,
        "method": "YouTube Android player metadata; requires status OK, an audio format, and playableInEmbed not false; no media downloaded",
        "catalogEntries": sum(len(artist["works"]) for artist in catalog["artists"].values()),
        "uniqueWorks": len(unique_statuses),
        "sourceVideoAssignments": sum(
            not work.get("inheritedFrom")
            for artist in youtube.get("artists", {}).values()
            for work in artist.get("works", {}).values()
        ),
        "catalogVideoAssignments": sum(len(artist.get("works", {})) for artist in youtube.get("artists", {}).values()),
        "inheritedVideoAssignments": inherited_youtube_count,
        "uniqueVideos": len(assigned),
        "videoStatuses": dict(video_counts),
        "featuredLocalAssignments": featured_local_count,
        "inheritedLocalAssignments": inherited_local_count,
        "inheritedExternalAssignments": inherited_external_count,
        "localFileStatuses": dict(local_file_counts),
        "externalStreamStatuses": dict(external_stream_counts),
        "entryStatuses": dict(entry_statuses),
        "uniqueWorkStatuses": dict(unique_counts),
        "perArtist": per_artist,
    }
    youtube["generatedAt"] = checked_at
    youtube["playbackAudit"] = {
        "method": report["method"],
        "uniqueVideos": len(assigned),
        "statuses": dict(video_counts),
    }
    youtube["publishedCount"] = sum(
        work.get("playbackStatus") == "playable" and not work.get("inheritedFrom")
        for artist in youtube.get("artists", {}).values()
        for work in artist.get("works", {}).values()
    )
    youtube["remainingCount"] = youtube.get("totalAvailable", 0) - youtube["publishedCount"]
    youtube["catalogPlayableEntryCount"] = sum(
        work.get("playbackStatus") == "playable"
        for artist in youtube.get("artists", {}).values()
        for work in artist.get("works", {}).values()
    )
    local_audio["generatedAt"] = checked_at
    local_audio["catalogPlayableEntryCount"] = sum(
        work.get("playbackStatus") == "playable"
        for artist in local_audio.get("artists", {}).values()
        for work in artist.get("works", {}).values()
    )
    local_audio["featuredAssetCount"] = featured_local_count
    local_audio["inheritedEntryCount"] = inherited_local_count
    external_audio["generatedAt"] = checked_at
    external_audio["catalogPlayableEntryCount"] = sum(
        work.get("playbackStatus") == "playable"
        for artist in external_audio.get("artists", {}).values()
        for work in artist.get("works", {}).values()
    )
    external_audio["inheritedEntryCount"] = inherited_external_count
    atomic_json(YOUTUBE_PATH, youtube)
    atomic_json(LOCAL_AUDIO_PATH, local_audio)
    atomic_json(EXTERNAL_AUDIO_PATH, external_audio)
    atomic_json(REPORT_PATH, report)
    atomic_json(PUBLIC_REPORT_PATH, report)

    csv_buffer = io.StringIO()
    writer = csv.DictWriter(
        csv_buffer,
        fieldnames=["artist_ids", "work_id", "title", "date_sort", "date_label", "playback_status", "imslp_url"],
    )
    writer.writeheader()
    for work_url, metadata in sorted(
        unique_metadata.items(),
        key=lambda pair: (
            pair[1].get("dateSort") is None,
            pair[1].get("dateSort") or 9999,
            str(pair[1]["title"]).casefold(),
        ),
    ):
        writer.writerow(
            {
                "artist_ids": "|".join(dict.fromkeys(metadata["artistIds"])),
                "work_id": metadata["workId"],
                "title": metadata["title"],
                "date_sort": metadata.get("dateSort") or "",
                "date_label": metadata["dateLabel"],
                "playback_status": unique_final_status[work_url],
                "imslp_url": work_url,
            }
        )
    atomic_text(CSV_REPORT_PATH, csv_buffer.getvalue())

    restricted_works = [
        (artist_id, work_id, work)
        for artist_id, artist in youtube.get("artists", {}).items()
        for work_id, work in artist.get("works", {}).items()
        if work.get("playbackStatus") != "playable" and not work.get("inheritedFrom")
    ]
    markdown = [
        "# Полный аудит прослушивания каталога",
        "",
        f"Проверено: **{checked_at}**.",
        "",
        f"Уникальных произведений: **{len(unique_statuses)}**. "
        f"Доступно онлайн: **{unique_counts['online-playable']}**; "
        f"доступно во внешних открытых архивах: **{unique_counts['external-playable']}**; "
        f"доступно локально: **{unique_counts['local-playable']}**; "
        f"запись не найдена: **{unique_counts['recording-not-found']}**; "
        f"назначенная запись недоступна: **{unique_counts['assigned-unavailable']}**.",
        "",
        "Метод: запрос метаданных проигрывателя YouTube для каждой уникальной ссылки. "
        "Запись считается рабочей при статусе `OK`, наличии аудиоформата и отсутствии запрета на встраивание. Медиафайлы не скачивались.",
        f"Локальные файлы также проверены по сигнатуре формата: рабочих записей в строках каталога — "
        f"**{local_file_counts['playable']}**.",
        f"Внешние потоки проверены прямым HTTP-запросом: рабочих — **{external_stream_counts['playable']}**, "
        f"недоступных — **{external_stream_counts['unavailable']}**.",
        "",
        "## По разделам каталога",
        "",
        "| Раздел | Всего | Доступно | Без найденной записи | Назначено, но недоступно |",
        "|---|---:|---:|---:|---:|",
    ]
    for artist_id, stats in per_artist.items():
        markdown.append(
            f"| `{artist_id}` | {stats['totalWorks']} | {stats['playableCount']} | "
            f"{stats['recordingNotFoundCount']} | {stats['unavailableAssignedCount']} |"
        )
    markdown.extend(["", "## Отключённые ссылки", ""])
    if restricted_works:
        for artist_id, work_id, work in restricted_works:
            markdown.append(
                f"- **{work['title']}** (`{artist_id}/{work_id}`) — "
                f"{work.get('playbackStatus')}; {work['youtubeUrl']}"
            )
    else:
        markdown.append("Назначенных, но недоступных ссылок нет.")
    markdown.extend(
        [
            "",
            "Полный построчный результат для 4 083 произведений находится в `reports/playback-catalog-audit.csv`.",
            "",
        ]
    )
    atomic_text(MARKDOWN_REPORT_PATH, "\n".join(markdown))
    print(json.dumps(report | {"perArtist": "see report"}, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import json
import os
import random
import tempfile
import time
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote, urlsplit

from scripts.send_featured_catalog_to_telegram import TelegramSender
from scripts.vk_catalog_publisher import is_published, publish_mp3, published_keys
from telegram_music_bot.config import BotConfig
from telegram_music_bot.database import MusicCache
from telegram_music_bot.database import normalize_query
from telegram_music_bot.downloader import VKMusicProvider

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "frontend/public/classical/catalog/imslp-works.json"
DEFAULT_STATE_PATH = ROOT / "data/vk-catalog-state.jsonl"
PUBLIC_STATUS_PATH = ROOT / "frontend/public/classical/catalog/vk-download-status.json"


@dataclass(frozen=True)
class CatalogTrack:
    artist_id: str
    work_id: str
    performer: str
    title: str

    @property
    def key(self) -> str:
        return f"{self.artist_id}:{self.work_id}"

    @property
    def query(self) -> str:
        return f"{self.performer} - {self.title}"


def performer_from_catalog_url(url: str, fallback: str) -> str:
    category = unquote(urlsplit(url).path).rsplit("Category:", 1)[-1].replace("_", " ")
    if category == urlsplit(url).path or not category.strip():
        return fallback.replace("-", " ").title()
    family, separator, given = category.partition(",")
    return f"{given.strip()} {family.strip()}".strip() if separator else category.strip()


def load_catalog() -> list[CatalogTrack]:
    payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    tracks: list[CatalogTrack] = []
    seen: set[str] = set()
    for artist_id, artist in payload["artists"].items():
        performer = performer_from_catalog_url(str(artist.get("catalogUrl", "")), artist_id)
        for work in artist.get("works", []):
            identity = str(work["id"])
            if identity in seen:
                continue
            seen.add(identity)
            tracks.append(
                CatalogTrack(
                    artist_id=artist_id,
                    work_id=str(work["id"]),
                    performer=performer,
                    title=str(work["title"]),
                )
            )
    return tracks


def load_latest_statuses(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    latest: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        latest[str(record.get("key", ""))] = str(record.get("status", ""))
    return {key: status for key, status in latest.items() if key}


def load_pending_pause(path: Path) -> tuple[datetime | None, str]:
    """Keep a VK cooldown when the worker is recreated during a planned or forced pause."""
    if not path.is_file():
        return None, ""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        state = str(payload.get("state", ""))
        if state not in {"rate_limited", "scheduled_pause"} or not payload.get("retryAt"):
            return None, ""
        retry_at = datetime.fromisoformat(str(payload["retryAt"]))
        if retry_at.tzinfo is None:
            retry_at = retry_at.replace(tzinfo=UTC)
        return (retry_at, state) if retry_at > datetime.now(UTC) else (None, "")
    except (json.JSONDecodeError, TypeError, ValueError):
        return None, ""


def load_completed(path: Path, *, retry_not_found: bool) -> set[str]:
    latest = load_latest_statuses(path)
    completed_statuses = {"sent", "cached", "published"}
    if not retry_not_found:
        completed_statuses.add("not_found")
    return {key for key, status in latest.items() if status in completed_statuses}


def append_state(path: Path, track: CatalogTrack, status: str, detail: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "checkedAt": datetime.now(UTC).isoformat(),
        "key": track.key,
        "artistId": track.artist_id,
        "workId": track.work_id,
        "performer": track.performer,
        "title": track.title,
        "query": track.query,
        "status": status,
    }
    if detail:
        record["detail"] = detail[:500]
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def write_public_status(
    *,
    state: str,
    tracks: list[CatalogTrack],
    latest_statuses: dict[str, str],
    downloaded_count: int,
    current_index: int = 0,
    current_track: CatalogTrack | None = None,
    message: str = "",
    retry_at: datetime | None = None,
) -> None:
    counts = Counter(latest_statuses.values())
    checked_count = sum(
        counts[status]
        for status in ("sent", "published", "cached", "not_found")
    )
    retry_pending_count = sum(
        counts[status]
        for status in ("error", "cache_recovery_error", "rate_limited", "retry_pending")
    )
    payload = {
        "updatedAt": datetime.now(UTC).isoformat(),
        "state": state,
        "totalCount": len(tracks),
        "currentIndex": current_index,
        "checkedCount": checked_count,
        "retryPendingCount": retry_pending_count,
        "downloadedCount": downloaded_count,
        "notFoundCount": counts["not_found"],
        "errorCount": counts["error"] + counts["cache_recovery_error"],
        "currentQuery": current_track.query if current_track else "",
        "message": message,
    }
    if retry_at:
        payload["retryAt"] = retry_at.isoformat()
    PUBLIC_STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = PUBLIC_STATUS_PATH.with_suffix(".json.part")
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(PUBLIC_STATUS_PATH)
    finally:
        temporary.unlink(missing_ok=True)


def cache_result(cache: MusicCache, track: CatalogTrack, result: dict) -> None:
    audio = result.get("audio") or {}
    file_id = str(audio.get("file_id") or "")
    if not file_id:
        raise RuntimeError("Telegram не вернул file_id")
    cache.put(
        query=track.query,
        file_id=file_id,
        file_unique_id=str(audio.get("file_unique_id") or ""),
        performer=track.performer,
        title=track.title,
        source="vk",
    )


def is_captcha_error(exc: Exception) -> bool:
    message = str(exc).casefold()
    return "captcha" in message or "error 14" in message


def is_transient_network_error(exc: Exception) -> bool:
    message = str(exc).casefold()
    return any(
        fragment in message
        for fragment in (
            "could not resolve host",
            "temporary failure in name resolution",
            "name or service not known",
            "connection timed out",
            "connection reset",
            "network is unreachable",
        )
    )


def restore_cached_audio(
    tracks: list[CatalogTrack],
    *,
    cache: MusicCache,
    sender: TelegramSender,
    state_path: Path,
    max_audio_bytes: int,
) -> None:
    """Publish already-sent Telegram files to My Spotify before new VK searches."""
    candidates: list[tuple[CatalogTrack, str]] = []
    existing = published_keys()
    cached_tracks = cache.all_by_source("vk")
    for track in tracks:
        if track.key in existing:
            continue
        cached = cached_tracks.get(normalize_query(track.query))
        if cached:
            candidates.append((track, cached.file_id))
    if not candidates:
        return

    print(f"Восстанавливаем в My Spotify {len(candidates)} MP3 из Telegram-кэша", flush=True)
    for number, (track, file_id) in enumerate(candidates, start=1):
        try:
            with tempfile.TemporaryDirectory(prefix=f"telegram-{track.artist_id}-") as directory:
                cached_path = Path(directory) / f"{track.work_id}.mp3"
                sender.download_cached(file_id, cached_path, max_bytes=max_audio_bytes)
                publish_mp3(cached_path, track)
            append_state(state_path, track, "published")
            print(
                f"[cache {number}/{len(candidates)}] published: {track.query}",
                flush=True,
            )
        except Exception as exc:
            append_state(state_path, track, "cache_recovery_error", str(exc))
            print(
                f"[cache {number}/{len(candidates)}] restore failed: {track.query}: {exc}",
                flush=True,
            )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Найти произведения каталога только в VK и отправить найденные MP3 в Telegram."
    )
    parser.add_argument("--limit", type=int, default=0, help="0 — обработать весь остаток")
    parser.add_argument("--start-at", type=int, default=1)
    parser.add_argument(
        "--delay",
        type=float,
        default=45.0,
        help="Пауза между запросами VK; более редкий опрос снижает риск повторной CAPTCHA",
    )
    parser.add_argument(
        "--jitter",
        type=float,
        default=30.0,
        help="Случайная добавка к паузе между запросами VK",
    )
    parser.add_argument(
        "--captcha-delay",
        type=float,
        default=21600,
        help="Пауза перед повтором того же запроса после CAPTCHA VK",
    )
    parser.add_argument(
        "--network-delay",
        type=float,
        default=60,
        help="Пауза перед повтором того же запроса после сетевой ошибки",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=30,
        help="Количество запросов VK между плановыми длительными паузами",
    )
    parser.add_argument(
        "--batch-pause",
        type=float,
        default=1200,
        help="Плановая пауза между пакетами запросов VK",
    )
    parser.add_argument("--retry-not-found", action="store_true")
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE_PATH)
    args = parser.parse_args()

    config = BotConfig.from_environment()
    if not config.vk_token:
        raise SystemExit("VK_TOKEN не задан: сначала выполните make vk-token")

    cache = MusicCache(config.database_path)
    cache.initialize()
    provider = VKMusicProvider(
        token=config.vk_token,
        user_agent=config.vk_user_agent,
        max_audio_bytes=config.max_audio_bytes,
        max_duration_seconds=config.max_duration_seconds,
    )
    sender = TelegramSender(config.token, config.admin_id)
    tracks = load_catalog()
    restore_cached_audio(
        tracks,
        cache=cache,
        sender=sender,
        state_path=args.state,
        max_audio_bytes=config.max_audio_bytes,
    )
    latest_statuses = load_latest_statuses(args.state)
    downloaded_count = len(published_keys())
    pending_retry_at, pending_state = load_pending_pause(PUBLIC_STATUS_PATH)
    if pending_retry_at:
        completed = load_completed(args.state, retry_not_found=args.retry_not_found)
        resume_number, resume_track = next(
            (
                (number, track)
                for number, track in enumerate(tracks, start=1)
                if track.key not in completed
            ),
            (0, None),
        )
        cooldown = max((pending_retry_at - datetime.now(UTC)).total_seconds(), 0)
        write_public_status(
            state=pending_state,
            tracks=tracks,
            latest_statuses=latest_statuses,
            downloaded_count=downloaded_count,
            current_index=resume_number,
            current_track=resume_track,
            message=(
                "Плановая пауза между пакетами VK"
                if pending_state == "scheduled_pause"
                else "Соблюдаем паузу VK, затем продолжаем автоматически"
            ),
            retry_at=pending_retry_at,
        )
        print(f"Пауза VK перед продолжением: {cooldown:.0f} сек.", flush=True)
        time.sleep(cooldown)
    else:
        write_public_status(
            state="starting",
            tracks=tracks,
            latest_statuses=latest_statuses,
            downloaded_count=downloaded_count,
            message="Подготовка очереди VK",
        )
    selected = tracks[max(args.start_at - 1, 0) :]
    if args.limit > 0:
        selected = selected[: args.limit]

    requests_since_pause = 0
    for number, track in enumerate(selected, start=max(args.start_at, 1)):
        latest_status = latest_statuses.get(track.key)
        if latest_status == "not_found" and not args.retry_not_found:
            continue
        if latest_status in {"sent", "cached", "published"} and is_published(track):
            continue
        cached = cache.get(track.query)
        if cached and cached.source == "vk" and is_published(track):
            append_state(args.state, track, "cached")
            latest_statuses[track.key] = "cached"
            print(f"[{number}/{len(tracks)}] cache: {track.query}", flush=True)
            continue

        while True:
            try:
                if args.batch_size > 0 and requests_since_pause >= args.batch_size:
                    delay = max(args.batch_pause, 60)
                    retry_at = datetime.now(UTC) + timedelta(seconds=delay)
                    write_public_status(
                        state="scheduled_pause",
                        tracks=tracks,
                        latest_statuses=latest_statuses,
                        downloaded_count=downloaded_count,
                        current_index=number,
                        current_track=track,
                        message="Плановая пауза между пакетами VK",
                        retry_at=retry_at,
                    )
                    print(
                        f"Плановая пауза VK после {requests_since_pause} запросов: {delay:.0f} сек.",
                        flush=True,
                    )
                    time.sleep(delay)
                    requests_since_pause = 0
                write_public_status(
                    state="searching",
                    tracks=tracks,
                    latest_statuses=latest_statuses,
                    downloaded_count=downloaded_count,
                    current_index=number,
                    current_track=track,
                    message="Поиск точного совпадения в VK",
                )
                requests_since_pause += 1
                with tempfile.TemporaryDirectory(prefix=f"vk-{track.artist_id}-") as directory:
                    downloaded = provider.download(
                        track.query,
                        Path(directory),
                        expected_performer=track.performer,
                        expected_title=track.title,
                    )
                    if downloaded is None:
                        append_state(args.state, track, "not_found")
                        latest_statuses[track.key] = "not_found"
                        write_public_status(
                            state="running",
                            tracks=tracks,
                            latest_statuses=latest_statuses,
                            downloaded_count=downloaded_count,
                            current_index=number,
                            current_track=track,
                            message="Точное совпадение не найдено, переходим дальше",
                        )
                        print(f"[{number}/{len(tracks)}] not found: {track.query}", flush=True)
                        break

                    published_path = publish_mp3(
                        downloaded.path,
                        track,
                        duration_seconds=downloaded.duration,
                    )
                    downloaded_count = len(published_keys())
                    print(
                        f"[{number}/{len(tracks)}] My Spotify: {published_path.relative_to(ROOT)}",
                        flush=True,
                    )
                    if cached and cached.source == "vk":
                        append_state(args.state, track, "published")
                        latest_statuses[track.key] = "published"
                        write_public_status(
                            state="running",
                            tracks=tracks,
                            latest_statuses=latest_statuses,
                            downloaded_count=downloaded_count,
                            current_index=number,
                            current_track=track,
                            message="MP3 добавлен в карточку My Spotify",
                        )
                        print(f"[{number}/{len(tracks)}] cache linked: {track.query}", flush=True)
                        break

                    result = sender.upload(downloaded.path, track, caption="Источник: VK")
                cache_result(cache, track, result)
                append_state(args.state, track, "sent")
                latest_statuses[track.key] = "sent"
                write_public_status(
                    state="running",
                    tracks=tracks,
                    latest_statuses=latest_statuses,
                    downloaded_count=downloaded_count,
                    current_index=number,
                    current_track=track,
                    message="MP3 добавлен в карточку и отправлен в Telegram",
                )
                print(f"[{number}/{len(tracks)}] sent: {track.query}", flush=True)
                break
            except Exception as exc:
                if is_captcha_error(exc):
                    delay = max(args.captcha_delay, 60)
                    append_state(args.state, track, "rate_limited", str(exc))
                    latest_statuses[track.key] = "rate_limited"
                    retry_at = datetime.now(UTC) + timedelta(seconds=delay)
                    write_public_status(
                        state="rate_limited",
                        tracks=tracks,
                        latest_statuses=latest_statuses,
                        downloaded_count=downloaded_count,
                        current_index=number,
                        current_track=track,
                        message="VK запросил CAPTCHA; очередь продолжит автоматически",
                        retry_at=retry_at,
                    )
                    print(
                        f"[{number}/{len(tracks)}] VK CAPTCHA; повтор этого запроса через {delay:.0f} сек.",
                        flush=True,
                    )
                    time.sleep(delay)
                    continue
                if is_transient_network_error(exc):
                    delay = max(args.network_delay, 10)
                    append_state(args.state, track, "retry_pending", str(exc))
                    latest_statuses[track.key] = "retry_pending"
                    retry_at = datetime.now(UTC) + timedelta(seconds=delay)
                    write_public_status(
                        state="network_wait",
                        tracks=tracks,
                        latest_statuses=latest_statuses,
                        downloaded_count=downloaded_count,
                        current_index=number,
                        current_track=track,
                        message="Нет соединения с VK; повторяем ту же позицию",
                        retry_at=retry_at,
                    )
                    print(
                        f"[{number}/{len(tracks)}] сеть недоступна; повтор через {delay:.0f} сек.",
                        flush=True,
                    )
                    time.sleep(delay)
                    continue
                append_state(args.state, track, "error", str(exc))
                latest_statuses[track.key] = "error"
                write_public_status(
                    state="running",
                    tracks=tracks,
                    latest_statuses=latest_statuses,
                    downloaded_count=downloaded_count,
                    current_index=number,
                    current_track=track,
                    message="Ошибка этой записи, переходим к следующей",
                )
                print(f"[{number}/{len(tracks)}] ERROR {track.query}: {exc}", flush=True)
                break
        jitter = random.uniform(0, max(args.jitter, 0))
        time.sleep(max(args.delay, 0) + jitter)

    write_public_status(
        state="complete",
        tracks=tracks,
        latest_statuses=latest_statuses,
        downloaded_count=downloaded_count,
        current_index=len(tracks),
        message="Первый проход каталога завершён",
    )


if __name__ == "__main__":
    main()

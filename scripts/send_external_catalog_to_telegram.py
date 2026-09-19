from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

from scripts.send_featured_catalog_to_telegram import (
    TRACKS,
    FeaturedTrack,
    TelegramSender,
)
from telegram_music_bot.config import BotConfig
from telegram_music_bot.database import MusicCache
from telegram_music_bot.downloader import MusicDownloader


def replace_cache(
    cache: MusicCache,
    track: FeaturedTrack,
    result: dict,
    *,
    source: str,
    source_url: str,
) -> None:
    audio = result.get("audio") or {}
    file_id = str(audio.get("file_id") or "")
    if not file_id:
        raise RuntimeError("Telegram не вернул file_id")
    for query in track.aliases:
        cache.put(
            query=query,
            file_id=file_id,
            file_unique_id=str(audio.get("file_unique_id") or ""),
            performer=track.performer,
            title=track.title,
            source=source,
            source_url=source_url,
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=len(TRACKS))
    parser.add_argument("--start-at", type=int, default=1)
    args = parser.parse_args()

    config = BotConfig.from_environment()
    cache = MusicCache(config.database_path)
    cache.initialize()
    downloader = MusicDownloader(
        providers=config.providers,
        vk_token=config.vk_token,
        vk_user_agent=config.vk_user_agent,
        max_audio_bytes=config.max_audio_bytes,
        max_duration_seconds=config.max_duration_seconds,
    )
    sender = TelegramSender(config.token, config.admin_id)
    selected = TRACKS[max(args.start_at - 1, 0) :][: max(args.limit, 0)]

    for number, track in enumerate(selected, start=args.start_at):
        cached = cache.get(track.query)
        if cached and cached.source != "local-catalog":
            try:
                result = sender.send_cached(cached.file_id, track)
                replace_cache(
                    cache,
                    track,
                    result,
                    source=cached.source,
                    source_url=cached.source_url,
                )
                print(f"[{number}/{len(TRACKS)}] cache: {track.query}", flush=True)
                continue
            except Exception as exc:
                print(f"[{number}/{len(TRACKS)}] stale cache: {exc}", flush=True)

        for alias in track.aliases:
            cache.delete(alias)
        try:
            with tempfile.TemporaryDirectory(prefix=f"external-{track.artist_id}-") as directory:
                downloaded = downloader.download(track.query, Path(directory))
                result = sender.upload(
                    downloaded.path,
                    track,
                    caption=f"Источник: {downloaded.source}",
                )
            replace_cache(
                cache,
                track,
                result,
                source=downloaded.source,
                source_url=downloaded.source_url,
            )
            print(
                f"[{number}/{len(TRACKS)}] sent from {downloaded.source}: {track.query}",
                flush=True,
            )
        except Exception as exc:
            print(f"[{number}/{len(TRACKS)}] ERROR {track.query}: {exc}", flush=True)


if __name__ == "__main__":
    main()

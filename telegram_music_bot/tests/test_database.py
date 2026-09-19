from pathlib import Path

import pytest

from telegram_music_bot.database import MusicCache, normalize_query


def test_query_normalization() -> None:
    assert normalize_query("  IMAGINE   Dragons — Believer ") == "imagine dragons — believer"


def test_cache_round_trip_update_and_delete(tmp_path: Path) -> None:
    cache = MusicCache(tmp_path / "nested" / "cache.sqlite3")
    cache.initialize()

    cache.put(
        query="Imagine Dragons - Believer",
        file_id="telegram-file-1",
        file_unique_id="unique-1",
        performer="Imagine Dragons",
        title="Believer",
        source="youtube",
        source_url="https://youtube.com/watch?v=abcdefghijk",
    )
    cached = cache.get("  imagine dragons - BELIEVER ")
    assert cached is not None
    assert cached.file_id == "telegram-file-1"
    assert cached.title == "Believer"

    cache.put(query="Imagine Dragons - Believer", file_id="telegram-file-2")
    updated = cache.get("Imagine Dragons - Believer")
    assert updated is not None
    assert updated.file_id == "telegram-file-2"

    cache.delete("Imagine Dragons - Believer")
    assert cache.get("Imagine Dragons - Believer") is None


def test_cache_rejects_empty_keys(tmp_path: Path) -> None:
    cache = MusicCache(tmp_path / "cache.sqlite3")
    cache.initialize()

    with pytest.raises(ValueError, match="query"):
        cache.put(query=" ", file_id="file")

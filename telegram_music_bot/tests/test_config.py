from pathlib import Path

import pytest

from telegram_music_bot.config import BotConfig, ConfigurationError


def test_config_requires_admin_id(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("telegram_music_bot.config.ROOT", tmp_path)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456:abcdefghijklmnopqrstuvwxyzABCDE")
    monkeypatch.delenv("ADMIN_ID", raising=False)

    with pytest.raises(ConfigurationError, match="ADMIN_ID"):
        BotConfig.from_environment()


def test_config_loads_provider_order_and_limits(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr("telegram_music_bot.config.ROOT", tmp_path)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456:abcdefghijklmnopqrstuvwxyzABCDE")
    monkeypatch.setenv("ADMIN_ID", "123456789")
    monkeypatch.setenv("VK_TOKEN", "vk-token")
    monkeypatch.setenv("MUSIC_SEARCH_PROVIDERS", "vk,youtube,soundcloud")
    monkeypatch.setenv("TELEGRAM_MAX_AUDIO_MB", "40")
    monkeypatch.setenv("BOT_DATABASE_PATH", str(tmp_path / "cache.sqlite3"))

    config = BotConfig.from_environment()

    assert config.admin_id == 123456789
    assert config.providers == ("vk", "youtube", "soundcloud")
    assert config.max_audio_bytes == 40 * 1024 * 1024
    assert config.database_path == tmp_path / "cache.sqlite3"

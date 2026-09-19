from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import environ

ROOT = Path(__file__).resolve().parent.parent


class ConfigurationError(ValueError):
    pass


def _positive_int(name: str, default: int | None = None) -> int:
    raw = os.getenv(name, "" if default is None else str(default)).strip()
    if not raw:
        raise ConfigurationError(f"Заполните {name} в файле .env")
    try:
        value = int(raw)
    except ValueError as exc:
        raise ConfigurationError(f"{name} должен быть целым числом") from exc
    if value <= 0:
        raise ConfigurationError(f"{name} должен быть больше нуля")
    return value


def _providers() -> tuple[str, ...]:
    supported = {"vk", "youtube", "soundcloud"}
    values = tuple(
        item.strip().casefold()
        for item in os.getenv("MUSIC_SEARCH_PROVIDERS", "vk,youtube,soundcloud").split(",")
        if item.strip()
    )
    unknown = sorted(set(values) - supported)
    if unknown:
        raise ConfigurationError("Неизвестные MUSIC_SEARCH_PROVIDERS: " + ", ".join(unknown))
    if not values:
        raise ConfigurationError("MUSIC_SEARCH_PROVIDERS не должен быть пустым")
    return values


@dataclass(frozen=True)
class BotConfig:
    token: str
    admin_id: int
    database_path: Path
    vk_token: str
    vk_user_agent: str
    providers: tuple[str, ...]
    max_audio_bytes: int
    max_duration_seconds: int
    max_concurrent_downloads: int

    @classmethod
    def from_environment(cls) -> BotConfig:
        env_path = ROOT / ".env"
        if env_path.is_file():
            environ.Env.read_env(env_path, overwrite=False)

        token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        if not token:
            raise ConfigurationError("Заполните TELEGRAM_BOT_TOKEN в файле .env")

        database_path = Path(
            os.getenv("BOT_DATABASE_PATH", "data/music_cache.sqlite3")
        ).expanduser()
        if not database_path.is_absolute():
            database_path = ROOT / database_path
        return cls(
            token=token,
            admin_id=_positive_int("ADMIN_ID"),
            database_path=database_path,
            vk_token=os.getenv("VK_TOKEN", "").strip(),
            vk_user_agent=os.getenv(
                "VK_USER_AGENT",
                "VKAndroidApp/8.82-19243 (Android 14; SDK 34; arm64-v8a)",
            ).strip(),
            providers=_providers(),
            max_audio_bytes=_positive_int("TELEGRAM_MAX_AUDIO_MB", 49) * 1024 * 1024,
            max_duration_seconds=_positive_int("MUSIC_MAX_DURATION_SECONDS", 1200),
            max_concurrent_downloads=_positive_int("TELEGRAM_MAX_CONCURRENT_DOWNLOADS", 1),
        )

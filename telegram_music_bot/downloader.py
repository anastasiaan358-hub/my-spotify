from __future__ import annotations

import ipaddress
import logging
import re
import socket
import subprocess
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlsplit

LOGGER = logging.getLogger(__name__)
INVALID_FILENAME = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


class MusicDownloadError(RuntimeError):
    pass


@dataclass(frozen=True)
class DownloadedTrack:
    path: Path
    performer: str
    title: str
    duration: int | None
    source: str
    source_url: str

    @property
    def filename(self) -> str:
        return track_filename(self.performer, self.title)


def normalize_match_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).casefold()
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = re.sub(r"[^\w]+", " ", value, flags=re.UNICODE)
    return " ".join(value.split())


def is_exact_track_match(query: str, artist: str, title: str) -> bool:
    query_key = normalize_match_text(query)
    artist_key = normalize_match_text(artist)
    title_key = normalize_match_text(title)
    if not query_key or not title_key:
        return False
    return query_key in {
        artist_key,
        title_key,
        f"{artist_key} {title_key}".strip(),
        f"{title_key} {artist_key}".strip(),
    }


def is_catalog_track_match(
    expected_performer: str,
    expected_title: str,
    candidate_artist: str,
    candidate_title: str,
) -> bool:
    target_title = normalize_match_text(expected_title)
    actual_title = normalize_match_text(candidate_title)
    if not target_title or not actual_title:
        return False

    # В классических релизах поле artist часто содержит ансамбль или дирижёра,
    # хотя поиск VK был выполнен с именем композитора. Полное совпадение названия
    # в таком случае достаточно надёжно и позволяет не терять эти записи.
    if actual_title == target_title:
        return True

    performer = normalize_match_text(expected_performer)
    surname = performer.split()[-1] if performer else ""
    candidate = normalize_match_text(f"{candidate_artist} {candidate_title}")
    composer_is_named = bool(
        performer and (performer in candidate or (len(surname) >= 4 and surname in candidate))
    )
    return composer_is_named and (
        actual_title.startswith(f"{target_title} ")
        or actual_title.endswith(f" {target_title}")
        or f" {target_title} " in f" {actual_title} "
    )


def track_filename(performer: str, title: str) -> str:
    stem = f"{performer} - {title}" if performer else title
    stem = INVALID_FILENAME.sub("_", " ".join(stem.split())).strip(". ")
    return f"{stem[:180] or 'track'}.mp3"


def _assert_public_url(url: str) -> None:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").casefold()
    if parsed.scheme not in {"http", "https"} or not host:
        raise MusicDownloadError("Источник вернул некорректную ссылку")
    try:
        addresses = {ipaddress.ip_address(host)}
    except ValueError:
        try:
            records = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise MusicDownloadError("Не удалось определить адрес источника") from exc
        addresses = {ipaddress.ip_address(record[4][0]) for record in records}
    if not addresses or any(not address.is_global for address in addresses):
        raise MusicDownloadError("Источник вернул локальный или служебный адрес")


class VKMusicProvider:
    def __init__(
        self,
        *,
        token: str,
        user_agent: str,
        max_audio_bytes: int,
        max_duration_seconds: int,
    ) -> None:
        self.token = token
        self.user_agent = user_agent
        self.max_audio_bytes = max_audio_bytes
        self.max_duration_seconds = max_duration_seconds

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def download(
        self,
        query: str,
        destination: Path,
        *,
        expected_performer: str = "",
        expected_title: str = "",
    ) -> DownloadedTrack | None:
        if not self.enabled:
            return None
        try:
            from vkpymusic import Service
        except ImportError as exc:
            raise MusicDownloadError("Библиотека vkpymusic не установлена") from exc

        service = Service(self.user_agent, self.token)
        songs = service.search_songs_by_text(query, count=5)
        song = next(
            (
                item
                for item in songs
                if is_exact_track_match(query, str(item.artist), str(item.title))
                or (
                    expected_title
                    and is_catalog_track_match(
                        expected_performer,
                        expected_title,
                        str(item.artist),
                        str(item.title),
                    )
                )
            ),
            None,
        )
        if song is None or not str(song.url).strip():
            return None
        if song.duration and int(song.duration) > self.max_duration_seconds:
            raise MusicDownloadError("Запись ВК слишком длинная")

        destination.mkdir(parents=True, exist_ok=True)
        source_url = str(song.url)
        output_path = destination / track_filename(str(song.artist), str(song.title))
        if "index.m3u8" in source_url or urlsplit(source_url).path.endswith(".m3u8"):
            _assert_public_url(source_url)
            duration = int(song.duration) if song.duration else self.max_duration_seconds
            _convert_to_mp3(
                source_url,
                output_path,
                user_agent=self.user_agent,
                timeout_seconds=max(300, min(duration + 180, self.max_duration_seconds + 180)),
            )
        else:
            source_path = destination / "vk-source.audio"
            self._download_file(source_url, source_path)
            if _looks_like_mp3(source_path):
                source_path.replace(output_path)
            else:
                _convert_to_mp3(source_path, output_path)
        _validate_output(output_path, self.max_audio_bytes)
        return DownloadedTrack(
            path=output_path,
            performer=str(song.artist)[:64],
            title=str(song.title)[:64],
            duration=int(song.duration) if song.duration else None,
            source="vk",
            # VK выдаёт временный подписанный URL; не сохраняем его в SQLite.
            source_url="",
        )

    def _download_file(self, url: str, path: Path) -> None:
        import httpx

        try:
            with httpx.Client(
                follow_redirects=False,
                timeout=httpx.Timeout(30, read=120),
                headers={"User-Agent": self.user_agent},
            ) as client:
                current_url = url
                for _ in range(6):
                    _assert_public_url(current_url)
                    with client.stream("GET", current_url) as response:
                        if response.status_code in {301, 302, 303, 307, 308}:
                            location = response.headers.get("location")
                            if not location:
                                raise MusicDownloadError("ВК вернул редирект без адреса")
                            current_url = urljoin(current_url, location)
                            continue
                        response.raise_for_status()
                        declared_size = int(response.headers.get("content-length", "0"))
                        if declared_size > self.max_audio_bytes:
                            raise MusicDownloadError("Файл ВК превышает лимит Telegram")
                        size = 0
                        with path.open("wb") as handle:
                            for chunk in response.iter_bytes():
                                size += len(chunk)
                                if size > self.max_audio_bytes:
                                    raise MusicDownloadError("Файл ВК превышает лимит Telegram")
                                handle.write(chunk)
                        return
                raise MusicDownloadError("ВК вернул слишком много перенаправлений")
        except MusicDownloadError:
            raise
        except httpx.HTTPError as exc:
            raise MusicDownloadError(f"ВК не отдал аудиофайл: {exc}") from exc


class YtDlpMusicProvider:
    SEARCH_PREFIXES = {
        "youtube": "ytsearch1:",
        "soundcloud": "scsearch1:",
    }

    def __init__(
        self,
        *,
        provider: str,
        max_audio_bytes: int,
        max_duration_seconds: int,
    ) -> None:
        self.provider = provider
        self.max_audio_bytes = max_audio_bytes
        self.max_duration_seconds = max_duration_seconds

    def download(self, query: str, destination: Path) -> DownloadedTrack:
        import yt_dlp

        prefix = self.SEARCH_PREFIXES[self.provider]
        destination.mkdir(parents=True, exist_ok=True)

        def reject_unsuitable(info: dict, *, incomplete: bool) -> str | None:
            if incomplete:
                return None
            if info.get("is_live"):
                return "Прямые эфиры не поддерживаются"
            duration = info.get("duration")
            if duration and duration > self.max_duration_seconds:
                return "Запись слишком длинная"
            return None

        options = {
            "format": "bestaudio/best",
            "outtmpl": str(destination / "%(id)s.%(ext)s"),
            "noplaylist": True,
            "max_filesize": self.max_audio_bytes,
            "match_filter": reject_unsuitable,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "320",
                }
            ],
            "retries": 3,
            "fragment_retries": 3,
            "extractor_retries": 3,
            "socket_timeout": 30,
            "quiet": True,
            "noprogress": True,
            "no_warnings": True,
            "cachedir": False,
            "overwrites": True,
        }
        try:
            with yt_dlp.YoutubeDL(options) as ydl:
                result = ydl.extract_info(f"{prefix}{query}", download=True)
        except yt_dlp.utils.DownloadError as exc:
            message = str(exc).removeprefix("ERROR: ").strip()
            raise MusicDownloadError(message or f"{self.provider} не нашёл запись") from exc

        info = _first_entry(result)
        mp3_files = sorted(destination.glob("*.mp3"), key=lambda item: item.stat().st_mtime)
        if not mp3_files:
            raise MusicDownloadError("ffmpeg не создал MP3")

        performer = str(
            info.get("artist")
            or info.get("creator")
            or info.get("uploader")
            or info.get("channel")
            or ""
        )[:64]
        title = str(info.get("track") or info.get("title") or query)[:64]
        output_path = destination / track_filename(performer, title)
        latest = mp3_files[-1]
        if latest != output_path:
            latest.replace(output_path)
        _validate_output(output_path, self.max_audio_bytes)
        duration = info.get("duration")
        return DownloadedTrack(
            path=output_path,
            performer=performer,
            title=title,
            duration=int(duration) if duration else None,
            source=self.provider,
            source_url=str(info.get("webpage_url") or info.get("original_url") or ""),
        )


class MusicDownloader:
    def __init__(
        self,
        *,
        providers: tuple[str, ...],
        vk_token: str,
        vk_user_agent: str,
        max_audio_bytes: int,
        max_duration_seconds: int,
    ) -> None:
        self.providers = providers
        self.vk = VKMusicProvider(
            token=vk_token,
            user_agent=vk_user_agent,
            max_audio_bytes=max_audio_bytes,
            max_duration_seconds=max_duration_seconds,
        )
        self.max_audio_bytes = max_audio_bytes
        self.max_duration_seconds = max_duration_seconds

    def download(self, query: str, destination: Path) -> DownloadedTrack:
        attempted: list[str] = []
        for provider in self.providers:
            if provider == "vk" and not self.vk.enabled:
                continue
            attempted.append(provider)
            provider_destination = destination / provider
            try:
                if provider == "vk":
                    track = self.vk.download(query, provider_destination)
                    if track is not None:
                        return track
                    continue
                track = YtDlpMusicProvider(
                    provider=provider,
                    max_audio_bytes=self.max_audio_bytes,
                    max_duration_seconds=self.max_duration_seconds,
                ).download(query, provider_destination)
                return track
            except Exception as exc:  # каждый источник обязан уступить следующему
                LOGGER.warning("Music provider %s failed: %s", provider, exc)
        if not attempted:
            raise MusicDownloadError("Нет настроенных источников поиска")
        raise MusicDownloadError("Запись не найдена. Проверены: " + ", ".join(attempted))


def _first_entry(info: dict) -> dict:
    entries = info.get("entries")
    if entries is not None:
        first = next((entry for entry in entries if entry), None)
        if first is None:
            raise MusicDownloadError("Поиск не вернул результатов")
        return first
    return info


def _looks_like_mp3(path: Path) -> bool:
    with path.open("rb") as handle:
        head = handle.read(3)
    return head == b"ID3" or (len(head) >= 2 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0)


def _convert_to_mp3(
    source: Path | str,
    destination: Path,
    *,
    user_agent: str = "",
    timeout_seconds: int = 300,
) -> None:
    command = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
    ]
    if user_agent:
        command.extend(["-user_agent", user_agent])
    command.extend(
        [
            "-i",
            str(source),
            "-vn",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "320k",
            str(destination),
        ]
    )
    try:
        subprocess.run(command, check=True, capture_output=True, timeout=timeout_seconds)
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        raise MusicDownloadError("ffmpeg не смог создать MP3") from exc


def _validate_output(path: Path, max_audio_bytes: int) -> None:
    if not path.is_file() or path.stat().st_size == 0:
        raise MusicDownloadError("Источник не создал аудиофайл")
    if path.stat().st_size > max_audio_bytes:
        raise MusicDownloadError("Готовый MP3 превышает лимит Telegram")

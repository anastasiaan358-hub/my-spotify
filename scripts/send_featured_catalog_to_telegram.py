from __future__ import annotations

import argparse
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import requests

from telegram_music_bot.config import BotConfig
from telegram_music_bot.database import MusicCache
from telegram_music_bot.downloader import track_filename

ROOT = Path(__file__).resolve().parent.parent
AUDIO_ROOT = ROOT / "frontend/public/classical/audio"
SOUNDFONT = Path("/usr/share/sounds/sf2/FluidR3_GM.sf2")


@dataclass(frozen=True)
class FeaturedTrack:
    artist_id: str
    performer: str
    performer_ru: str
    title: str

    @property
    def query(self) -> str:
        return f"{self.performer} - {self.title}"

    @property
    def aliases(self) -> tuple[str, ...]:
        return (self.query, f"{self.performer_ru} - {self.title}", self.title)


TRACKS = (
    FeaturedTrack("allegri", "Gregorio Allegri", "Грегорио Аллегри", "Miserere mei, Deus"),
    FeaturedTrack("arbeau", "Thoinot Arbeau", "Туано Арбо", "Belle qui tiens ma vie"),
    FeaturedTrack("dowland", "John Dowland", "Джон Доуленд", "Come Again"),
    FeaturedTrack("galilei", "Vincenzo Galilei", "Винченцо Галилей", "Saltarello"),
    FeaturedTrack(
        "gastoldi",
        "Giovanni Giacomo Gastoldi",
        "Джованни Гастольди",
        "Al mormorar de' liquidi cristalli",
    ),
    FeaturedTrack("gesualdo", "Carlo Gesualdo", "Карло Джезуальдо", "Dolcissima mia vita"),
    FeaturedTrack("gibbons", "Orlando Gibbons", "Орландо Гиббонс", "The Silver Swan"),
    FeaturedTrack("janequin", "Clément Janequin", "Клеман Жанекен", "Le Chant des Oyseaux"),
    FeaturedTrack("japart", "Johannes Japart", "Йоханнес Япарт", "Tmeiskin"),
    FeaturedTrack("lassus", "Orlando di Lasso", "Орландо ди Лассо", "Sibylla Samia"),
    FeaturedTrack("marenzio", "Luca Marenzio", "Лука Маренцио", "Solo e pensoso"),
    FeaturedTrack("milan", "Luis de Milán", "Луис де Милан", "Pavana II"),
    FeaturedTrack(
        "philippe-de-monte",
        "Philippe de Monte",
        "Филипп де Монте",
        "Amor, che sol dei cor leggiadri ha cura",
    ),
    FeaturedTrack("josquin", "Josquin des Prez", "Жоскен Депре", "El Grillo"),
    FeaturedTrack(
        "scheidemann",
        "Heinrich Scheidemann",
        "Генрих Шейдеман",
        "Praeambulum no. 3 in D",
    ),
    FeaturedTrack("tallis", "Thomas Tallis", "Томас Таллис", "If Ye Love Me"),
    FeaturedTrack(
        "victoria",
        "Tomás Luis de Victoria",
        "Томас Луис де Виктория",
        "O Magnum Mysterium",
    ),
    FeaturedTrack("monteverdi", "Claudio Monteverdi", "Клаудио Монтеверди", "T'amo mia vita"),
    FeaturedTrack(
        "frescobaldi",
        "Girolamo Frescobaldi",
        "Джироламо Фрескобальди",
        "Toccata avanti la Messa della Domenica",
    ),
    FeaturedTrack(
        "praetorius",
        "Michael Praetorius",
        "Михаэль Преториус",
        "Es ist ein Ros entsprungen",
    ),
)


class TelegramSender:
    def __init__(self, token: str, chat_id: int) -> None:
        self.base_url = f"https://api.telegram.org/bot{token}"
        self.file_base_url = f"https://api.telegram.org/file/bot{token}"
        self.chat_id = chat_id

    def send_cached(self, file_id: str, track: FeaturedTrack) -> dict:
        response = requests.post(
            f"{self.base_url}/sendAudio",
            data={
                "chat_id": self.chat_id,
                "audio": file_id,
                "performer": track.performer,
                "title": track.title,
            },
            timeout=60,
        )
        return _telegram_result(response)

    def upload(
        self,
        path: Path,
        track: FeaturedTrack,
        *,
        caption: str = "My Spotify · локальный каталог",
    ) -> dict:
        with path.open("rb") as handle:
            response = requests.post(
                f"{self.base_url}/sendAudio",
                data={
                    "chat_id": self.chat_id,
                    "performer": track.performer,
                    "title": track.title,
                    "caption": caption,
                },
                files={"audio": (path.name, handle, "audio/mpeg")},
                timeout=240,
            )
        return _telegram_result(response)

    def download_cached(self, file_id: str, destination: Path, *, max_bytes: int) -> Path:
        """Download a Telegram-cached audio without exposing the bot token or URL."""
        metadata_response = requests.get(
            f"{self.base_url}/getFile",
            params={"file_id": file_id},
            timeout=60,
        )
        metadata = _telegram_result(metadata_response)
        file_path = str(metadata.get("file_path") or "")
        if not file_path:
            raise RuntimeError("Telegram не вернул путь к кэшированному MP3")
        declared_size = int(metadata.get("file_size") or 0)
        if declared_size > max_bytes:
            raise RuntimeError("Кэшированный MP3 превышает допустимый размер")

        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(destination.suffix + ".part")
        size = 0
        try:
            with requests.get(
                f"{self.file_base_url}/{file_path}",
                stream=True,
                timeout=(30, 180),
            ) as response:
                if not response.ok:
                    raise RuntimeError(f"Telegram file download: HTTP {response.status_code}")
                with temporary.open("wb") as handle:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        if not chunk:
                            continue
                        size += len(chunk)
                        if size > max_bytes:
                            raise RuntimeError("Кэшированный MP3 превышает допустимый размер")
                        handle.write(chunk)
            if size == 0:
                raise RuntimeError("Telegram вернул пустой MP3")
            temporary.replace(destination)
        finally:
            temporary.unlink(missing_ok=True)
        return destination


def _telegram_result(response: requests.Response) -> dict:
    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(f"Telegram API: HTTP {response.status_code}") from exc
    if not payload.get("ok"):
        raise RuntimeError(payload.get("description") or "Telegram API error")
    return payload["result"]


def prepare_mp3(track: FeaturedTrack, destination: Path) -> Path:
    ogg = AUDIO_ROOT / f"{track.artist_id}.ogg"
    midi = AUDIO_ROOT / f"{track.artist_id}.mid"
    output = destination / track_filename(track.performer, track.title)
    if ogg.is_file():
        _run_ffmpeg(ogg, output)
        return output
    if not midi.is_file():
        raise FileNotFoundError(f"Нет локального аудио или MIDI: {track.artist_id}")
    if not SOUNDFONT.is_file():
        raise FileNotFoundError(f"SoundFont не найден: {SOUNDFONT}")
    wav = destination / f"{track.artist_id}.wav"
    subprocess.run(
        [
            "fluidsynth",
            "-ni",
            str(SOUNDFONT),
            str(midi),
            "-F",
            str(wav),
            "-r",
            "44100",
        ],
        check=True,
        timeout=600,
        capture_output=True,
    )
    _run_ffmpeg(wav, output)
    return output


def _run_ffmpeg(source: Path, output: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-vn",
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "320k",
            str(output),
        ],
        check=True,
        timeout=600,
        capture_output=True,
    )


def cache_result(cache: MusicCache, track: FeaturedTrack, result: dict) -> None:
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
            source="local-catalog",
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=len(TRACKS))
    parser.add_argument("--start-at", type=int, default=1)
    args = parser.parse_args()

    config = BotConfig.from_environment()
    cache = MusicCache(config.database_path)
    cache.initialize()
    sender = TelegramSender(config.token, config.admin_id)
    selected = TRACKS[max(args.start_at - 1, 0) :][: max(args.limit, 0)]

    for number, track in enumerate(selected, start=args.start_at):
        cached = cache.get(track.query)
        try:
            if cached:
                result = sender.send_cached(cached.file_id, track)
                cache_result(cache, track, result)
                print(f"[{number}/{len(TRACKS)}] cache: {track.query}", flush=True)
                continue
            with tempfile.TemporaryDirectory(prefix=f"catalog-{track.artist_id}-") as directory:
                output = prepare_mp3(track, Path(directory))
                if output.stat().st_size > config.max_audio_bytes:
                    raise RuntimeError("MP3 превышает лимит Telegram")
                result = sender.upload(output, track)
            cache_result(cache, track, result)
            print(f"[{number}/{len(TRACKS)}] sent: {track.query}", flush=True)
        except Exception as exc:
            print(f"[{number}/{len(TRACKS)}] ERROR {track.query}: {exc}", flush=True)


if __name__ == "__main__":
    main()

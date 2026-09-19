import socket
from pathlib import Path

import pytest

from telegram_music_bot.downloader import (
    DownloadedTrack,
    MusicDownloader,
    MusicDownloadError,
    _assert_public_url,
    _first_entry,
    _looks_like_mp3,
    is_catalog_track_match,
    is_exact_track_match,
    normalize_match_text,
    track_filename,
)


def test_normalize_match_text_ignores_case_accents_and_punctuation() -> None:
    assert normalize_match_text("  Björk — Jóga! ") == "bjork joga"


@pytest.mark.parametrize(
    ("query", "artist", "title"),
    [
        ("Imagine Dragons - Believer", "Imagine Dragons", "Believer"),
        ("Believer", "Imagine Dragons", "Believer"),
        ("Imagine Dragons", "Imagine Dragons", "Believer"),
        ("Бах Токката и фуга", "Бах", "Токката и фуга"),
        ("Токката и фуга Бах", "Бах", "Токката и фуга"),
    ],
)
def test_exact_track_match(query: str, artist: str, title: str) -> None:
    assert is_exact_track_match(query, artist, title)


def test_exact_track_match_rejects_partial_result() -> None:
    assert not is_exact_track_match("Believer remix", "Imagine Dragons", "Believer")


def test_catalog_match_accepts_ensemble_when_work_title_is_exact() -> None:
    assert is_catalog_track_match(
        "Gregorio Allegri",
        "Beatus vir",
        "A Sei Voci / Bernard Fabre-Garrus",
        "Beatus vir",
    )


def test_catalog_match_requires_composer_for_extended_title() -> None:
    assert is_catalog_track_match(
        "Gregorio Allegri",
        "Incipit lamentatio",
        "Gregorio Allegri",
        "Incipit lamentatio Jeremiae prophetae (The Cardinall's Musick)",
    )
    assert not is_catalog_track_match(
        "Gregorio Allegri",
        "Dixit Dominus",
        "Antonio Vivaldi",
        "Dixit Dominus RV 594: 1. Allegro",
    )


def test_track_filename_is_safe_and_bounded() -> None:
    filename = track_filename("Artist/Name", "A:Title?" * 40)
    assert filename.startswith("Artist_Name - A_Title_")
    assert filename.endswith(".mp3")
    assert len(filename.removesuffix(".mp3")) <= 180
    assert "/" not in filename


def test_first_entry_skips_empty_search_items() -> None:
    assert _first_entry({"entries": [None, {"id": "ok"}]}) == {"id": "ok"}


def test_first_entry_rejects_empty_search() -> None:
    with pytest.raises(MusicDownloadError):
        _first_entry({"entries": []})


def test_mp3_signature_detection(tmp_path: Path) -> None:
    tagged = tmp_path / "tagged"
    tagged.write_bytes(b"ID3payload")
    framed = tmp_path / "framed"
    framed.write_bytes(b"\xff\xfbpayload")
    other = tmp_path / "other"
    other.write_bytes(b"OggS")

    assert _looks_like_mp3(tagged)
    assert _looks_like_mp3(framed)
    assert not _looks_like_mp3(other)


def test_public_url_rejects_domain_resolving_to_localhost(monkeypatch) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))],
    )
    with pytest.raises(MusicDownloadError):
        _assert_public_url("https://public-looking.example/audio.mp3")


def test_downloader_falls_back_after_vk_error(monkeypatch, tmp_path: Path) -> None:
    downloader = MusicDownloader(
        providers=("vk", "youtube"),
        vk_token="token",
        vk_user_agent="agent",
        max_audio_bytes=1_000_000,
        max_duration_seconds=600,
    )
    monkeypatch.setattr(
        downloader.vk,
        "download",
        lambda query, destination: (_ for _ in ()).throw(RuntimeError("VK unavailable")),
    )
    expected = DownloadedTrack(
        path=tmp_path / "youtube" / "track.mp3",
        performer="Artist",
        title="Track",
        duration=120,
        source="youtube",
        source_url="https://youtube.com/watch?v=abcdefghijk",
    )

    def fake_youtube(self, query: str, destination: Path) -> DownloadedTrack:
        assert destination == tmp_path / "youtube"
        return expected

    monkeypatch.setattr(
        "telegram_music_bot.downloader.YtDlpMusicProvider.download",
        fake_youtube,
    )

    assert downloader.download("Artist Track", tmp_path) == expected

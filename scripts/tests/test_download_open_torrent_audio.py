from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location(
    "download_open_torrent_audio",
    SCRIPTS / "download_open_torrent_audio.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_audio_signature_checks_real_container_headers(tmp_path: Path) -> None:
    fixtures = {
        "recording.mp3": b"ID3\x04\x00\x00",
        "recording.flac": b"fLaC\x00\x00",
        "recording.ogg": b"OggS\x00\x02",
        "recording.wav": b"RIFF\x00\x00\x00\x00WAVE",
        "recording.m4a": b"\x00\x00\x00\x18ftypM4A ",
    }
    for filename, header in fixtures.items():
        path = tmp_path / filename
        path.write_bytes(header)
        assert MODULE.has_audio_signature(path)

    invalid = tmp_path / "invalid.mp3"
    invalid.write_text("an html error page", encoding="utf-8")
    assert not MODULE.has_audio_signature(invalid)


def test_merge_manifest_preserves_existing_entries_and_replaces_aliases() -> None:
    manifest = {
        "generatedAt": "old",
        "playbackMode": "local-audio",
        "artists": {
            "existing": {
                "availableCount": 1,
                "works": {
                    "1": {
                        "key": "existing:1",
                        "streamUrl": "/existing.mp3",
                        "playbackStatus": "playable",
                    }
                },
            },
            "victoria": {
                "availableCount": 1,
                "works": {"43342": {"key": "old", "streamUrl": "/old.mid"}},
            },
        },
    }
    downloaded = [
        {
            "work": {
                "title": "Officium defunctorum",
                "aliases": [
                    {"artistId": "victoria", "workId": "43342"},
                    {"artistId": "victoria-tomas-luis-de", "workId": "43342"},
                ],
            },
            "match": {
                "catalogName": "Open archive",
                "detailsUrl": "https://example.test/details",
                "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
                "streamUrl": "https://example.test/audio.mp3",
                "torrentUrl": "https://example.test/audio.torrent",
                "identifier": "audio",
            },
            "publicUrl": "/classical/audio/open-torrents/audio.mp3",
            "bytes": 123,
            "sha256": "abc",
        }
    ]

    result = MODULE.merge_manifest(manifest, downloaded, generated_at="now")

    assert result["artists"]["existing"]["works"]["1"]["streamUrl"] == "/existing.mp3"
    assert result["artists"]["victoria"]["works"]["43342"]["mediaType"] == "audio"
    alias = result["artists"]["victoria-tomas-luis-de"]["works"]["43342"]
    assert alias["streamUrl"] == "/classical/audio/open-torrents/audio.mp3"
    assert result["openTorrentEntryCount"] == 2
    assert result["openTorrentUniqueFileCount"] == 1


def test_archive_mirror_urls_use_workable_servers_and_shard_directory() -> None:
    metadata = {
        "dir": "/31/items/example",
        "workable_servers": ["ia801405.us.archive.org", "ia601405.us.archive.org"],
    }

    urls = MODULE.archive_mirror_urls(metadata, "Tómas – recording.mp3")

    assert urls == [
        "https://ia801405.us.archive.org/31/items/example/T%C3%B3mas%20%E2%80%93%20recording.mp3",
        "https://ia601405.us.archive.org/31/items/example/T%C3%B3mas%20%E2%80%93%20recording.mp3",
    ]

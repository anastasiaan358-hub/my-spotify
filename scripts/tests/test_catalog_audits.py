from __future__ import annotations

import importlib.util
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1]


def load_script(name: str):
    path = SCRIPTS / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CHRONOLOGY = load_script("enrich_work_chronology")
PLAYBACK = load_script("audit_playback_catalog")
EXTERNAL_AUDIO = load_script("find_external_audio")


def test_chronology_does_not_capture_the_next_field() -> None:
    result = CHRONOLOGY.chronology_from_wikitext(
        "| Year/Date of Composition =\n| Year of First Publication = 1610 in Musae Sioniae\n"
    )

    assert result == {
        "dateSort": 1610,
        "dateLabel": "1610 in Musae Sioniae · первая публикация",
        "dateSource": "publication",
    }


def test_chronology_prefers_composition_and_ignores_modern_editions() -> None:
    composition = CHRONOLOGY.chronology_from_wikitext(
        "| Year/Date of Composition = ca. 1597–1599\n| Year of First Publication = 1600\n"
    )
    modern_edition = CHRONOLOGY.chronology_from_wikitext(
        "| Year/Date of Composition =\n| Year of First Publication = 1897\n"
    )

    assert composition["dateSort"] == 1597
    assert composition["dateSource"] == "composition"
    assert modern_edition is None


def test_playback_helpers_validate_urls_titles_and_media(tmp_path: Path) -> None:
    midi = tmp_path / "work.mid"
    ogg = tmp_path / "work.ogg"
    mp3 = tmp_path / "work.mp3"
    broken = tmp_path / "broken.ogg"
    midi.write_bytes(b"MThd\x00\x00\x00\x06")
    ogg.write_bytes(b"OggS\x00\x02")
    mp3.write_bytes(b"ID3\x04\x00\x00")
    broken.write_bytes(b"not audio")

    assert PLAYBACK.video_id("https://www.youtube.com/watch?v=Bhjc8QTOt5k") == "Bhjc8QTOt5k"
    assert PLAYBACK.video_id("https://youtu.be/Bhjc8QTOt5k") == "Bhjc8QTOt5k"
    assert PLAYBACK.titles_match("T'amo mia vita, SV 104", "T'amo mia vita")
    assert PLAYBACK.local_media_status(midi, "midi") == "playable"
    assert PLAYBACK.local_media_status(ogg, "audio") == "playable"
    assert PLAYBACK.local_media_status(mp3, "audio") == "playable"
    assert PLAYBACK.local_media_status(broken, "audio") == "corrupt"


def test_external_audio_matching_is_conservative() -> None:
    assert EXTERNAL_AUDIO.duration_seconds("05:18") == 318
    assert EXTERNAL_AUDIO.title_matches(
        "Ecce sacrum paratum convivium, SV 299",
        "Ecce sacrum paratum convivium",
    )[0]
    assert not EXTERNAL_AUDIO.title_matches(
        "Ecce sacrum paratum convivium, SV 299",
        "Ecce sacrum convivium",
    )[0]


def test_external_audio_rejects_one_stream_for_distinct_works() -> None:
    cache = {
        "first": {"status": "found", "match": {"streamUrl": "https://example.test/audio.mp3"}},
        "second": {"status": "found", "match": {"streamUrl": "https://example.test/audio.mp3"}},
    }

    EXTERNAL_AUDIO.reject_ambiguous_streams(cache)

    assert cache["first"]["status"] == "ambiguous"
    assert cache["second"]["status"] == "ambiguous"
    assert "match" not in cache["first"]

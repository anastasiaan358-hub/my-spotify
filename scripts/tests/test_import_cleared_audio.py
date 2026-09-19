from __future__ import annotations

import csv
import importlib.util
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "import_cleared_audio.py"
SPEC = importlib.util.spec_from_file_location("import_cleared_audio", SCRIPT_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def write_source(path: Path, recordings: list[Path]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "artist_id",
                "work_id",
                "title",
                "file_path",
                "source_name",
                "source_url",
                "license",
            ],
        )
        writer.writeheader()
        for index, recording in enumerate(recordings, start=1):
            writer.writerow(
                {
                    "artist_id": "one",
                    "work_id": f"work-{index}",
                    "title": f"Work {index}",
                    "file_path": recording.name,
                    "source_name": "Example archive",
                    "source_url": f"https://example.test/work-{index}",
                    "license": "CC BY 4.0",
                }
            )


def test_import_is_resumable_and_copies_audio(tmp_path: Path) -> None:
    recordings = [tmp_path / "first.ogg", tmp_path / "second.mp3"]
    for index, recording in enumerate(recordings):
        recording.write_bytes(f"audio-{index}".encode())
    source = tmp_path / "catalog.csv"
    output = tmp_path / "local-audio.json"
    audio_dir = tmp_path / "published"
    write_source(source, recordings)

    first = MODULE.import_audio(source, output, audio_dir, batch_size=1, reset=False)
    second = MODULE.import_audio(source, output, audio_dir, batch_size=1, reset=False)

    assert first["importedCount"] == 1
    assert first["remainingCount"] == 1
    assert second["importedCount"] == 2
    assert second["remainingCount"] == 0
    assert (audio_dir / "one" / "work-1.ogg").read_bytes() == b"audio-0"
    assert (audio_dir / "one" / "work-2.mp3").read_bytes() == b"audio-1"
    assert second["artists"]["one"]["works"]["work-1"]["license"] == "CC BY 4.0"
    assert second["artists"]["one"]["works"]["work-1"]["mediaType"] == "audio"


def test_import_supports_midi_score_render(tmp_path: Path) -> None:
    midi = tmp_path / "score.mid"
    midi.write_bytes(b"MThd\x00\x00\x00\x06")
    source = tmp_path / "catalog.csv"
    output = tmp_path / "local-audio.json"
    audio_dir = tmp_path / "published"
    write_source(source, [midi])

    payload = MODULE.import_audio(source, output, audio_dir, batch_size=None, reset=True)

    assert payload["artists"]["one"]["works"]["work-1"]["mediaType"] == "midi"
    assert (audio_dir / "one" / "work-1.mid").is_file()

from __future__ import annotations

import csv
import importlib.util
import json
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "publish_youtube_catalog.py"
SPEC = importlib.util.spec_from_file_location("publish_youtube_catalog", SCRIPT_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def write_source(path: Path) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "key",
                "artist_id",
                "work_id",
                "title",
                "status",
                "youtube_url",
                "youtube_title",
                "channel",
                "confidence",
            ],
        )
        writer.writeheader()
        writer.writerows(
            [
                {
                    "key": "one:1",
                    "artist_id": "one",
                    "work_id": "1",
                    "title": "First",
                    "status": "found",
                    "youtube_url": "https://www.youtube.com/watch?v=Bhjc8QTOt5k",
                    "youtube_title": "First performance",
                    "channel": "Example",
                    "confidence": "high",
                },
                {
                    "key": "one:2",
                    "artist_id": "one",
                    "work_id": "2",
                    "title": "Second",
                    "status": "found",
                    "youtube_url": "https://www.youtube.com/watch?v=abcdefghijk",
                    "youtube_title": "Second performance",
                    "channel": "Example",
                    "confidence": "medium",
                },
                {
                    "key": "one:3",
                    "artist_id": "one",
                    "work_id": "3",
                    "title": "Missing",
                    "status": "missing",
                    "youtube_url": "",
                    "youtube_title": "",
                    "channel": "",
                    "confidence": "",
                },
            ]
        )


def test_publish_is_resumable(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    output = tmp_path / "manifest.json"
    write_source(source)

    first = MODULE.publish(source, output, batch_size=1, reset=False, audit_path=None)
    second = MODULE.publish(source, output, batch_size=1, reset=False, audit_path=None)

    assert first["publishedCount"] == 1
    assert first["remainingCount"] == 1
    assert second["publishedCount"] == 2
    assert second["remainingCount"] == 0
    assert second["artists"]["one"]["availableCount"] == 2
    assert second["source"] == "YouTube"


def test_publish_only_includes_player_verified_videos(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    output = tmp_path / "manifest.json"
    playback_audit = tmp_path / "playback-audit.json"
    write_source(source)
    playback_audit.write_text(
        json.dumps(
            {
                "Bhjc8QTOt5k": {"status": "playable"},
                "abcdefghijk": {"status": "not-embeddable"},
            }
        ),
        encoding="utf-8",
    )

    result = MODULE.publish(
        source,
        output,
        batch_size=None,
        reset=True,
        audit_path=None,
        playback_audit_path=playback_audit,
    )

    assert result["publishedCount"] == 1
    assert result["totalAvailable"] == 1
    assert set(result["artists"]["one"]["works"]) == {"1"}

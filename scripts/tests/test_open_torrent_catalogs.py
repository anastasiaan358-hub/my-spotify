from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location(
    "index_open_torrent_catalogs",
    SCRIPTS / "index_open_torrent_catalogs.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_compact_item_requires_a_clear_license_and_torrent() -> None:
    payload = {
        "metadata": {
            "title": "Hassler recording",
            "creator": "Hans Leo Hassler",
            "licenseurl": "https://creativecommons.org/licenses/by/4.0/",
        },
        "files": [
            {"name": "hassler_archive.torrent"},
            {"name": "cantate-domino.ogg", "title": "Cantate Domino"},
        ],
    }

    item = MODULE.compact_item("hassler", payload, "archive-open-audio")
    assert item is not None
    assert item["torrentUrl"].endswith("hassler_archive.torrent")

    payload["metadata"].pop("licenseurl")
    assert MODULE.compact_item("hassler", payload, "archive-open-audio") is None


def test_matching_rejects_generic_and_spoken_candidates() -> None:
    work = {
        "title": "Fantasia",
        "categoryName": "Sweelinck, Jan Pieterszoon",
    }
    catalog = {
        "items": [
            {
                "identifier": "sweelinck",
                "title": "Sweelinck keyboard works",
                "creator": "Jan Pieterszoon Sweelinck",
                "detailsUrl": "https://archive.org/details/sweelinck",
                "torrentUrl": "https://archive.org/download/sweelinck/sweelinck_archive.torrent",
                "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
                "audioFiles": [{"name": "fantasia-cromatica.ogg", "title": "Fantasia Cromatica"}],
            }
        ],
    }
    assert MODULE.best_match(work, catalog) is None

    work = {"title": "The Silver Swan", "categoryName": "Gibbons, Orlando"}
    catalog["items"][0].update(
        {
            "title": "The Silver Swan",
            "creator": "Orlando Gibbons",
            "audioFiles": [{"name": "silver-swan.mp3", "title": "The Silver Swan — read by AM"}],
        }
    )
    assert MODULE.best_match(work, catalog) is None

    catalog["items"][0]["audioFiles"] = [
        {"name": "silver-swan.mp3", "title": "The Silver Swan — sung by Ezwa"}
    ]
    assert MODULE.best_match(work, catalog) is not None

#!/usr/bin/env python3
"""Download exact, rights-cleared audio matches and publish them to the local player."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

import httpx

ROOT = Path(__file__).resolve().parents[1]
MATCHES_PATH = ROOT / "reports/open-torrent-work-matches.json"
MANIFEST_PATH = ROOT / "frontend/public/classical/catalog/local-audio.json"
OUTPUT_DIR = ROOT / "frontend/public/classical/audio/open-torrents"
REPORT_PATH = ROOT / "reports/open-torrent-downloads.json"
PUBLIC_ROOT = ROOT / "frontend/public"
USER_AGENT = "MySpotifyOpenAudioDownloader/1.0 (rights-cleared local catalogue)"
MAX_FILE_BYTES = 600 * 1024 * 1024
ALLOWED_LICENSE_MARKERS = (
    "creativecommons.org/licenses/",
    "creativecommons.org/publicdomain/",
    "rightsstatements.org/vocab/noc-us/",
)


def atomic_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, delete=False
    ) as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def safe_segment(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-.")
    return value or "audio"


def audio_extension(url: str, filename: str) -> str:
    suffix = Path(filename).suffix.casefold() or Path(urlparse(url).path).suffix.casefold()
    if suffix not in {".mp3", ".flac", ".ogg", ".opus", ".m4a", ".wav"}:
        raise ValueError(f"Unsupported audio extension: {suffix or '<missing>'}")
    return suffix


def has_audio_signature(path: Path) -> bool:
    with path.open("rb") as handle:
        header = handle.read(65536)
    suffix = path.suffix.casefold()
    if suffix == ".mp3":
        return header.startswith(b"ID3") or any(
            header[index] == 0xFF and header[index + 1] & 0xE0 == 0xE0
            for index in range(max(0, len(header) - 1))
        )
    if suffix == ".flac":
        return header.startswith(b"fLaC")
    if suffix in {".ogg", ".opus"}:
        return header.startswith(b"OggS")
    if suffix == ".wav":
        return header.startswith(b"RIFF") and header[8:12] == b"WAVE"
    if suffix == ".m4a":
        return header[4:8] == b"ftyp"
    return False


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def license_is_allowed(license_url: str) -> bool:
    normalized = license_url.casefold().replace("http://", "https://")
    return any(marker in normalized for marker in ALLOWED_LICENSE_MARKERS)


def target_path(output_dir: Path, work: dict[str, Any], match: dict[str, Any]) -> Path:
    aliases = work.get("aliases") or []
    if not aliases:
        raise ValueError(f"No catalogue aliases for {work.get('title', '<untitled>')}")
    alias = aliases[0]
    extension = audio_extension(str(match["streamUrl"]), str(match.get("filename") or ""))
    directory = safe_segment(str(match.get("identifier") or alias["artistId"]))
    filename = (
        f"{safe_segment(str(alias['artistId']))}-{safe_segment(str(alias['workId']))}{extension}"
    )
    return output_dir / directory / filename


def download_audio(http: httpx.Client, url: str, destination: Path, *, force: bool) -> str:
    if destination.exists() and not force:
        if not has_audio_signature(destination):
            raise ValueError(f"Existing file is not valid audio: {destination}")
        return "kept"

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f"{destination.stem}.part{destination.suffix}")
    temporary.unlink(missing_ok=True)
    written = 0
    request_url = f"{url}?download=1" if url.startswith("https://archive.org/download/") else url
    try:
        with http.stream("GET", request_url) as response:
            response.raise_for_status()
            declared_size = int(response.headers.get("content-length") or 0)
            if declared_size > MAX_FILE_BYTES:
                raise ValueError(f"Audio file is too large: {declared_size} bytes")
            with temporary.open("wb") as handle:
                for chunk in response.iter_bytes(1024 * 1024):
                    written += len(chunk)
                    if written > MAX_FILE_BYTES:
                        raise ValueError(f"Audio file exceeded {MAX_FILE_BYTES} bytes")
                    handle.write(chunk)
        if not has_audio_signature(temporary):
            raise ValueError(f"Downloaded payload is not valid {destination.suffix} audio")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)
    return "downloaded"


def archive_mirror_urls(metadata: dict[str, Any], filename: str) -> list[str]:
    directory = str(metadata.get("dir") or "")
    if not directory.startswith("/"):
        return []
    servers = metadata.get("workable_servers") or [metadata.get("d1"), metadata.get("d2")]
    encoded_filename = quote(filename)
    return [
        f"https://{server}{directory}/{encoded_filename}"
        for server in servers
        if isinstance(server, str) and server
    ]


def download_with_archive_fallback(
    http: httpx.Client,
    match: dict[str, Any],
    destination: Path,
    *,
    force: bool,
) -> str:
    stream_url = str(match["streamUrl"])
    try:
        return download_audio(http, stream_url, destination, force=force)
    except (httpx.HTTPError, OSError) as primary_error:
        identifier = str(match.get("identifier") or "")
        filename = str(match.get("filename") or "")
        if not identifier or not filename:
            raise primary_error
        response = http.get(f"https://archive.org/metadata/{quote(identifier)}")
        response.raise_for_status()
        mirrors = archive_mirror_urls(response.json(), filename)
        last_error: httpx.HTTPError | OSError = primary_error
        for mirror_url in mirrors:
            try:
                return download_audio(http, mirror_url, destination, force=force)
            except (httpx.HTTPError, OSError) as mirror_error:
                last_error = mirror_error
        raise last_error from primary_error


def public_url(path: Path, public_root: Path = PUBLIC_ROOT) -> str:
    return "/" + path.relative_to(public_root).as_posix()


def merge_manifest(
    manifest: dict[str, Any],
    downloaded: list[dict[str, Any]],
    *,
    generated_at: str,
) -> dict[str, Any]:
    artists = manifest.setdefault("artists", {})
    for item in downloaded:
        work = item["work"]
        match = item["match"]
        for alias in work["aliases"]:
            artist_id = str(alias["artistId"])
            work_id = str(alias["workId"])
            artist = artists.setdefault(artist_id, {"availableCount": 0, "works": {}})
            artist.setdefault("works", {})[work_id] = {
                "key": f"{artist_id}:{work_id}",
                "title": str(work["title"]),
                "streamUrl": str(item["publicUrl"]),
                "mediaType": "audio",
                "sourceName": str(match["catalogName"]),
                "sourceUrl": str(match["detailsUrl"]),
                "license": str(match["licenseUrl"]),
                "bytes": int(item["bytes"]),
                "sha256": str(item["sha256"]),
                "playbackStatus": "playable",
                "verifiedAt": generated_at,
                "originalStreamUrl": str(match["streamUrl"]),
                "torrentUrl": str(match["torrentUrl"]),
                "archiveIdentifier": str(match["identifier"]),
                "downloadedFromOpenTorrentCatalog": True,
            }

    all_works = []
    for artist in artists.values():
        works = artist.setdefault("works", {})
        artist["availableCount"] = sum(
            work.get("playbackStatus", "playable") == "playable" for work in works.values()
        )
        all_works.extend(works.values())
    manifest["generatedAt"] = generated_at
    manifest["catalogPlayableEntryCount"] = sum(
        work.get("playbackStatus", "playable") == "playable" for work in all_works
    )
    manifest["featuredAssetCount"] = sum(bool(work.get("featuredAsset")) for work in all_works)
    manifest["inheritedEntryCount"] = sum(bool(work.get("inheritedFrom")) for work in all_works)
    manifest["openTorrentEntryCount"] = sum(
        bool(work.get("downloadedFromOpenTorrentCatalog")) for work in all_works
    )
    manifest["openTorrentUniqueFileCount"] = len(
        {work["streamUrl"] for work in all_works if work.get("downloadedFromOpenTorrentCatalog")}
    )
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matches", type=Path, default=MATCHES_PATH)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = json.loads(args.matches.read_text(encoding="utf-8"))
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    generated_at = datetime.now(UTC).isoformat()
    downloaded: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []

    with httpx.Client(
        timeout=httpx.Timeout(180, connect=20),
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as http:
        for work in payload["matches"]:
            match = work["matches"][0]
            title = f"{work['composer']} — {work['title']}"
            try:
                if not license_is_allowed(str(match.get("licenseUrl") or "")):
                    raise ValueError("The selected recording has no allowed open license")
                destination = target_path(args.output_dir, work, match)
                action = download_with_archive_fallback(http, match, destination, force=args.force)
                entry = {
                    "work": work,
                    "match": match,
                    "localPath": str(destination.relative_to(ROOT)),
                    "publicUrl": public_url(destination),
                    "bytes": destination.stat().st_size,
                    "sha256": checksum(destination),
                    "action": action,
                }
                downloaded.append(entry)
                print(f"{action:10} {title} ({entry['bytes']} bytes)")
            except (httpx.HTTPError, OSError, ValueError, KeyError) as error:
                errors.append({"title": title, "error": str(error)})
                print(f"failed     {title}: {error}")

    merge_manifest(manifest, downloaded, generated_at=generated_at)
    atomic_json(args.manifest, manifest)
    report = {
        "generatedAt": generated_at,
        "matchedUniqueWorks": len(payload["matches"]),
        "downloadedUniqueWorks": len(downloaded),
        "publishedCardEntries": sum(len(item["work"]["aliases"]) for item in downloaded),
        "totalBytes": sum(int(item["bytes"]) for item in downloaded),
        "errors": errors,
        "downloads": [
            {
                "composer": item["work"]["composer"],
                "title": item["work"]["title"],
                "aliases": item["work"]["aliases"],
                "localPath": item["localPath"],
                "publicUrl": item["publicUrl"],
                "bytes": item["bytes"],
                "sha256": item["sha256"],
                "sourceUrl": item["match"]["detailsUrl"],
                "license": item["match"]["licenseUrl"],
                "action": item["action"],
            }
            for item in downloaded
        ],
    }
    atomic_json(args.report, report)
    print(
        f"Published {report['publishedCardEntries']} card entries from "
        f"{report['downloadedUniqueWorks']} local files ({report['totalBytes']} bytes)."
    )
    if errors:
        raise SystemExit(f"{len(errors)} download(s) failed; see {args.report}")


if __name__ == "__main__":
    main()

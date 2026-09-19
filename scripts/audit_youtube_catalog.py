#!/usr/bin/env python3
"""Check every published YouTube URL through YouTube's public oEmbed endpoint."""

from __future__ import annotations

import argparse
import asyncio
import json
import tempfile
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import httpx

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "frontend" / "public" / "classical" / "catalog" / "youtube-works.json"
DEFAULT_OUTPUT = ROOT / "reports" / "youtube-link-audit.json"
OEMBED_URL = "https://www.youtube.com/oembed"


def video_id(url: str) -> str | None:
    parsed = urlparse(url)
    candidate = (
        parsed.path.removeprefix("/").split("/", 1)[0]
        if parsed.hostname == "youtu.be"
        else parse_qs(parsed.query).get("v", [None])[0]
    )
    return candidate if candidate and len(candidate) == 11 else None


def published_video_ids(path: Path) -> tuple[int, list[str]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    works = [
        work
        for artist in payload.get("artists", {}).values()
        for work in artist.get("works", {}).values()
    ]
    identifiers: list[str] = []
    for work in works:
        if identifier := video_id(work.get("youtubeUrl", "")):
            identifiers.append(identifier)
    return len(works), identifiers


async def check_video(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    identifier: str,
) -> tuple[str, dict[str, object]]:
    async with semaphore:
        try:
            response = await client.get(
                OEMBED_URL,
                params={
                    "url": f"https://www.youtube.com/watch?v={identifier}",
                    "format": "json",
                },
            )
            if response.status_code == 200:
                payload = response.json()
                return identifier, {
                    "status": "available",
                    "httpStatus": 200,
                    "title": payload.get("title", ""),
                    "authorName": payload.get("author_name", ""),
                }
            return identifier, {
                "status": "unavailable"
                if response.status_code in {400, 401, 403, 404}
                else "transient-error",
                "httpStatus": response.status_code,
            }
        except (httpx.HTTPError, ValueError) as exc:
            return identifier, {
                "status": "transient-error",
                "httpStatus": None,
                "error": type(exc).__name__,
            }


async def audit(source: Path, output: Path, concurrency: int) -> dict[str, object]:
    work_count, identifiers = published_video_ids(source)
    assignments = Counter(identifiers)
    semaphore = asyncio.Semaphore(concurrency)
    timeout = httpx.Timeout(20, connect=10)
    headers = {"User-Agent": "MySpotifyCatalogAudit/1.0"}
    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        results = dict(
            await asyncio.gather(
                *(check_video(client, semaphore, identifier) for identifier in assignments)
            )
        )

    status_counts = Counter(result["status"] for result in results.values())
    available_assignments = sum(
        assignments[identifier]
        for identifier, result in results.items()
        if result["status"] == "available"
    )
    report: dict[str, object] = {
        "checkedAt": datetime.now(UTC).isoformat(),
        "method": "YouTube oEmbed metadata availability",
        "scope": (
            "Checks that a public YouTube page still exposes metadata; it cannot prove "
            "audible playback or permission to embed."
        ),
        "totalWorks": work_count,
        "totalAssignments": len(identifiers),
        "validVideoIds": len(identifiers),
        "invalidVideoIds": work_count - len(identifiers),
        "uniqueVideos": len(assignments),
        "availableVideos": status_counts["available"],
        "unavailableVideos": status_counts["unavailable"],
        "transientFailures": status_counts["transient-error"],
        "availableAssignments": available_assignments,
        "videos": results,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=output.parent, prefix=f".{output.name}.", delete=False
    ) as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(output)
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--concurrency", type=int, default=12)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.concurrency <= 0:
        raise SystemExit("--concurrency must be greater than zero")
    report = asyncio.run(audit(args.source, args.output, args.concurrency))
    print(
        f"Checked {report['totalAssignments']} YouTube assignments / "
        f"{report['uniqueVideos']} unique videos: "
        f"{report['availableVideos']} available, {report['unavailableVideos']} unavailable, "
        f"{report['transientFailures']} transient failures"
    )


if __name__ == "__main__":
    main()

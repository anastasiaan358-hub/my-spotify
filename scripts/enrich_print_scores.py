#!/usr/bin/env python3
"""Attach a direct printable PDF to each indexed work when IMSLP exposes one.

Work pages are read in MediaWiki API batches. The documented IMSLP lookup API
then resolves the first PDF file name to its file index and copyright block.
Blocked files are omitted; public files and EU-tagged files receive a direct
PDF URL instead of a link to an IMSLP catalogue page.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "frontend" / "public" / "classical" / "catalog" / "imslp-works.json"
MEDIAWIKI_API = "https://imslp.org/api.php"
LOOKUP_API = "https://imslp.org/wiki/Special:IMSLPAPI/json/lookup/"
USER_AGENT = "MySpotifyClassicalCatalog/1.0 (local development project)"
FILE_NAME = re.compile(r"^\s*\|\s*File Name \d+\s*=\s*(.+?\.pdf)\s*$", re.IGNORECASE | re.MULTILINE)
COPYRIGHT = re.compile(r"^\s*\|\s*Copyright\s*=\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)


def request_json(url: str, data: bytes | None = None, retries: int = 4) -> dict | list:
    request = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("unreachable")


def title_from_url(url: str) -> str:
    return urllib.parse.unquote(url.rsplit("/wiki/", 1)[-1]).replace("_", " ")


def batched(values: list[str], size: int) -> list[list[str]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


def fetch_wikitext(titles: list[str]) -> dict[str, str]:
    data = urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "prop": "revisions",
            "rvprop": "content",
            "titles": "|".join(titles),
        }
    ).encode()
    payload = request_json(MEDIAWIKI_API, data=data)
    pages = payload.get("query", {}).get("pages", {}) if isinstance(payload, dict) else {}
    return {
        page.get("title", ""): page.get("revisions", [{}])[0].get("*", "")
        for page in pages.values()
        if page.get("revisions")
    }


def first_pdf(wikitext: str) -> tuple[str, str] | None:
    match = FILE_NAME.search(wikitext)
    if not match:
        return None
    filename = match.group(1).strip()
    copyright_match = COPYRIGHT.search(
        wikitext, match.end(), min(len(wikitext), match.end() + 3500)
    )
    license_name = copyright_match.group(1).strip() if copyright_match else ""
    return filename, license_name


def lookup_file(filename: str) -> dict | None:
    url = LOOKUP_API + urllib.parse.quote(filename, safe="")
    payload = request_json(url)
    if not isinstance(payload, list) or not payload or not payload[0].get("index"):
        return None
    return payload[0]


def direct_pdf_url(filename: str, index: int, block: str) -> str | None:
    if block not in {"", "crblockeu"}:
        return None
    digest = hashlib.md5(filename.encode()).hexdigest()
    stored_name = urllib.parse.quote(f"IMSLP{index}-{filename}", safe="()_,'-.")
    if block == "crblockeu":
        return f"https://imslp.eu/files/imglnks/euimg/{digest[0]}/{digest[:2]}/{stored_name}"
    return f"https://ks15.imslp.org/files/imglnks/usimg/{digest[0]}/{digest[:2]}/{stored_name}"


def main() -> None:
    payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    works = [work for artist in payload["artists"].values() for work in artist["works"]]
    work_by_title: dict[str, list[dict]] = {}
    for work in works:
        work_by_title.setdefault(title_from_url(work["imslpUrl"]), []).append(work)

    title_to_file: dict[str, tuple[str, str]] = {}
    title_batches = batched(list(work_by_title), 40)
    for index, title_batch in enumerate(title_batches, start=1):
        for title, wikitext in fetch_wikitext(title_batch).items():
            file_info = first_pdf(wikitext)
            if file_info:
                title_to_file[title] = file_info
        if index % 20 == 0 or index == len(title_batches):
            print(
                f"wikitext {index}/{len(title_batches)}; PDF candidates {len(title_to_file)}",
                flush=True,
            )
        time.sleep(0.08)

    lookup_results: dict[str, dict | None] = {}
    filenames = sorted({filename for filename, _ in title_to_file.values()})
    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {executor.submit(lookup_file, filename): filename for filename in filenames}
        for index, future in enumerate(as_completed(futures), start=1):
            filename = futures[future]
            try:
                lookup_results[filename] = future.result()
            except Exception:
                lookup_results[filename] = None
            if index % 250 == 0 or index == len(filenames):
                print(f"lookup {index}/{len(filenames)}", flush=True)

    attached = 0
    for title, matching_works in work_by_title.items():
        file_info = title_to_file.get(title)
        if not file_info:
            continue
        filename, license_name = file_info
        lookup = lookup_results.get(filename)
        if not lookup:
            continue
        print_url = direct_pdf_url(
            lookup["filename"], int(lookup["index"]), lookup.get("crblock", "")
        )
        if not print_url:
            continue
        for work in matching_works:
            work["printUrl"] = print_url
            work["printLicense"] = license_name
            attached += 1

    payload["printableScores"] = {
        "method": (
            "First unblocked PDF exposed by the IMSLP work-page file metadata "
            "and file lookup API."
        ),
        "attachedEntries": attached,
    }
    CATALOG_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"attached printable PDFs to {attached}/{len(works)} catalogue entries", flush=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build the public work index for the Renaissance composer catalog.

The resulting JSON contains IMSLP composition pages only. It is an index of
openly catalogued scores, not a claim that a recording is available or that a
composer's scholarly catalogue is complete.
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "frontend" / "public" / "classical" / "catalog" / "imslp-works.json"
API = "https://imslp.org/api.php"
USER_AGENT = "MySpotifyClassicalCatalog/1.0 (local development project)"

COMPOSERS = {
    "allegri": "Allegri, Gregorio",
    "arbeau": "Arbeau, Thoinot",
    "dowland": "Dowland, John",
    "galilei": "Galilei, Vincenzo",
    "gastoldi": "Gastoldi, Giovanni Giacomo",
    "gesualdo": "Gesualdo, Carlo",
    "gibbons": "Gibbons, Orlando",
    "janequin": "Janequin, Clément",
    "japart": "Japart, Jean",
    "lassus": "Lassus, Orlande de",
    "marenzio": "Marenzio, Luca",
    "milan": "Milán, Luis",
    "philippe-de-monte": "Monte, Philippe de",
    "josquin": "Josquin Desprez",
    "scheidemann": "Scheidemann, Heinrich",
    "tallis": "Tallis, Thomas",
    "victoria": "Victoria, Tomás Luis de",
    "monteverdi": "Monteverdi, Claudio",
    "frescobaldi": "Frescobaldi, Girolamo",
    "praetorius": "Praetorius, Michael",
}

# These IDs back the clickable influence tree. They intentionally use the
# atlas composer IDs so their internal archive pages can load the same index.
ATLAS_FEATURED_COMPOSERS = {
    "willaert-adrian": "Willaert, Adrian",
    "rore-cipriano-de": "Rore, Cipriano de",
    "zarlino-gioseffo": "Zarlino, Gioseffo",
    "gabrieli-andrea": "Gabrieli, Andrea",
    "merulo-claudio": "Merulo, Claudio",
    "monteverdi-claudio": "Monteverdi, Claudio",
    "galilei-vincenzo": "Galilei, Vincenzo",
    "gabrieli-giovanni": "Gabrieli, Giovanni",
    "hassler-hans-leo": "Hassler, Hans Leo",
    "ingegneri-marc-antonio": "Ingegneri, Marc Antonio",
    "peri-jacopo": "Peri, Jacopo",
    "caccini-giulio": "Caccini, Giulio",
    "schutz-heinrich": "Schütz, Heinrich",
    "tallis-thomas": "Tallis, Thomas",
    "byrd-william": "Byrd, William",
    "morley-thomas": "Morley, Thomas",
    "marenzio-luca": "Marenzio, Luca",
    "sweelinck-jan-pieterszoon": "Sweelinck, Jan Pieterszoon",
    "scheidemann-heinrich": "Scheidemann, Heinrich",
    "scheidt-samuel": "Scheidt, Samuel",
    "palestrina-giovanni-pierluigi-da": "Palestrina, Giovanni Pierluigi da",
    "victoria-tomas-luis-de": "Victoria, Tomás Luis de",
}


def request_json(params: dict[str, str]) -> dict:
    url = API + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2**attempt)
    raise RuntimeError("unreachable")


def work_title(page_title: str) -> str:
    return page_title.rsplit(" (", 1)[0].strip()


def fetch_composer(category: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    continuation: str | None = None
    while True:
        params = {
            "action": "query",
            "format": "json",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmnamespace": "0",
            "cmlimit": "500",
        }
        if continuation:
            params["cmcontinue"] = continuation
        payload = request_json(params)
        for page in payload.get("query", {}).get("categorymembers", []):
            title = page["title"]
            rows.append(
                {
                    "id": str(page["pageid"]),
                    "title": work_title(title),
                    "imslpUrl": "https://imslp.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"), safe="()_,'-"),
                    "rismUrl": "https://rism.online/search?mode=sources&q=" + urllib.parse.quote(f'"{work_title(title)}" "{category}"'),
                }
            )
        continuation = payload.get("continue", {}).get("cmcontinue")
        if not continuation:
            return rows
        time.sleep(0.35)


def main() -> None:
    catalog: dict[str, dict] = {}
    category_cache: dict[str, list[dict[str, str]]] = {}
    for artist_id, category in {**COMPOSERS, **ATLAS_FEATURED_COMPOSERS}.items():
        works = category_cache.get(category)
        if works is None:
            works = fetch_composer(category)
            category_cache[category] = works
        catalog[artist_id] = {
            "catalogName": "IMSLP",
            "catalogUrl": "https://imslp.org/wiki/Category:" + urllib.parse.quote(category.replace(" ", "_"), safe="_,'-"),
            "verificationCatalogUrl": "https://rism.online/search?mode=sources&q=" + urllib.parse.quote(category),
            "works": works,
        }
        print(f"{artist_id}: {len(works)} works")
        time.sleep(0.35)

    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_text(
        json.dumps(
            {
                "generatedFrom": "IMSLP MediaWiki API",
                "verificationCatalog": "RISM Online",
                "completeness": "All composition pages currently exposed in each IMSLP composer category; not a definitive scholarly oeuvre catalogue.",
                "artists": catalog,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

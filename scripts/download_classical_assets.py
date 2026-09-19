#!/usr/bin/env python3
"""Download the openly licensed music and scores used by the classical catalog."""

from __future__ import annotations

import io
import os
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public" / "classical"
USER_AGENT = "MySpotifyClassicalCatalog/1.0 (local development project)"


ASSETS = [
    {
        "id": "allegri",
        "title": "Miserere mei, Deus",
        "license": "Audio: CC BY 3.0; score: CC BY-SA 4.0",
        "audio": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Allegri%20-%20Miserere%20Mei%2C%20Deus%20-%20Ensamble%20Esc%C3%A9nico%20Vocal%20%28audio%29.ogg",
        "score": "https://www.mutopiaproject.org/ftp/AllegriG/miserere-mei-deus/miserere-mei-deus-a4.pdf",
        "source": "Wikimedia Commons / Mutopia Project",
        "source_url": "https://commons.wikimedia.org/wiki/File:Allegri_-_Miserere_Mei,_Deus_-_Ensamble_Esc%C3%A9nico_Vocal_(audio).ogg",
    },
    {
        "id": "arbeau",
        "title": "Belle qui tiens ma vie",
        "license": "Public Domain",
        "audio": "https://www.mutopiaproject.org/ftp/ArbeauT/Orch/belle/belle.mid",
        "score": "https://www.mutopiaproject.org/ftp/ArbeauT/Orch/belle/belle-a4.pdf",
    },
    {
        "id": "dowland",
        "title": "Come Again",
        "license": "Public Domain",
        "audio": "https://www.mutopiaproject.org/ftp/DowlandJ/ALS17/ComeAgain/ComeAgain.mid",
        "score": "https://www.mutopiaproject.org/ftp/DowlandJ/ALS17/ComeAgain/ComeAgain-a4.pdf",
    },
    {
        "id": "galilei",
        "title": "Saltarello",
        "license": "Public Domain",
        "audio": "https://www.mutopiaproject.org/ftp/GalileiV/saltarello/saltarello.mid",
        "score": "https://www.mutopiaproject.org/ftp/GalileiV/saltarello/saltarello-a4.pdf",
    },
    {
        "id": "gastoldi",
        "title": "Al mormorar de' liquidi cristalli",
        "license": "CC BY-SA 3.0",
        "audio": "https://www.mutopiaproject.org/ftp/GastoldiG/Al_mormorar/Al_mormorar.mid",
        "score": "https://www.mutopiaproject.org/ftp/GastoldiG/Al_mormorar/Al_mormorar-a4.pdf",
    },
    {
        "id": "gesualdo",
        "title": "Dolcissima mia vita",
        "license": "CC BY-SA 3.0",
        "audio": "https://www.mutopiaproject.org/ftp/GesualdoC/Dolcissima_mia_vita/Dolcissima_mia_vita.mid",
        "score": "https://www.mutopiaproject.org/ftp/GesualdoC/Dolcissima_mia_vita/Dolcissima_mia_vita-a4.pdf",
    },
    {
        "id": "gibbons",
        "title": "The Silver Swan",
        "license": "Public Domain",
        "audio": "https://www.mutopiaproject.org/ftp/GibbonsO/SilverSwan/SilverSwan.mid",
        "score": "https://www.mutopiaproject.org/ftp/GibbonsO/SilverSwan/SilverSwan-a4.pdf",
    },
    {
        "id": "janequin",
        "title": "Le Chant des Oyseaux",
        "license": "Public Domain",
        "audio": "https://www.mutopiaproject.org/ftp/JanequinC/Oyseaux-Endfassung/Oyseaux-Endfassung.mid",
        "score": "https://www.mutopiaproject.org/ftp/JanequinC/Oyseaux-Endfassung/Oyseaux-Endfassung-a4.pdf",
    },
    {
        "id": "japart",
        "title": "Tmeiskin",
        "license": "Public Domain",
        "audio": "https://www.mutopiaproject.org/ftp/JapartJ/27-tmeiskin/27-tmeiskin.mid",
        "score": "https://www.mutopiaproject.org/ftp/JapartJ/27-tmeiskin/27-tmeiskin-a4-pdfs.zip",
        "score_member": "27-tmeiskin.mod-a4.pdf",
    },
    {
        "id": "lassus",
        "title": "Sibylla Samia",
        "license": "CC BY-SA 3.0",
        "audio": "https://www.mutopiaproject.org/ftp/LassusOd/samia/samia.mid",
        "score": "https://www.mutopiaproject.org/ftp/LassusOd/samia/samia-a4.pdf",
    },
    {
        "id": "marenzio",
        "title": "Solo e pensoso",
        "license": "CC BY-SA 3.0",
        "audio": "https://www.mutopiaproject.org/ftp/MarenzioL/Solo_e_pensoso/Solo_e_pensoso.mid",
        "score": "https://www.mutopiaproject.org/ftp/MarenzioL/Solo_e_pensoso/Solo_e_pensoso-a4.pdf",
    },
    {
        "id": "milan",
        "title": "Pavana II",
        "license": "Public Domain",
        "audio": "https://www.mutopiaproject.org/ftp/MilanL/milan-pavan2/milan-pavan2.mid",
        "score": "https://www.mutopiaproject.org/ftp/MilanL/milan-pavan2/milan-pavan2-a4.pdf",
    },
    {
        "id": "philippe-de-monte",
        "title": "Amor, che sol dei cor leggiadri ha cura",
        "license": "CC BY 4.0",
        "audio": "https://www.mutopiaproject.org/ftp/MontePd/01-3-01/01-3-01.mid",
        "score": "https://www.mutopiaproject.org/ftp/MontePd/01-3-01/01-3-01-a4.pdf",
    },
    {
        "id": "josquin",
        "title": "El Grillo",
        "license": "Audio: CC BY-SA 3.0; score: Public Domain",
        "audio": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Josquin%20El%20grillo%20sung%20by%20the%20dwsChorale.ogg",
        "score": "https://www.mutopiaproject.org/ftp/PresJd/Grillo/Grillo-a4.pdf",
        "source": "Wikimedia Commons / Mutopia Project",
        "source_url": "https://commons.wikimedia.org/wiki/File:Josquin_El_grillo_sung_by_the_dwsChorale.ogg",
    },
    {
        "id": "scheidemann",
        "title": "Praeambulum no. 3 in D",
        "license": "Public Domain",
        "audio": "https://www.mutopiaproject.org/ftp/ScheidemannH/HSpre3/HSpre3.mid",
        "score": "https://www.mutopiaproject.org/ftp/ScheidemannH/HSpre3/HSpre3-a4.pdf",
    },
    {
        "id": "tallis",
        "title": "If Ye Love Me",
        "license": "Audio: CC BY-SA 3.0; score: Public Domain",
        "audio": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Tallis%20if%20ye%20love%20me%20performed%20by%20the%20dwsChorale.ogg",
        "score": "https://www.mutopiaproject.org/ftp/TallisT/tallis-love/tallis-love-a4.pdf",
        "source": "Wikimedia Commons / Mutopia Project",
        "source_url": "https://commons.wikimedia.org/wiki/File:Tallis_if_ye_love_me_performed_by_the_dwsChorale.ogg",
    },
    {
        "id": "victoria",
        "title": "O Magnum Mysterium",
        "license": "CC BY-SA 3.0",
        "audio": "https://www.mutopiaproject.org/ftp/VictoriaTLd/o_magnum_mysterium/o_magnum_mysterium-mids.zip",
        "audio_member": "o_magnum_mysterium-choir-4.mid",
        "score": "https://www.mutopiaproject.org/ftp/VictoriaTLd/o_magnum_mysterium/o_magnum_mysterium-a4-pdfs.zip",
        "score_member": "o_magnum_mysterium-choir-4-a4.pdf",
    },
    {
        "id": "monteverdi",
        "title": "T'amo mia vita",
        "license": "CC BY-SA 3.0",
        "audio": "https://www.mutopiaproject.org/ftp/MonteverdiC/SV105/T_Amo_Mia_Vita/T_Amo_Mia_Vita.mid",
        "score": "https://www.mutopiaproject.org/ftp/MonteverdiC/SV105/T_Amo_Mia_Vita/T_Amo_Mia_Vita-a4.pdf",
    },
    {
        "id": "frescobaldi",
        "title": "Toccata avanti la Messa della Domenica",
        "license": "Audio: CC BY 3.0; score: Public Domain",
        "audio": "https://upload.wikimedia.org/wikipedia/commons/5/5f/Frescobaldi_Toccata_avanti_la_Messa_della_Domenica.ogg",
        "score": "https://upload.wikimedia.org/wikipedia/commons/5/55/Fiori_Musicali%2C_Op.12_%28IA_imslp-musicali-op12-frescobaldi-girolamo%29.pdf",
        "source": "Wikimedia Commons",
        "source_url": "https://commons.wikimedia.org/wiki/File:Frescobaldi_Toccata_avanti_la_Messa_della_Domenica.ogg",
    },
    {
        "id": "praetorius",
        "title": "Es ist ein Ros entsprungen",
        "license": "Public Domain",
        "audio": "https://upload.wikimedia.org/wikipedia/commons/4/44/Michael_Praetorius_-_Es_ist_ein%27_Ros%27_entsprungen.ogg",
        "score": "https://upload.wikimedia.org/wikipedia/commons/4/43/Es_ist_ein_Ros_entsprungen_%28IA_imslp-ist-ein-ros-entsprungen-praetorius-michael%29.pdf",
        "source": "Wikimedia Commons",
        "source_url": "https://commons.wikimedia.org/wiki/File:Michael_Praetorius_-_Es_ist_ein%27_Ros%27_entsprungen.ogg",
    },
]


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 4:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Could not download {url}")


def write_asset(url: str, destination: Path, member: str | None = None) -> None:
    if destination.exists() and destination.stat().st_size:
        return
    payload = fetch(url)
    if member:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            payload = archive.read(member)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    with temporary.open("wb") as output:
        shutil.copyfileobj(io.BytesIO(payload), output)
    temporary.replace(destination)


def download(item: dict[str, str]) -> None:
    audio_extension = ".ogg" if item["audio"].endswith(".ogg") else ".mid"
    write_asset(
        item["audio"],
        PUBLIC / "audio" / f"{item['id']}{audio_extension}",
        item.get("audio_member"),
    )
    write_asset(
        item["score"],
        PUBLIC / "scores" / f"{item['id']}.pdf",
        item.get("score_member"),
    )
    print(f"downloaded {item['id']}")


def write_sources() -> None:
    lines = [
        "# Classical catalog sources",
        "",
        "The catalog stores local copies so playback and score viewing work offline.",
        "Mutopia items include MIDI previews and printable scores. Wikimedia items retain their file-page attribution.",
        "",
        "| ID | Work | Source | License | Audio | Score |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for item in ASSETS:
        source = item.get("source", "Mutopia Project")
        source_url = item.get("source_url", "https://www.mutopiaproject.org/")
        lines.append(
            f"| {item['id']} | {item['title']} | [{source}]({source_url}) | {item['license']} | "
            f"[{item['audio']}]({item['audio']}) | [{item['score']}]({item['score']}) |"
        )
    (PUBLIC / "SOURCES.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def render_previews() -> None:
    renderer = shutil.which("pdftoppm")
    if not renderer:
        print("pdftoppm is unavailable; skipping score previews")
        return
    preview_directory = PUBLIC / "previews"
    preview_directory.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    environment["XDG_CACHE_HOME"] = str(Path(tempfile.gettempdir()) / "my-spotify-font-cache")
    for score in sorted((PUBLIC / "scores").glob("*.pdf")):
        destination = preview_directory / f"{score.stem}.png"
        if destination.exists() and destination.stat().st_size:
            continue
        subprocess.run(
            [renderer, "-f", "1", "-singlefile", "-png", "-r", "120", str(score), str(destination.with_suffix(""))],
            check=True,
            env=environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


if __name__ == "__main__":
    PUBLIC.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(download, ASSETS))
    write_sources()
    render_previews()

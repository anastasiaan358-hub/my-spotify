import json
import re
import shutil
import urllib.error
import urllib.request
from functools import lru_cache
from urllib.parse import urlparse

from django.conf import settings
from django.core.cache import cache
from django.db import OperationalError, connection
from django.http import Http404, JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_GET
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

SCORE_CATALOG_PATH = (
    settings.BASE_DIR / "frontend" / "public" / "classical" / "catalog" / "imslp-works.json"
)
SCORE_FILE_HOSTS = {"imslp.eu", "ks15.imslp.org"}
YOUTUBE_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
YOUTUBE_RANGE = re.compile(r"^bytes=\d*-\d*$")
YOUTUBE_STREAM_CACHE_SECONDS = 60 * 60


@lru_cache(maxsize=1)
def _printable_score_urls() -> dict[tuple[str, str], str]:
    payload = json.loads(SCORE_CATALOG_PATH.read_text(encoding="utf-8"))
    return {
        (catalog_id, str(work["id"])): work["printUrl"]
        for catalog_id, catalog in payload["artists"].items()
        for work in catalog["works"]
        if work.get("printUrl")
    }


@require_GET
def printable_score(request, catalog_id: str, work_id: str):
    """Stream one allow-listed score PDF through the project origin.

    The client supplies catalogue IDs, never an arbitrary upstream URL. This
    keeps the endpoint from becoming an open proxy while allowing the local
    score renderer to read PDF bytes from file hosts that do not expose CORS.
    """

    upstream_url = _printable_score_urls().get((catalog_id, work_id))
    if not upstream_url or urlparse(upstream_url).hostname not in SCORE_FILE_HOSTS:
        raise Http404("Printable score not found")

    upstream_request = urllib.request.Request(
        upstream_url,
        headers={"User-Agent": "MySpotifyClassicalCatalog/1.0"},
    )
    try:
        upstream = urllib.request.urlopen(upstream_request, timeout=60)
    except Exception:
        return JsonResponse({"detail": "Score file is temporarily unavailable"}, status=502)

    def stream():
        try:
            while chunk := upstream.read(64 * 1024):
                yield chunk
        finally:
            upstream.close()

    response = StreamingHttpResponse(stream(), content_type="application/pdf")
    content_length = upstream.headers.get("Content-Length")
    if content_length:
        response["Content-Length"] = content_length
    disposition = "attachment" if "download" in request.GET else "inline"
    response["Content-Disposition"] = f'{disposition}; filename="score-{work_id}.pdf"'
    response["Cache-Control"] = "public, max-age=86400"
    return response


def _youtube_stream_metadata(video_id: str) -> dict[str, object]:
    cache_key = f"youtube-stream:v5:{video_id}"
    if cached := cache.get(cache_key):
        return cached

    import yt_dlp

    node_path = shutil.which("node")
    options = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
        "extractor_args": {"youtube": {"player_client": ["web_embedded"]}},
        "remote_components": ["ejs:github"],
    }
    if node_path:
        options["js_runtimes"] = {"node": {"path": node_path}}

    last_error: Exception | None = None
    for _attempt in range(3):
        try:
            with yt_dlp.YoutubeDL(options) as downloader:
                info = downloader.extract_info(
                    f"https://www.youtube.com/watch?v={video_id}",
                    download=False,
                )
            break
        except Exception as error:
            last_error = error
    else:
        raise RuntimeError("YouTube did not return playable formats") from last_error

    progressive_formats = [
        item
        for item in (info.get("formats") or [])
        if item.get("url")
        and item.get("protocol") in {"http", "https"}
        and item.get("acodec") not in {None, "none"}
        and item.get("vcodec") not in {None, "none"}
    ]
    preferred_formats = [
        item
        for item in progressive_formats
        if item.get("ext") == "mp4" and 0 < (item.get("height") or 0) <= 480
    ]
    selected_format = next(
        (item for item in progressive_formats if item.get("format_id") == "18"),
        max(preferred_formats, key=lambda item: item.get("height") or 0)
        if preferred_formats
        else (progressive_formats[0] if progressive_formats else info),
    )

    stream_url = str(selected_format.get("url") or "")
    stream_host = urlparse(stream_url).hostname or ""
    if not stream_url.startswith("https://") or not stream_host.endswith(".googlevideo.com"):
        raise ValueError("YouTube did not return an allowed media stream")

    metadata: dict[str, object] = {
        "url": stream_url,
        "headers": {
            str(name): str(value)
            for name, value in (
                selected_format.get("http_headers") or info.get("http_headers") or {}
            ).items()
        },
    }
    cache.set(cache_key, metadata, timeout=YOUTUBE_STREAM_CACHE_SECONDS)
    return metadata


def _open_youtube_stream(video_id: str, range_header: str | None):
    cache_key = f"youtube-stream:v5:{video_id}"
    for attempt in range(2):
        metadata = _youtube_stream_metadata(video_id)
        headers = dict(metadata["headers"])
        if range_header:
            headers["Range"] = range_header
        upstream_request = urllib.request.Request(str(metadata["url"]), headers=headers)
        try:
            return urllib.request.urlopen(upstream_request, timeout=30)
        except urllib.error.HTTPError as error:
            if error.code not in {403, 410} or attempt == 1:
                raise
            cache.delete(cache_key)
    raise RuntimeError("YouTube stream unavailable")


@require_GET
def youtube_stream(request, video_id: str):
    """Resolve and stream one validated YouTube video through the app origin."""

    if not YOUTUBE_VIDEO_ID.fullmatch(video_id):
        raise Http404("YouTube video not found")

    range_header = request.headers.get("Range")
    if range_header and not YOUTUBE_RANGE.fullmatch(range_header):
        return JsonResponse({"detail": "Invalid media range"}, status=416)

    try:
        upstream = _open_youtube_stream(video_id, range_header)
    except Exception:
        return JsonResponse({"detail": "YouTube stream is temporarily unavailable"}, status=502)

    def stream():
        try:
            while chunk := upstream.read(64 * 1024):
                yield chunk
        finally:
            upstream.close()

    response = StreamingHttpResponse(
        stream(),
        status=upstream.status,
        content_type=upstream.headers.get("Content-Type", "video/mp4"),
    )
    for header in ("Content-Length", "Content-Range", "Accept-Ranges"):
        if value := upstream.headers.get(header):
            response[header] = value
    response["Cache-Control"] = "private, no-store"
    response["Content-Disposition"] = f'inline; filename="youtube-{video_id}.mp4"'
    return response


def healthz(request):
    """Liveness: константный ответ, без обращений к зависимостям.

    Используется только рестарт-политикой оркестратора. Балансировщик и внешний
    uptime-мониторинг ходят в /readyz (ARCHITECTURE.md §7.13).
    """
    return JsonResponse({"status": "ok"})


def _check_database() -> str:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except OperationalError:
        return "unavailable"
    return "ok"


def _check_cache() -> str:
    try:
        cache.set("readyz", "1", timeout=5)
        return "ok" if cache.get("readyz") == "1" else "unavailable"
    except Exception:
        return "unavailable"


def _check_broker() -> str:
    """Брокер Celery: без него регистрация и сброс пароля теряют письма."""
    import redis

    if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
        return "ok"  # задачи выполняются на месте, брокер не нужен

    try:
        client = redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=2)
        client.ping()
    except Exception:
        return "unavailable"
    return "ok"


def readyz(request):
    """Readiness: PostgreSQL + оба Redis (§7.13). Отказ = ноду вывести из ротации."""
    checks = {
        "database": _check_database(),
        "cache": _check_cache(),
        "broker": _check_broker(),
    }
    healthy = all(value == "ok" for value in checks.values())
    return JsonResponse(
        {"status": "ready" if healthy else "unavailable", "checks": checks},
        status=200 if healthy else 503,
    )


class PingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"pong": True})

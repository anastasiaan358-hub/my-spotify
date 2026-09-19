from unittest import mock

from apps.core.views import _youtube_stream_metadata


class FakeResponse:
    def __init__(self, payload: bytes):
        self.payload = payload
        self.status = 206
        self.headers = {
            "Content-Type": "video/mp4",
            "Content-Length": str(len(payload)),
            "Content-Range": f"bytes 0-{len(payload) - 1}/{len(payload)}",
            "Accept-Ranges": "bytes",
        }
        self.closed = False

    def read(self, size: int) -> bytes:
        chunk, self.payload = self.payload[:size], self.payload[size:]
        return chunk

    def close(self):
        self.closed = True


def test_youtube_stream_proxies_media_ranges(client):
    upstream = FakeResponse(b"video")
    metadata = {
        "url": "https://rr.example.googlevideo.com/videoplayback?id=video",
        "headers": {"User-Agent": "Player agent"},
    }

    with (
        mock.patch("apps.core.views._youtube_stream_metadata", return_value=metadata),
        mock.patch("apps.core.views.urllib.request.urlopen", return_value=upstream) as urlopen,
    ):
        response = client.get(
            "/api/v1/youtube/stream/XDlxJS9bK88",
            headers={"Range": "bytes=0-4"},
        )
        body = b"".join(response.streaming_content)

    assert response.status_code == 206
    assert body == b"video"
    assert response.headers["Content-Type"] == "video/mp4"
    assert response.headers["Content-Range"] == "bytes 0-4/5"
    assert response.headers["Accept-Ranges"] == "bytes"
    request = urlopen.call_args.args[0]
    assert request.full_url == metadata["url"]
    assert request.headers["Range"] == "bytes=0-4"
    assert request.headers["User-agent"] == "Player agent"
    assert upstream.closed is True


def test_youtube_stream_rejects_invalid_video_id(client):
    response = client.get("/api/v1/youtube/stream/invalid")

    assert response.status_code == 404


def test_youtube_stream_rejects_invalid_range(client):
    response = client.get(
        "/api/v1/youtube/stream/XDlxJS9bK88",
        headers={"Range": "items=0-4"},
    )

    assert response.status_code == 416


def test_youtube_metadata_selects_progressive_mp4_format():
    downloader = mock.MagicMock()
    downloader.__enter__.return_value.extract_info.return_value = {
        "formats": [
            {
                "format_id": "140",
                "url": "https://rr.example.googlevideo.com/audio",
                "protocol": "https",
                "acodec": "mp4a.40.2",
                "vcodec": "none",
                "ext": "m4a",
            },
            {
                "format_id": "18",
                "url": "https://rr.example.googlevideo.com/video",
                "protocol": "https",
                "acodec": "mp4a.40.2",
                "vcodec": "avc1.42001E",
                "ext": "mp4",
                "height": 360,
                "http_headers": {"User-Agent": "Player agent"},
            },
        ]
    }

    with (
        mock.patch("apps.core.views.cache") as cache,
        mock.patch("yt_dlp.YoutubeDL", return_value=downloader),
    ):
        cache.get.return_value = None
        metadata = _youtube_stream_metadata("XDlxJS9bK88")

    assert metadata == {
        "url": "https://rr.example.googlevideo.com/video",
        "headers": {"User-Agent": "Player agent"},
    }
    cache.set.assert_called_once()

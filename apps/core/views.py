from django.conf import settings
from django.core.cache import cache
from django.db import OperationalError, connection
from django.http import JsonResponse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


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

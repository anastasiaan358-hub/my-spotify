from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404, JsonResponse
from rest_framework import exceptions
from rest_framework.views import exception_handler as drf_exception_handler


def error_envelope(*, code: str, message: str, details=None, request_id=None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id,
        }
    }


def exception_handler(exc, context):
    """Единый машиночитаемый конверт ошибок (ARCHITECTURE.md §7.13).

    {"error": {"code": ..., "message": ..., "details": ..., "request_id": ...}}
    Клиенты матчатся по `code`, не по тексту.
    """
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")

    # DRF подменяет эти исключения только у себя внутри, наружу отдавая Response,
    # — сюда по-прежнему приходит исходное Django-исключение. Без нормализации
    # код ошибки выродился бы в "error", а в message утекало бы сообщение ORM
    # вида "No UserDevice matches the given query."
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    if isinstance(exc, exceptions.ValidationError):
        code = "validation_error"
        message = "Некорректные данные запроса."
        details = exc.detail
    else:
        # get_codes() отдаёт код экземпляра (no_active_account, device_revoked...),
        # default_code класса — только фолбэк
        codes = exc.get_codes() if isinstance(exc, exceptions.APIException) else None
        code = codes if isinstance(codes, str) else getattr(exc, "default_code", "error") or "error"
        raw = exc.detail if isinstance(exc, exceptions.APIException) else str(exc)
        if isinstance(raw, dict):
            # simplejwt кладёт в detail словарь {detail, code, messages}
            code = str(raw.get("code", code))
            message = str(raw.get("detail", "Ошибка запроса."))
            details = raw
        elif isinstance(raw, list):
            message = str(raw[0]) if raw else "Ошибка запроса."
            details = raw
        else:
            message = str(raw)
            details = None

    response.data = error_envelope(
        code=code,
        message=message,
        details=details,
        request_id=getattr(request, "request_id", None),
    )
    return response


def server_error(request, *args, **kwargs):
    """handler500: неожиданные исключения тоже отдаются конвертом, без внутренних
    деталей (§7.13). Иначе клиент получил бы HTML-страницу Django."""
    return JsonResponse(
        error_envelope(
            code="internal_error",
            message="Внутренняя ошибка сервера.",
            request_id=getattr(request, "request_id", None),
        ),
        status=500,
    )

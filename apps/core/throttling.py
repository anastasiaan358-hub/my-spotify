"""Троттлинг, переживающий недоступность кэша.

Счётчики лимитов лежат в redis-cache, который по §5.8 разрешено терять: падение
кэша должно давать холодный кэш, а не 500 на каждый запрос к API. Поэтому при
ошибке кэша пропускаем запрос (fail-open) и пишем в лог.
"""

import logging

from rest_framework import throttling

logger = logging.getLogger(__name__)


class FailOpenMixin:
    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
            logger.exception(
                "Кэш троттлинга недоступен, лимит не применён: %s", type(self).__name__
            )
            return True


class AnonRateThrottle(FailOpenMixin, throttling.AnonRateThrottle):
    pass


class UserRateThrottle(FailOpenMixin, throttling.UserRateThrottle):
    pass


class ScopedRateThrottle(FailOpenMixin, throttling.ScopedRateThrottle):
    pass

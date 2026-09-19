FROM node:24-bookworm-slim AS node-runtime

FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# curl — для healthcheck контейнера
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/ requirements/
RUN pip install -r requirements/base.txt
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node

# Dev: + линтер и тесты, код примонтируется томом, root — чтобы не воевать с правами bind mount
FROM base AS dev
RUN pip install -r requirements/dev.txt
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# Telegram-бот запускается отдельным процессом и использует тот же каталог.
FROM base AS bot
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
RUN pip install -r requirements/bot.txt
RUN useradd --create-home botuser
COPY --chown=botuser:botuser . .
USER botuser
CMD ["python", "-m", "telegram_music_bot"]

# Prod: минимальный, непривилегированный
FROM base AS prod
COPY . .
# Статика админки собирается на сборке и раздаётся whitenoise: gunicorn сам по
# себе файлы не отдаёт, а nginx перед ним в стартовой топологии ещё не стоит.
# Значения переменных здесь фиктивные — collectstatic к БД не обращается.
RUN SECRET_KEY=build-only DATABASE_URL=sqlite:///build.db \
    DJANGO_SETTINGS_MODULE=config.settings.prod \
    python manage.py collectstatic --noinput \
    && rm -f build.db
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "180", "--access-logfile", "-"]

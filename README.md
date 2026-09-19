# My Spotify

Музыкальный стриминг-сервис: Django-бекенд, веб-клиент (React), мобильные приложения (Android, iOS).

Целевой масштаб первой версии — тысячи одновременных пользователей.

## Документация

- [ARCHITECTURE.md](ARCHITECTURE.md) — полная архитектура бекенда: хранение и доставка аудио, поиск, модель данных, API, инфраструктура.

## Быстрый старт (dev)

```bash
cp .env.example .env   # заполнить SECRET_KEY
make up
```

Без `make`: `docker compose -f docker-compose.yml -f compose.dev.yml up -d --build`.

Поднимаются: `web` (Django), `celery` и `celery-beat` (фоновые задачи и расписание),
`db` (PostgreSQL 16), `redis-cache` (кэш и троттлинг, allkeys-lru),
`redis-queue` (брокер Celery, noeviction).

Полезное: `make test`, `make lint`, `make logs`, `make superuser`, `make migrate`.

Схема API: `http://localhost:8000/api/v1/schema/`, Swagger UI (только в dev): `/api/v1/docs/`.

## Веб-клиент

React-клиент находится в [`frontend/`](frontend/README.md). Для локального запуска:

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Откройте `http://localhost:5173`. Адрес удалённого бэкенда задаётся через
`VITE_API_PROXY_TARGET` в `frontend/.env.local`.

## API

Служебные: `GET /healthz` (liveness), `GET /readyz` (PostgreSQL + Redis, сюда ходит балансировщик).

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/api/v1/auth/register` | регистрация, шлёт письмо верификации |
| POST | `/api/v1/auth/token` | вход (email + пароль), опционально с блоком `device` |
| POST | `/api/v1/auth/token/refresh` | ротация refresh-токена |
| POST | `/api/v1/auth/logout` | отзыв одного refresh-токена |
| POST | `/api/v1/auth/logout/all` | выход на всех устройствах |
| POST | `/api/v1/auth/email/verify/request` · `/confirm` | подтверждение email |
| POST | `/api/v1/auth/password/reset` · `/confirm` | сброс забытого пароля |
| GET/PATCH/DELETE | `/api/v1/me` | профиль, обновление, удаление аккаунта |
| GET | `/api/v1/me/export` | выгрузка персональных данных |
| POST | `/api/v1/me/password` | смена пароля (отзывает все сессии) |
| GET | `/api/v1/me/devices`, DELETE `/api/v1/me/devices/{id}` | устройства и их отзыв |
| GET | `/api/v1/me/subscription`, `/api/v1/plans` | подписка и тарифы |

## Telegram-бот загрузки аудио

Бот на `aiogram 3.x` принимает обычный текст, например
`Imagine Dragons - Believer` или `Бах Токката и фуга`, находит запись и присылает
готовый MP3. Поиск идёт в порядке `VK → YouTube → SoundCloud`: VK используется
при наличии `VK_TOKEN`, остальные источники обрабатывает `yt-dlp`. После загрузки
`ffmpeg` отделяет звук и создаёт MP3 320 кбит/с с именем
`Исполнитель - Название.mp3`.

SQLite хранит нормализованный запрос и Telegram `file_id`. При повторном запросе
бот отправляет файл из Telegram без повторного поиска и конвертации. База лежит в
`data/music_cache.sqlite3`; Docker сохраняет её в отдельном volume.

Скопируйте `.env.example` в `.env` и заполните как минимум:

```dotenv
TELEGRAM_BOT_TOKEN=токен_от_BotFather
ADMIN_ID=ваш_числовой_Telegram_ID
VK_TOKEN=необязательный_токен_VKpyMusic
```

`ADMIN_ID` обязателен: обновления других пользователей игнорируются. Свой ID можно
узнать у `@userinfobot`. Без `VK_TOKEN` бот пропустит VK и сразу продолжит поиск
через yt-dlp. Используйте загрузку только для записей, которые вам разрешено
скачивать и пересылать.

Запуск в Docker:

```bash
make bot
make vk-token
make vk-catalog
make bot-logs
```

`make vk-token` скрыто запросит готовый VK Music token. Если его ещё нет, нажмите
Enter: помощник запросит логин, пароль и при необходимости код 2FA, проверит
токен, запишет в `.env` только `VK_TOKEN` и `VK_USER_AGENT`, а затем пересоздаст
контейнер бота. Логин и пароль не сохраняются и не выводятся.

`make vk-catalog` запускает в фоне возобновляемый обход всех произведений
локального каталога. Для поиска и загрузки используется только VK; YouTube и
SoundCloud в этой очереди не вызываются. Каждый найденный MP3 записывается в
`frontend/public/classical/audio/vk/<composer>/<work>.mp3`, регистрируется в
`frontend/public/classical/catalog/vk-audio.json` и сразу становится доступен
в карточке произведения. Затем тот же файл отправляется владельцу бота и его
Telegram `file_id` попадает в SQLite. При первом запуске очередь также переносит
в карточки ранее отправленные файлы из Telegram-кэша. Статусы сохраняются в
`data/vk-catalog-state.jsonl`, поэтому после перезапуска готовые строки не
обрабатываются повторно. При CAPTCHA VK очередь ждёт и повторяет тот же запрос,
не помечая оставшийся каталог как проверенный.

Для локального запуска без Docker:

```bash
python -m pip install -r requirements/bot.txt
python -m telegram_music_bot
```

При локальном запуске нужен `ffmpeg` в `PATH`; Docker-образ устанавливает его сам.
Размер файла, предельная длительность и параллелизм задаются переменными
`TELEGRAM_MAX_AUDIO_MB`, `MUSIC_MAX_DURATION_SECONDS` и
`TELEGRAM_MAX_CONCURRENT_DOWNLOADS`. Полное ТЗ и критерии приёмки находятся в
[`TELEGRAM_BOT_TZ.md`](TELEGRAM_BOT_TZ.md).

## Отзыв токенов

Два независимых уровня, чтобы отзыв бил ровно туда, куда нужно:

- **цепочка** (claim `cid`) — одна последовательность refresh-токенов от одного входа.
  Гасится выходом на устройстве и детектом кражи; остальные устройства не трогаются.
  Повтор токена в пределах 10 секунд считается гонкой клиента, а не кражей.
- **все токены пользователя** (claim `tv`) — гасятся сменой и сбросом пароля и «выйти везде».

Access-токен живёт 15 минут и проверяется подписью без обращения к БД, поэтому отзыв
прекращает доступ в пределах этого окна.

## Статус

Готов «немузыкальный» контур: аутентификация (JWT с ротацией refresh, детект
переиспользования токенов, привязка к устройству), профиль, тарифы и подписки,
верификация email, сброс пароля, удаление аккаунта и экспорт данных.
Инфраструктура: Docker Compose, Celery с расписанием, два Redis, CI на GitHub Actions.
Веб-клиент дополнен локальным каталогом из 20 композиторов эпохи Возрождения:
для каждого добавлены биография, воспроизводимое произведение и PDF-партитура.
На странице `/artists/atlas` расположен расширенный индекс композиторов, чья
жизнь или деятельность пересекает XVI век: авторы разложены по папкам стран,
а проверенные линии обучения и стилистического влияния собраны в интерактивную схему.
Отдельный открытый индекс содержит 4 083 уникальных страницы произведений из
категорий композиторов в IMSLP (4 822 строки с учётом карточек-псевдонимов) и
ссылки для повторной проверки музыкальных источников в RISM.

Каталоги и открытые материалы обновляются воспроизводимыми скриптами:

```bash
python3 scripts/sync_imslp_catalog.py
python3 scripts/sync_renaissance_composers.py
python3 scripts/download_classical_assets.py
python3 scripts/publish_youtube_catalog.py
python3 scripts/enrich_work_chronology.py
python3 scripts/find_external_audio.py
python3 scripts/audit_playback_catalog.py
```

Первый скрипт обновляет индекс произведений, второй — страновой индекс XVI века.
Третий загружает только явно
разрешённые MIDI/OGG и PDF, создаёт превью нот и перезаписывает таблицу лицензий
[`frontend/public/classical/SOURCES.md`](frontend/public/classical/SOURCES.md).
Индекс IMSLP показывает доступные страницы нот и не считается исчерпывающим
научным каталогом наследия. Наличие произведения в индексе также не означает,
что для него существует свободная аудиозапись.

Скрипт хронологии ставит произведения по дате сочинения, затем по первой
исторической публикации; строки без надёжной даты помещаются в конец списка.
Сейчас датировано 3 050 уникальных произведений, у 1 033 дата не установлена.

Поиск внешнего аудио проверяет Internet Archive, Wikimedia Commons, Mutopia
Project, Musopen, Openverse и открытые оцифровки Gallica/BnF. SoundCloud и
Spotify исключены. В каталог попадают только точные
совпадения по композитору и названию; один поток не назначается нескольким разным
произведениям. Свободные MIDI Mutopia сохраняются локально, чтобы браузер мог
воспроизводить их без междоменных ограничений. Результаты находятся в
`reports/external-audio-search.md`.

Аудит прослушивания проверяет фактический статус YouTube-плеера, наличие
аудиопотока, право встраивания, прямую доступность внешних потоков и сигнатуры
локальных файлов. Он также переносит одну найденную запись во все
карточки-псевдонимы того же произведения. Последний полный результат: 2 015
уникальных произведений можно воспроизвести, для 2 068 запись не найдена.
Подробности лежат в
`reports/playback-catalog-audit.md` и `reports/playback-catalog-audit.csv`.

Проверенные ссылки на 1 992 исполнения опубликованы в My Spotify. Перед публикацией
скрипт сверяется с аудитом YouTube-плеера и исключает видео без аудиопотока или
права встраивания. По умолчанию ссылки добавляются порциями по 100; `--all`
добавляет весь остаток, а `--reset` пересобирает манифест. Видео открывается в
видимом встроенном YouTube-плеере.

Записи, для которых разрешено копирование и публикация, импортируются из локальных
файлов порциями по 25:

```bash
cp frontend/public/classical/audio/incoming/catalog.example.csv \
  frontend/public/classical/audio/incoming/catalog.csv
python3 scripts/import_cleared_audio.py
```

Формат таблицы и порядок подготовки файлов описаны в
[`frontend/public/classical/audio/incoming/README.md`](frontend/public/classical/audio/incoming/README.md).

Известное отклонение от [ARCHITECTURE.md](ARCHITECTURE.md) §7.4: refresh-токен пока
отдаётся и принимается только в теле запроса. Cookie-контур для веба (httpOnly,
`Path=/api/v1/auth/`) появится вместе с веб-клиентом.

Дальше по [ARCHITECTURE.md](ARCHITECTURE.md): серверный каталог, стриминг и поиск.

## Лицензия

[GNU GPL v3](LICENSE)

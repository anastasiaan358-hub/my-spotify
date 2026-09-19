# My Spotify frontend

Веб-клиент на React, TypeScript и Vite.

## Запуск

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

По умолчанию приложение доступно на `http://localhost:5173`, а Vite перенаправляет
`/api` на `http://127.0.0.1:8000`. Для бэкенда на другом компьютере укажите его адрес
в `VITE_API_PROXY_TARGET` внутри `.env.local`, например `http://192.168.0.42:8000`.

## Команды

```bash
pnpm build       # production-сборка
pnpm lint        # статический анализ
pnpm typecheck   # проверка TypeScript
pnpm test        # тесты
pnpm api:types   # обновить типы из локальной OpenAPI-схемы
```

Access- и refresh-токены пока хранятся только в памяти. После добавления на бэкенде
web refresh-cookie клиент уже готов отправлять cookie через `credentials: include`.

## Музыкальный архив

Каталог содержит 20 композиторов эпохи Возрождения. Аудио/MIDI, PDF-партитуры и
изображения первых страниц лежат в `public/classical/` и работают без внешнего API.
Источники и лицензии перечислены в `public/classical/SOURCES.md`.

Расширенный `/artists/atlas` строится из
`public/classical/catalog/renaissance-composers.json`: отдельная папка каждой
страны лежит в `public/classical/catalog/countries/`. Схема подтверждённых
влияний хранится в `public/classical/catalog/influences.json`. Будущие записи
можно складывать по правилам из `public/classical/audio/incoming/README.md`.

Проверенные YouTube-ссылки подключаются к видимому встроенному плееру пакетами:

```bash
python3 scripts/publish_youtube_catalog.py          # следующие 100
python3 scripts/publish_youtube_catalog.py --all    # весь остаток
```

Локальные записи с указанными источником и лицензией импортируются отдельно и
получают приоритет над YouTube-плеером:

```bash
python3 scripts/import_cleared_audio.py              # следующие 25
python3 scripts/import_cleared_audio.py --all        # все подготовленные файлы
```

Чтобы заново скачать открытые материалы и подготовить превью партитур, выполните
из корня репозитория:

```bash
python3 scripts/download_classical_assets.py
python3 scripts/sync_renaissance_composers.py
```

Для генерации PNG-превью скрипту нужен `pdftoppm`; скачивание PDF и музыки работает
и без него.

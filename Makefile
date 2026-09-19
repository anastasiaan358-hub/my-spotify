DOCKER := $(shell command -v docker 2>/dev/null || printf '%s' /Applications/Docker.app/Contents/Resources/bin/docker)
COMPOSE = $(DOCKER) compose -f docker-compose.yml -f compose.dev.yml

.PHONY: up down logs shell migrate makemigrations test lint fmt superuser rebuild bot bot-logs vk-token vk-catalog torrent-index torrent-download

up:            ## Поднять стек (web, celery, postgres, redis x2)
	$(COMPOSE) up -d

down:          ## Остановить стек
	$(COMPOSE) down

rebuild:       ## Пересобрать образы и поднять
	$(COMPOSE) up -d --build

logs:
	$(COMPOSE) logs -f web celery

shell:
	$(COMPOSE) exec web python manage.py shell

migrate:
	$(COMPOSE) run --rm web python manage.py migrate

makemigrations:
	$(COMPOSE) run --rm web python manage.py makemigrations

superuser:
	$(COMPOSE) run --rm web python manage.py createsuperuser

test:
	$(COMPOSE) run --rm web pytest

lint:
	$(COMPOSE) run --rm web sh -c "ruff format --check . && ruff check ."

fmt:
	$(COMPOSE) run --rm web sh -c "ruff format . && ruff check --fix ."

bot:           ## Собрать и запустить Telegram-бота
	$(COMPOSE) --profile telegram up -d --build telegram-bot

bot-logs:      ## Показать логи Telegram-бота
	$(COMPOSE) --profile telegram logs -f telegram-bot

vk-token:      ## Безопасно добавить и проверить VK Music token, затем перезапустить бота
	$(COMPOSE) --profile telegram exec telegram-bot python scripts/configure_vk_token.py
	$(COMPOSE) --profile telegram up -d --force-recreate telegram-bot
	$(COMPOSE) --profile telegram up -d --no-build telegram-vk-catalog

vk-catalog:    ## Найти каталог в VK, отправить в Telegram и подключить MP3 к карточкам
	$(COMPOSE) --profile telegram up -d --no-build telegram-vk-catalog

torrent-index: ## Обновить индекс разрешённых torrent-каталогов и найти точные совпадения
	$(COMPOSE) run --rm web python scripts/index_open_torrent_catalogs.py

torrent-download: ## Скачать точные открыто лицензированные совпадения и подключить их к карточкам
	$(COMPOSE) run --rm web python scripts/download_open_torrent_audio.py

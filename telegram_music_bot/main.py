from __future__ import annotations

import asyncio
import logging
import tempfile
from contextlib import suppress
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.enums import ChatAction
from aiogram.exceptions import TelegramBadRequest, TelegramNetworkError
from aiogram.filters import Command, CommandStart
from aiogram.types import FSInputFile, Message

from telegram_music_bot.config import BotConfig, ConfigurationError
from telegram_music_bot.database import MusicCache
from telegram_music_bot.downloader import MusicDownloader, MusicDownloadError

LOGGER = logging.getLogger(__name__)


class MusicBot:
    def __init__(
        self,
        *,
        config: BotConfig,
        cache: MusicCache,
        downloader: MusicDownloader,
    ) -> None:
        self.config = config
        self.cache = cache
        self.downloader = downloader
        self.download_slots = asyncio.Semaphore(config.max_concurrent_downloads)
        self.router = Router(name=__name__)
        self._register_handlers()

    def _register_handlers(self) -> None:
        admin = F.from_user.id == self.config.admin_id
        self.router.message.register(self.start, CommandStart(), admin)
        self.router.message.register(self.help, Command("help"), admin)
        self.router.message.register(self.whoami, Command("whoami"), admin)
        self.router.message.register(self.handle_text_query, F.text, admin)

    async def start(self, message: Message) -> None:
        await message.answer(
            "Напишите название композиции и/или исполнителя. "
            "Я найду разрешённую для загрузки запись, подготовлю MP3 и пришлю её сюда. "
            "Повторный запрос будет отправлен мгновенно из кэша Telegram."
        )

    async def help(self, message: Message) -> None:
        await self.start(message)

    async def whoami(self, message: Message) -> None:
        if message.from_user:
            await message.answer(f"Ваш Telegram ID: {message.from_user.id}")

    async def answer_from_cache(self, message: Message, query: str) -> bool:
        cached = self.cache.get(query)
        if cached is None:
            return False
        try:
            await message.answer_audio(
                audio=cached.file_id,
                performer=cached.performer or None,
                title=cached.title or None,
            )
        except TelegramBadRequest:
            LOGGER.warning("Telegram file_id is stale for query %r", query)
            self.cache.delete(query)
            return False
        return True

    async def handle_text_query(self, message: Message, bot: Bot) -> None:
        query = " ".join((message.text or "").split()).strip()
        if not query or query.startswith("/"):
            return
        if len(query) > 200:
            await message.answer("Запрос слишком длинный. Оставьте имя исполнителя и название.")
            return

        if await self.answer_from_cache(message, query):
            return

        status = await message.answer("Ищу запись…")
        try:
            async with self.download_slots:
                # Другой запрос мог заполнить кэш, пока этот ждал очередь.
                if await self.answer_from_cache(message, query):
                    with suppress(TelegramBadRequest):
                        await status.delete()
                    return
                await bot.send_chat_action(message.chat.id, ChatAction.UPLOAD_VOICE)
                with tempfile.TemporaryDirectory(prefix="music-search-") as directory:
                    track = await asyncio.to_thread(
                        self.downloader.download,
                        query,
                        Path(directory),
                    )
                    await status.edit_text("Готовлю и отправляю MP3…")
                    sent = await message.answer_audio(
                        audio=FSInputFile(track.path, filename=track.filename),
                        performer=track.performer or None,
                        title=track.title or None,
                        duration=track.duration,
                        caption=f"Источник: {track.source}",
                    )
                    if not sent.audio:
                        raise MusicDownloadError("Telegram не вернул file_id аудиофайла")
                    self.cache.put(
                        query=query,
                        file_id=sent.audio.file_id,
                        file_unique_id=sent.audio.file_unique_id,
                        performer=track.performer,
                        title=track.title,
                        source=track.source,
                        source_url=track.source_url,
                    )
        except MusicDownloadError as exc:
            LOGGER.warning("Music request failed for %r: %s", query, exc)
            await status.edit_text(f"Не удалось найти запись: {str(exc)[:350]}")
        except (TelegramBadRequest, TelegramNetworkError) as exc:
            LOGGER.warning("Telegram upload failed for %r: %s", query, exc)
            await status.edit_text("Не удалось отправить MP3 в Telegram. Попробуйте ещё раз.")
        except Exception:
            LOGGER.exception("Unexpected music request failure for %r", query)
            await status.edit_text("Внутренняя ошибка поиска. Попробуйте другой запрос.")
        else:
            with suppress(TelegramBadRequest):
                await status.delete()


def build_dispatcher(config: BotConfig) -> Dispatcher:
    cache = MusicCache(config.database_path)
    cache.initialize()
    downloader = MusicDownloader(
        providers=config.providers,
        vk_token=config.vk_token,
        vk_user_agent=config.vk_user_agent,
        max_audio_bytes=config.max_audio_bytes,
        max_duration_seconds=config.max_duration_seconds,
    )
    music_bot = MusicBot(config=config, cache=cache, downloader=downloader)
    dispatcher = Dispatcher()
    dispatcher.include_router(music_bot.router)
    return dispatcher


async def run() -> None:
    config = BotConfig.from_environment()
    bot = Bot(token=config.token, session=AiohttpSession(timeout=180))
    dispatcher = build_dispatcher(config)
    try:
        await dispatcher.start_polling(
            bot,
            allowed_updates=dispatcher.resolve_used_update_types(),
            tasks_concurrency_limit=config.max_concurrent_downloads + 2,
        )
    finally:
        await bot.session.close()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("aiogram.event").setLevel(logging.WARNING)
    try:
        asyncio.run(run())
    except ConfigurationError as exc:
        raise SystemExit(str(exc)) from exc

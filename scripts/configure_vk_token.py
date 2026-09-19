from __future__ import annotations

import getpass
import logging
import os
import sys
from pathlib import Path

from vkpymusic import Service, TokenReceiver

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
DEFAULT_USER_AGENT = "VKAndroidApp/8.82-19243 (Android 14; SDK 34; arm64-v8a)"


def _read_env_value(name: str, default: str = "") -> str:
    if not ENV_PATH.is_file():
        return default
    prefix = f"{name}="
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if line.startswith(prefix):
            return line.removeprefix(prefix).strip()
    return default


def _save_env_values(values: dict[str, str]) -> None:
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines() if ENV_PATH.is_file() else []
    remaining = dict(values)
    updated: list[str] = []
    for line in lines:
        name, separator, _ = line.partition("=")
        if separator and name in remaining:
            updated.append(f"{name}={remaining.pop(name)}")
        else:
            updated.append(line)
    if updated and remaining:
        updated.append("")
    updated.extend(f"{name}={value}" for name, value in remaining.items())

    temporary = ENV_PATH.with_name(f".{ENV_PATH.name}.tmp")
    temporary.write_text("\n".join(updated).rstrip() + "\n", encoding="utf-8")
    temporary.chmod(0o600)
    os.replace(temporary, ENV_PATH)


def _receive_token() -> tuple[str, str]:
    login = input("Логин VK (телефон или email): ").strip()
    if not login:
        raise RuntimeError("Логин VK не указан")
    password = getpass.getpass("Пароль VK (не сохраняется): ")
    if not password:
        raise RuntimeError("Пароль VK не указан")

    silent_logger = logging.getLogger("vk-token-setup")
    silent_logger.handlers.clear()
    silent_logger.addHandler(logging.NullHandler())
    silent_logger.setLevel(logging.CRITICAL + 1)

    receiver = TokenReceiver(login, password, logger=silent_logger)
    del password
    if not receiver.auth():
        raise RuntimeError("VK не подтвердил вход")
    token = receiver.get_token()
    if not token:
        raise RuntimeError("VK не вернул токен")
    return token, str(receiver.client.user_agent)


def _validate_token(token: str, user_agent: str) -> None:
    try:
        valid = Service(user_agent, token).is_token_valid()
    except Exception as exc:
        raise RuntimeError(f"Не удалось проверить токен VK: {exc}") from exc
    if not valid:
        raise RuntimeError("VK отклонил токен")


def main() -> int:
    print("Токен и пароль вводятся скрыто. Пароль и логин не сохраняются.")
    token = getpass.getpass(
        "Готовый VK Music token (Enter — получить по логину и паролю): "
    ).strip()
    user_agent = _read_env_value("VK_USER_AGENT", DEFAULT_USER_AGENT)
    if not token:
        token, user_agent = _receive_token()

    _validate_token(token, user_agent)
    _save_env_values({"VK_TOKEN": token, "VK_USER_AGENT": user_agent})
    print("VK-токен проверен и сохранён в .env. Сам токен в вывод не записан.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (EOFError, KeyboardInterrupt):
        print("\nНастройка отменена.", file=sys.stderr)
        raise SystemExit(130) from None
    except RuntimeError as exc:
        print(f"Ошибка: {exc}", file=sys.stderr)
        raise SystemExit(1) from None

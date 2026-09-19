from __future__ import annotations

import sqlite3
import unicodedata
from dataclasses import dataclass
from pathlib import Path


def normalize_query(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold()
    return " ".join(normalized.split())


@dataclass(frozen=True)
class CachedTrack:
    query_key: str
    query_text: str
    file_id: str
    file_unique_id: str
    performer: str
    title: str
    source: str
    source_url: str


class MusicCache:
    def __init__(self, path: Path) -> None:
        self.path = path

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS track_cache (
                    query_key TEXT PRIMARY KEY,
                    query_text TEXT NOT NULL,
                    file_id TEXT NOT NULL,
                    file_unique_id TEXT NOT NULL DEFAULT '',
                    performer TEXT NOT NULL DEFAULT '',
                    title TEXT NOT NULL DEFAULT '',
                    source TEXT NOT NULL DEFAULT '',
                    source_url TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

    def get(self, query: str) -> CachedTrack | None:
        key = normalize_query(query)
        if not key:
            return None
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT query_key, query_text, file_id, file_unique_id,
                       performer, title, source, source_url
                FROM track_cache
                WHERE query_key = ?
                """,
                (key,),
            ).fetchone()
        return CachedTrack(**dict(row)) if row else None

    def all_by_source(self, source: str) -> dict[str, CachedTrack]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT query_key, query_text, file_id, file_unique_id,
                       performer, title, source, source_url
                FROM track_cache
                WHERE source = ?
                """,
                (source,),
            ).fetchall()
        return {
            str(row["query_key"]): CachedTrack(**dict(row))
            for row in rows
        }

    def put(
        self,
        *,
        query: str,
        file_id: str,
        file_unique_id: str = "",
        performer: str = "",
        title: str = "",
        source: str = "",
        source_url: str = "",
    ) -> None:
        key = normalize_query(query)
        if not key or not file_id:
            raise ValueError("query и file_id обязательны")
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO track_cache (
                    query_key, query_text, file_id, file_unique_id,
                    performer, title, source, source_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(query_key) DO UPDATE SET
                    query_text = excluded.query_text,
                    file_id = excluded.file_id,
                    file_unique_id = excluded.file_unique_id,
                    performer = excluded.performer,
                    title = excluded.title,
                    source = excluded.source,
                    source_url = excluded.source_url,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    key,
                    query.strip(),
                    file_id,
                    file_unique_id,
                    performer,
                    title,
                    source,
                    source_url,
                ),
            )

    def delete(self, query: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM track_cache WHERE query_key = ?",
                (normalize_query(query),),
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        return connection

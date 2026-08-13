"""SQLite persistence for dynamic field definitions.

Field definitions are shared across the app because there is intentionally no
user authentication in this MVP. This database stores schema/configuration,
not uploaded PDFs or extracted document data.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from industries import INDUSTRIES

DB_PATH = Path(__file__).resolve().parent / "app.db"


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _slug(value: str) -> str:
    import re
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return value


def init_db() -> None:
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS fields (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                industry_key TEXT NOT NULL,
                field_key TEXT NOT NULL,
                label TEXT NOT NULL,
                field_type TEXT NOT NULL CHECK(field_type IN ('text','date','number')),
                position INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(industry_key, field_key)
            )
        """)

        for industry_key, cfg in INDUSTRIES.items():
            for position, field in enumerate(cfg["fields"]):
                conn.execute(
                    """
                    INSERT OR IGNORE INTO fields
                    (industry_key, field_key, label, field_type, position, active)
                    VALUES (?, ?, ?, ?, ?, 1)
                    """,
                    (industry_key, field["key"], field["label"], field["type"], position),
                )


def list_fields(industry_key: str, active_only: bool = True) -> list[dict]:
    query = "SELECT id, industry_key, field_key, label, field_type, position, active FROM fields WHERE industry_key = ?"
    params: list[object] = [industry_key]
    if active_only:
        query += " AND active = 1"
    query += " ORDER BY position, id"
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [
        {
            "id": row["id"],
            "key": row["field_key"],
            "label": row["label"],
            "type": row["field_type"],
            "position": row["position"],
            "active": bool(row["active"]),
        }
        for row in rows
    ]


def add_field(industry_key: str, label: str, field_type: str, field_key: str | None = None) -> dict:
    field_key = _slug(field_key or label)
    if not field_key:
        raise ValueError("Field key is required")
    if field_type not in {"text", "date", "number"}:
        raise ValueError("Field type must be text, date, or number")

    existing = list_fields(industry_key, active_only=False)
    if any(f["key"] == field_key for f in existing):
        raise ValueError(f"Field key '{field_key}' already exists")

    position = max((f["position"] for f in existing), default=-1) + 1
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO fields (industry_key, field_key, label, field_type, position, active)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (industry_key, field_key, label.strip(), field_type, position),
        )
        field_id = cur.lastrowid
    return next(f for f in list_fields(industry_key, active_only=False) if f["id"] == field_id)


def update_field(industry_key: str, field_id: int, label: str, field_type: str) -> dict:
    if field_type not in {"text", "date", "number"}:
        raise ValueError("Field type must be text, date, or number")
    label = label.strip()
    if not label:
        raise ValueError("Field label is required")
    with get_connection() as conn:
        cur = conn.execute(
            """
            UPDATE fields
            SET label = ?, field_type = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND industry_key = ?
            """,
            (label, field_type, field_id, industry_key),
        )
        if cur.rowcount == 0:
            raise ValueError("Field not found")
    return next(f for f in list_fields(industry_key, active_only=False) if f["id"] == field_id)


def deactivate_field(industry_key: str, field_id: int) -> None:
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE fields SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND industry_key = ?",
            (field_id, industry_key),
        )
        if cur.rowcount == 0:
            raise ValueError("Field not found")

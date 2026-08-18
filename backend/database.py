from __future__ import annotations

import json
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

from industries import INDUSTRIES

DB_PATH = "app.db"


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = re.sub(r"_+", "_", value)
    return value.strip("_")


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
        (table_name,),
    ).fetchone()
    return row is not None


def _table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    if not _table_exists(conn, table_name):
        return set()
    return {str(row["name"]) for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}


def _create_users_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )


def _create_fields_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            industry TEXT NOT NULL,
            field_key TEXT NOT NULL,
            label TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'text',
            is_default INTEGER NOT NULL DEFAULT 1,
            user_id INTEGER NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )


def _ensure_fields_schema(conn: sqlite3.Connection) -> None:
    if not _table_exists(conn, "fields"):
        _create_fields_table(conn)
        return

    columns = _table_columns(conn, "fields")
    required = {
        "id", "industry", "field_key", "label", "type", "is_default",
        "user_id", "is_active", "created_at", "updated_at",
    }
    if required.issubset(columns):
        return

    conn.execute("ALTER TABLE fields RENAME TO fields_legacy")
    _create_fields_table(conn)
    legacy_columns = _table_columns(conn, "fields_legacy")

    industry_col = "industry" if "industry" in legacy_columns else None
    key_col = "field_key" if "field_key" in legacy_columns else ("key" if "key" in legacy_columns else None)
    label_col = "label" if "label" in legacy_columns else None
    type_col = "type" if "type" in legacy_columns else None

    if industry_col and key_col and label_col:
        type_expr = type_col or "'text'"
        now = _now()
        conn.execute(
            f"""
            INSERT INTO fields (
                industry, field_key, label, type, is_default,
                user_id, is_active, created_at, updated_at
            )
            SELECT {industry_col}, {key_col}, {label_col}, {type_expr},
                   1, NULL, 1, ?, ?
            FROM fields_legacy
            """,
            (now, now),
        )

    conn.execute("DROP TABLE fields_legacy")


def _create_documents_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            industry TEXT NOT NULL,
            source_label TEXT,
            doc_title TEXT NOT NULL,
            industry_label TEXT NOT NULL,
            extracted_json TEXT NOT NULL,
            validation_json TEXT NOT NULL,
            field_schema_json TEXT NOT NULL,
            overall TEXT NOT NULL,
            ai_provider TEXT,
            fallback_used INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )


def init_db() -> None:
    with get_db() as conn:
        _create_users_table(conn)
        _ensure_fields_schema(conn)
        _create_documents_table(conn)

        for industry_key, config in INDUSTRIES.items():
            for field in config.get("fields", []):
                field_key = field.get("key") or field.get("field_key")
                if not field_key:
                    continue
                label = field.get("label", field_key)
                field_type = field.get("type", "text")

                existing = conn.execute(
                    """
                    SELECT id FROM fields
                    WHERE industry=? AND field_key=? AND is_default=1
                    LIMIT 1
                    """,
                    (industry_key, field_key),
                ).fetchone()
                if existing:
                    continue

                now = _now()
                conn.execute(
                    """
                    INSERT INTO fields (
                        industry, field_key, label, type,
                        is_default, user_id, is_active, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, 1, NULL, 1, ?, ?)
                    """,
                    (industry_key, field_key, label, field_type, now, now),
                )


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

def create_user(email: str, password_hash: str) -> dict[str, Any] | None:
    email = email.strip().lower()
    with get_db() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
                (email, password_hash, _now()),
            )
        except sqlite3.IntegrityError:
            return None
        user_id = int(cursor.lastrowid)
    return get_user_by_id(user_id)


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, created_at FROM users WHERE email=? LIMIT 1",
            (email.strip().lower(),),
        ).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, email, created_at FROM users WHERE id=? LIMIT 1",
            (user_id,),
        ).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Fields
# ---------------------------------------------------------------------------

def _field_from_row(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    result["is_default"] = bool(result.get("is_default"))
    result["is_active"] = bool(result.get("is_active"))
    return result


def list_fields(industry: str, user_id: int | None = None) -> list[dict[str, Any]]:
    with get_db() as conn:
        if user_id is None:
            rows = conn.execute(
                """
                SELECT id, industry, field_key AS key, label, type,
                       is_default, user_id, is_active
                FROM fields
                WHERE industry=? AND is_active=1 AND is_default=1
                ORDER BY id ASC
                """,
                (industry,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, industry, field_key AS key, label, type,
                       is_default, user_id, is_active
                FROM fields
                WHERE industry=? AND is_active=1
                  AND (is_default=1 OR user_id=?)
                ORDER BY is_default DESC, id ASC
                """,
                (industry, user_id),
            ).fetchall()
    return [_field_from_row(row) for row in rows]


def get_field(industry: str, field_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT id, industry, field_key AS key, label, type,
                   is_default, user_id, is_active
            FROM fields
            WHERE industry=? AND id=? LIMIT 1
            """,
            (industry, field_id),
        ).fetchone()
    return _field_from_row(row) if row else None


def add_field(industry: str, label: str, field_type: str, key: str | None, user_id: int) -> dict[str, Any]:
    label = label.strip()
    if not label:
        raise ValueError("Field label is required.")
    if field_type not in {"text", "date", "number"}:
        raise ValueError("Unsupported field type.")

    field_key = _slugify(key) if key and key.strip() else _slugify(label)
    if not field_key:
        raise ValueError("Could not generate a valid field key.")

    with get_db() as conn:
        if conn.execute(
            "SELECT id FROM fields WHERE industry=? AND field_key=? AND is_default=1 LIMIT 1",
            (industry, field_key),
        ).fetchone():
            raise ValueError("This field key conflicts with a default field.")
        if conn.execute(
            "SELECT id FROM fields WHERE industry=? AND field_key=? AND user_id=? LIMIT 1",
            (industry, field_key, user_id),
        ).fetchone():
            raise ValueError("You already have a custom field with this key.")

        now = _now()
        cursor = conn.execute(
            """
            INSERT INTO fields (
                industry, field_key, label, type, is_default,
                user_id, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 0, ?, 1, ?, ?)
            """,
            (industry, field_key, label, field_type, user_id, now, now),
        )
        field_id = int(cursor.lastrowid)

    result = get_field(industry, field_id)
    if not result:
        raise ValueError("Field could not be created.")
    return result


def update_field(industry: str, field_id: int, label: str, field_type: str, user_id: int) -> dict[str, Any]:
    field = get_field(industry, field_id)
    if not field:
        raise ValueError("Field not found.")
    if field["is_default"]:
        raise PermissionError("Default fields cannot be modified.")
    if field["user_id"] != user_id:
        raise PermissionError("You do not own this field.")
    if not label.strip():
        raise ValueError("Field label is required.")
    if field_type not in {"text", "date", "number"}:
        raise ValueError("Unsupported field type.")

    with get_db() as conn:
        conn.execute(
            """
            UPDATE fields SET label=?, type=?, updated_at=?
            WHERE id=? AND industry=? AND user_id=? AND is_default=0
            """,
            (label.strip(), field_type, _now(), field_id, industry, user_id),
        )
    return get_field(industry, field_id) or {}


def deactivate_field(industry: str, field_id: int, user_id: int) -> None:
    field = get_field(industry, field_id)
    if not field:
        raise ValueError("Field not found.")
    if field["is_default"]:
        raise PermissionError("Default fields cannot be deleted.")
    if field["user_id"] != user_id:
        raise PermissionError("You do not own this field.")

    with get_db() as conn:
        conn.execute(
            """
            UPDATE fields SET is_active=0, updated_at=?
            WHERE id=? AND industry=? AND user_id=? AND is_default=0
            """,
            (_now(), field_id, industry, user_id),
        )


# ---------------------------------------------------------------------------
# Documents - persistent per user
# ---------------------------------------------------------------------------

def create_document(
    *,
    user_id: int,
    industry: str,
    source_label: str,
    doc_title: str,
    industry_label: str,
    extracted: dict,
    validation: list[dict],
    field_schema: list[dict],
    overall: str,
    ai_provider: str | None,
    fallback_used: bool,
) -> dict[str, Any]:
    now = _now()
    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO documents (
                user_id, industry, source_label, doc_title, industry_label,
                extracted_json, validation_json, field_schema_json,
                overall, ai_provider, fallback_used, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                industry,
                source_label,
                doc_title,
                industry_label,
                json.dumps(extracted, ensure_ascii=False),
                json.dumps(validation, ensure_ascii=False),
                json.dumps(field_schema, ensure_ascii=False),
                overall,
                ai_provider,
                1 if fallback_used else 0,
                now,
                now,
            ),
        )
        document_id = int(cursor.lastrowid)
    return get_document(user_id, document_id) or {}


def get_document(user_id: int, document_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM documents WHERE id=? AND user_id=? LIMIT 1",
            (document_id, user_id),
        ).fetchone()
    if not row:
        return None
    return _document_from_row(row)


def list_documents(user_id: int, limit: int = 200) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM documents WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [_document_from_row(row) for row in rows]


def delete_document(
    *,
    user_id: int,
    document_id: int,
) -> None:
    existing = get_document(user_id, document_id)
    if not existing:
        raise ValueError("Document not found.")

    with get_db() as conn:
        conn.execute(
            "DELETE FROM documents WHERE id=? AND user_id=?",
            (document_id, user_id),
        )


def update_document(
    *,
    user_id: int,
    document_id: int,
    extracted: dict,
    validation: list[dict] | None = None,
    overall: str | None = None,
) -> dict[str, Any]:
    existing = get_document(user_id, document_id)
    if not existing:
        raise ValueError("Document not found.")

    next_validation = validation if validation is not None else existing["validation"]
    next_overall = overall if overall is not None else existing["overall"]

    with get_db() as conn:
        conn.execute(
            """
            UPDATE documents
            SET extracted_json=?, validation_json=?, overall=?, updated_at=?
            WHERE id=? AND user_id=?
            """,
            (
                json.dumps(extracted, ensure_ascii=False),
                json.dumps(next_validation, ensure_ascii=False),
                next_overall,
                _now(),
                document_id,
                user_id,
            ),
        )
    return get_document(user_id, document_id) or {}


def _document_from_row(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    result["extracted"] = json.loads(result.pop("extracted_json") or "{}")
    result["validation"] = json.loads(result.pop("validation_json") or "[]")
    result["field_schema"] = json.loads(result.pop("field_schema_json") or "[]")
    result["fallback_used"] = bool(result["fallback_used"])
    return result
from __future__ import annotations

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


def _table_exists(
    conn: sqlite3.Connection,
    table_name: str,
) -> bool:
    row = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        LIMIT 1
        """,
        (table_name,),
    ).fetchone()

    return row is not None


def _table_columns(
    conn: sqlite3.Connection,
    table_name: str,
) -> set[str]:
    if not _table_exists(
        conn,
        table_name,
    ):
        return set()

    rows = conn.execute(
        f"PRAGMA table_info({table_name})"
    ).fetchall()

    return {
        str(row["name"])
        for row in rows
    }


def _create_users_table(
    conn: sqlite3.Connection,
) -> None:
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


def _create_fields_table(
    conn: sqlite3.Connection,
) -> None:
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
            FOREIGN KEY(user_id)
                REFERENCES users(id)
        )
        """
    )


def _ensure_fields_schema(
    conn: sqlite3.Connection,
) -> None:
    """
    Handles old versions of the fields table.

    If an old incompatible schema exists, the table is rebuilt.
    """

    if not _table_exists(
        conn,
        "fields",
    ):
        _create_fields_table(conn)
        return

    columns = _table_columns(
        conn,
        "fields",
    )

    required_columns = {
        "id",
        "industry",
        "field_key",
        "label",
        "type",
        "is_default",
        "user_id",
        "is_active",
        "created_at",
        "updated_at",
    }

    # Existing database is from an older application schema.
    if not required_columns.issubset(
        columns
    ):
        conn.execute(
            """
            ALTER TABLE fields
            RENAME TO fields_legacy
            """
        )

        _create_fields_table(conn)

        # Try to preserve data from common old field schemas.
        legacy_columns = _table_columns(
            conn,
            "fields_legacy",
        )

        old_industry_column = (
            "industry"
            if "industry" in legacy_columns
            else None
        )

        old_key_column = None

        if "field_key" in legacy_columns:
            old_key_column = "field_key"
        elif "key" in legacy_columns:
            old_key_column = "key"

        old_label_column = (
            "label"
            if "label" in legacy_columns
            else None
        )

        old_type_column = (
            "type"
            if "type" in legacy_columns
            else None
        )

        if (
            old_industry_column
            and old_key_column
            and old_label_column
        ):
            type_expression = (
                old_type_column
                if old_type_column
                else "'text'"
            )

            conn.execute(
                f"""
                INSERT INTO fields (
                    industry,
                    field_key,
                    label,
                    type,
                    is_default,
                    user_id,
                    is_active,
                    created_at,
                    updated_at
                )
                SELECT
                    {old_industry_column},
                    {old_key_column},
                    {old_label_column},
                    {type_expression},
                    1,
                    NULL,
                    1,
                    ?,
                    ?
                FROM fields_legacy
                """,
                (
                    _now(),
                    _now(),
                ),
            )

        conn.execute(
            """
            DROP TABLE fields_legacy
            """
        )


def init_db() -> None:
    with get_db() as conn:
        _create_users_table(conn)
        _ensure_fields_schema(conn)

        # Seed original/global default fields from industries.py.
        for industry_key, config in INDUSTRIES.items():
            default_fields = config.get(
                "fields",
                [],
            )

            for field in default_fields:
                field_key = (
                    field.get("key")
                    or field.get("field_key")
                )

                if not field_key:
                    continue

                label = field.get(
                    "label",
                    field_key,
                )

                field_type = field.get(
                    "type",
                    "text",
                )

                existing = conn.execute(
                    """
                    SELECT id
                    FROM fields
                    WHERE industry = ?
                      AND field_key = ?
                      AND is_default = 1
                    LIMIT 1
                    """,
                    (
                        industry_key,
                        field_key,
                    ),
                ).fetchone()

                if existing:
                    continue

                now = _now()

                conn.execute(
                    """
                    INSERT INTO fields (
                        industry,
                        field_key,
                        label,
                        type,
                        is_default,
                        user_id,
                        is_active,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        ?, ?, ?, ?, 1, NULL, 1, ?, ?
                    )
                    """,
                    (
                        industry_key,
                        field_key,
                        label,
                        field_type,
                        now,
                        now,
                    ),
                )


# ============================================================================
# USERS
# ============================================================================

def create_user(
    email: str,
    password_hash: str,
) -> dict[str, Any] | None:
    email = email.strip().lower()

    with get_db() as conn:
        try:
            cursor = conn.execute(
                """
                INSERT INTO users (
                    email,
                    password_hash,
                    created_at
                )
                VALUES (?, ?, ?)
                """,
                (
                    email,
                    password_hash,
                    _now(),
                ),
            )
        except sqlite3.IntegrityError:
            return None

        user_id = int(
            cursor.lastrowid
        )

    return get_user_by_id(
        user_id
    )


def get_user_by_email(
    email: str,
) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                email,
                password_hash,
                created_at
            FROM users
            WHERE email = ?
            LIMIT 1
            """,
            (
                email.strip().lower(),
            ),
        ).fetchone()

    return (
        dict(row)
        if row
        else None
    )


def get_user_by_id(
    user_id: int,
) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                email,
                created_at
            FROM users
            WHERE id = ?
            LIMIT 1
            """,
            (user_id,),
        ).fetchone()

    return (
        dict(row)
        if row
        else None
    )


# ============================================================================
# FIELDS
# ============================================================================

def _field_from_row(
    row: sqlite3.Row,
) -> dict[str, Any]:
    result = dict(row)

    result["is_default"] = bool(
        result.get("is_default")
    )

    result["is_active"] = bool(
        result.get("is_active")
    )

    return result


def list_fields(
    industry: str,
    user_id: int | None = None,
) -> list[dict[str, Any]]:
    with get_db() as conn:
        if user_id is None:
            rows = conn.execute(
                """
                SELECT
                    id,
                    industry,
                    field_key AS key,
                    label,
                    type,
                    is_default,
                    user_id,
                    is_active
                FROM fields
                WHERE industry = ?
                  AND is_active = 1
                  AND is_default = 1
                ORDER BY id ASC
                """,
                (industry,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT
                    id,
                    industry,
                    field_key AS key,
                    label,
                    type,
                    is_default,
                    user_id,
                    is_active
                FROM fields
                WHERE industry = ?
                  AND is_active = 1
                  AND (
                      is_default = 1
                      OR user_id = ?
                  )
                ORDER BY
                    is_default DESC,
                    id ASC
                """,
                (
                    industry,
                    user_id,
                ),
            ).fetchall()

    return [
        _field_from_row(row)
        for row in rows
    ]


def get_field(
    industry: str,
    field_id: int,
) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                industry,
                field_key AS key,
                label,
                type,
                is_default,
                user_id,
                is_active
            FROM fields
            WHERE industry = ?
              AND id = ?
            LIMIT 1
            """,
            (
                industry,
                field_id,
            ),
        ).fetchone()

    return (
        _field_from_row(row)
        if row
        else None
    )


def add_field(
    industry: str,
    label: str,
    field_type: str,
    key: str | None,
    user_id: int,
) -> dict[str, Any]:
    label = label.strip()

    if not label:
        raise ValueError(
            "Field label is required."
        )

    if field_type not in {
        "text",
        "date",
        "number",
    }:
        raise ValueError(
            "Unsupported field type."
        )

    field_key = (
        _slugify(key)
        if key and key.strip()
        else _slugify(label)
    )

    if not field_key:
        raise ValueError(
            "Could not generate a valid field key."
        )

    with get_db() as conn:
        default_conflict = conn.execute(
            """
            SELECT id
            FROM fields
            WHERE industry = ?
              AND field_key = ?
              AND is_default = 1
            LIMIT 1
            """,
            (
                industry,
                field_key,
            ),
        ).fetchone()

        if default_conflict:
            raise ValueError(
                "This field key conflicts with a default field."
            )

        custom_conflict = conn.execute(
            """
            SELECT id
            FROM fields
            WHERE industry = ?
              AND field_key = ?
              AND user_id = ?
            LIMIT 1
            """,
            (
                industry,
                field_key,
                user_id,
            ),
        ).fetchone()

        if custom_conflict:
            raise ValueError(
                "You already have a custom field with this key."
            )

        now = _now()

        cursor = conn.execute(
            """
            INSERT INTO fields (
                industry,
                field_key,
                label,
                type,
                is_default,
                user_id,
                is_active,
                created_at,
                updated_at
            )
            VALUES (
                ?, ?, ?, ?, 0, ?, 1, ?, ?
            )
            """,
            (
                industry,
                field_key,
                label,
                field_type,
                user_id,
                now,
                now,
            ),
        )

        field_id = int(
            cursor.lastrowid
        )

    result = get_field(
        industry,
        field_id,
    )

    if not result:
        raise ValueError(
            "Field could not be created."
        )

    return result


def update_field(
    industry: str,
    field_id: int,
    label: str,
    field_type: str,
    user_id: int,
) -> dict[str, Any]:
    field = get_field(
        industry,
        field_id,
    )

    if not field:
        raise ValueError(
            "Field not found."
        )

    if field["is_default"]:
        raise PermissionError(
            "Default fields cannot be modified."
        )

    if field["user_id"] != user_id:
        raise PermissionError(
            "You do not own this field."
        )

    label = label.strip()

    if not label:
        raise ValueError(
            "Field label is required."
        )

    if field_type not in {
        "text",
        "date",
        "number",
    }:
        raise ValueError(
            "Unsupported field type."
        )

    with get_db() as conn:
        conn.execute(
            """
            UPDATE fields
            SET
                label = ?,
                type = ?,
                updated_at = ?
            WHERE id = ?
              AND industry = ?
              AND user_id = ?
              AND is_default = 0
            """,
            (
                label,
                field_type,
                _now(),
                field_id,
                industry,
                user_id,
            ),
        )

    return (
        get_field(
            industry,
            field_id,
        )
        or {}
    )


def deactivate_field(
    industry: str,
    field_id: int,
    user_id: int,
) -> None:
    field = get_field(
        industry,
        field_id,
    )

    if not field:
        raise ValueError(
            "Field not found."
        )

    if field["is_default"]:
        raise PermissionError(
            "Default fields cannot be deleted."
        )

    if field["user_id"] != user_id:
        raise PermissionError(
            "You do not own this field."
        )

    with get_db() as conn:
        conn.execute(
            """
            UPDATE fields
            SET
                is_active = 0,
                updated_at = ?
            WHERE id = ?
              AND industry = ?
              AND user_id = ?
              AND is_default = 0
            """,
            (
                _now(),
                field_id,
                industry,
                user_id,
            ),
        )
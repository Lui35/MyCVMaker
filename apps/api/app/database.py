import json
import sqlite3
import uuid
from pathlib import Path

from .models import CVPayload

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "cvmaker.db"


def get_conn() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cvs (
                id TEXT PRIMARY KEY,
                version_name TEXT NOT NULL DEFAULT 'My CV',
                is_default INTEGER NOT NULL DEFAULT 0,
                full_name TEXT NOT NULL,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                style TEXT NOT NULL,
                date_format TEXT NOT NULL DEFAULT 'MMM YYYY',
                experiences_json TEXT NOT NULL,
                programmer_profile_json TEXT NOT NULL DEFAULT '{}',
                certifications_json TEXT NOT NULL DEFAULT '[]'
            )
            """
        )
        _ensure_column(
            conn,
            "cvs",
            "version_name",
            "TEXT NOT NULL DEFAULT 'My CV'",
        )
        _ensure_column(
            conn,
            "cvs",
            "is_default",
            "INTEGER NOT NULL DEFAULT 0",
        )
        _ensure_column(
            conn,
            "cvs",
            "date_format",
            "TEXT NOT NULL DEFAULT 'MMM YYYY'",
        )
        _ensure_column(
            conn,
            "cvs",
            "programmer_profile_json",
            "TEXT NOT NULL DEFAULT '{}'",
        )
        _ensure_column(
            conn,
            "cvs",
            "certifications_json",
            "TEXT NOT NULL DEFAULT '[]'",
        )
        conn.commit()


def save_cv(payload: CVPayload) -> str:
    cv_id = str(uuid.uuid4())
    version_count = 0
    experiences_json = json.dumps([exp.model_dump() for exp in payload.experiences])
    programmer_profile_json = json.dumps(payload.programmer_profile.model_dump())
    certifications_json = json.dumps([cert.model_dump() for cert in payload.certifications])
    with get_conn() as conn:
        version_count = conn.execute("SELECT COUNT(1) AS count FROM cvs").fetchone()["count"]
        is_default = 1 if version_count == 0 else 0
        conn.execute(
            """
            INSERT INTO cvs (
                id, version_name, is_default, full_name, title, summary, style, date_format, experiences_json, programmer_profile_json, certifications_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                cv_id,
                payload.version_name,
                is_default,
                payload.full_name,
                payload.title,
                payload.summary,
                payload.style,
                payload.date_format,
                experiences_json,
                programmer_profile_json,
                certifications_json,
            ),
        )
        conn.commit()
    return cv_id


def update_cv(cv_id: str, payload: CVPayload) -> bool:
    experiences_json = json.dumps([exp.model_dump() for exp in payload.experiences])
    programmer_profile_json = json.dumps(payload.programmer_profile.model_dump())
    certifications_json = json.dumps([cert.model_dump() for cert in payload.certifications])
    with get_conn() as conn:
        result = conn.execute(
            """
            UPDATE cvs
            SET version_name = ?, full_name = ?, title = ?, summary = ?, style = ?, date_format = ?,
                experiences_json = ?, programmer_profile_json = ?, certifications_json = ?
            WHERE id = ?
            """,
            (
                payload.version_name,
                payload.full_name,
                payload.title,
                payload.summary,
                payload.style,
                payload.date_format,
                experiences_json,
                programmer_profile_json,
                certifications_json,
                cv_id,
            ),
        )
        conn.commit()
    return result.rowcount > 0


def list_cvs() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, version_name, is_default
            FROM cvs
            ORDER BY is_default DESC, version_name COLLATE NOCASE ASC
            """
        ).fetchall()
    return [
        {
            "id": row["id"],
            "version_name": row["version_name"],
            "is_default": bool(row["is_default"]),
        }
        for row in rows
    ]


def duplicate_cv(cv_id: str) -> str | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM cvs WHERE id = ?", (cv_id,)).fetchone()
        if row is None:
            return None
        new_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO cvs (
                id, version_name, is_default, full_name, title, summary, style, date_format, experiences_json, programmer_profile_json, certifications_json
            )
            VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_id,
                f"{row['version_name']} (Copy)",
                row["full_name"],
                row["title"],
                row["summary"],
                row["style"],
                row["date_format"],
                row["experiences_json"],
                row["programmer_profile_json"],
                row["certifications_json"],
            ),
        )
        conn.commit()
    return new_id


def set_default_cv(cv_id: str) -> bool:
    with get_conn() as conn:
        exists = conn.execute("SELECT 1 FROM cvs WHERE id = ?", (cv_id,)).fetchone()
        if exists is None:
            return False
        conn.execute("UPDATE cvs SET is_default = 0")
        conn.execute("UPDATE cvs SET is_default = 1 WHERE id = ?", (cv_id,))
        conn.commit()
    return True


def get_cv(cv_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM cvs WHERE id = ?", (cv_id,)).fetchone()
    if row is None:
        return None
    return {
        "id": row["id"],
        "version_name": row["version_name"],
        "is_default": bool(row["is_default"]),
        "full_name": row["full_name"],
        "title": row["title"],
        "summary": row["summary"],
        "style": row["style"],
        "date_format": row["date_format"],
        "experiences": json.loads(row["experiences_json"]),
        "programmer_profile": json.loads(row["programmer_profile_json"] or "{}"),
        "certifications": json.loads(row["certifications_json"] or "[]"),
    }


def _ensure_column(
    conn: sqlite3.Connection,
    table_name: str,
    column_name: str,
    column_definition: str,
) -> None:
    columns = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    if any(col[1] == column_name for col in columns):
        return
    conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")

#!/usr/bin/env python3
"""SQLite-backed reusable CPAMI field templates."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from cpami_core import DataTxtError


APP_ROOT = Path(__file__).resolve().parent
DEFAULT_SCHEMA_PATH = APP_ROOT.parent / "sqlite" / "schema.sql"
TEMPLATE_VERSION = "1"

TEMPLATE_KINDS: dict[str, dict[str, Any]] = {
    "applicant": {
        "label": "起造人",
        "sourceTable": "BMSP01",
        "fields": (
            "CNAME", "BIRTH_DATE", "TEL_NO", "Fax_NO", "eMail", "IDENTIFY_NO",
            "Law_represent",
            "O_ADDRADR", "O_ADDRAD1", "O_ADDRAD2", "O_ADDRAD3", "O_ADDRAD4",
            "O_ADDRAD5", "O_ADDRAD6", "O_ADDRAD6_1", "O_ADDRAD7", "O_ADDRAD7_1",
            "O_ADDRAD8", "O_ADDRAD9",
            "H_ADDRADR", "H_ADDRAD1", "H_ADDRAD2", "H_ADDRAD3", "H_ADDRAD4",
            "H_ADDRAD5", "H_ADDRAD6", "H_ADDRAD6_1", "H_ADDRAD7", "H_ADDRAD7_1",
            "H_ADDRAD8", "H_ADDRAD9",
        ),
    },
    "designer": {
        "label": "設計建築師",
        "sourceTable": "BMSP02",
        "fields": (
            "CNAME", "IDENTIFY_NO", "COM_ID_AREA", "COM_ID_WORD", "COM_ID_NO",
            "COM_ID_NO1", "OFFICE_NAME", "COM_ZIP", "COM_ADDRESS", "TEL_NO",
            "FAX_NO", "eMail",
        ),
    },
    "supervisor": {
        "label": "監造建築師",
        "sourceTable": "BMSP03",
        "fields": (
            "CNAME", "IDENTIFY_NO", "COM_ID_AREA", "COM_ID_WORD", "COM_ID_NO",
            "COM_ID_NO1", "OFFICE_NAME", "COM_ZIP", "COM_ADDRESS", "TEL_NO",
            "FAX_NO", "eMail",
        ),
    },
    "contractor": {
        "label": "承造人",
        "sourceTable": "BMSP04",
        "fields": (
            "COMPANY_NAME", "COM_ZIP", "COM_ADDRESS", "COM_IDNO", "BOSS",
            "ARC_REG_WORD", "ARC_REG_CLAS", "ARC_REG_PRI", "ARC_REG_NO",
            "CIV_REG_WORD", "CIV_REG_NO", "CIV_REG_SEQ_NO", "TECH_NAME",
            "TECH_IDNO", "TECH_LIC", "TEL_NO", "FAX_NO", "eMail", "CLSRAN",
            "SCTNAME", "SCTNO", "FTENGTYPE", "GUILDNO1", "GUILDNO2",
        ),
    },
    "technician": {
        "label": "專業技師",
        "sourceTable": "BM_TEC",
        "fields": (
            "TEC_NAME", "TEC_TYPE", "CAPACITY_GET", "CAPACITY_NO", "TRX_NO",
            "REG_NO", "COM_NAME", "COM_ZIP", "COM_ADDR", "COM_TEL", "COM_FAX",
            "REG_DATE",
        ),
    },
    "case_memo": {
        "label": "案件備註",
        "sourceTable": "BMSMEMO",
        "fields": ("MEMO_SEQ", "MEMO_SEQ_NAME", "DESE"),
        "applyMode": "new-or-blank",
    },
    "form_long_text": {
        "label": "書表長文字",
        "sourceTable": "BMSBASE",
        "fields": ("A12_TITTLE", "A12_5TITLE"),
        "fieldSelection": True,
    },
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def public_template_kinds() -> list[dict[str, Any]]:
    return [
        {
            "templateKind": kind,
            "label": config["label"],
            "sourceTable": config["sourceTable"],
            "fields": list(config["fields"]),
            "applyMode": config.get("applyMode", "fill-current"),
            "fieldSelection": bool(config.get("fieldSelection", False)),
        }
        for kind, config in TEMPLATE_KINDS.items()
    ]


class SQLiteTemplateStore:
    def __init__(
        self,
        database_path: Path,
        schema_version: str,
        schema_path: Path = DEFAULT_SCHEMA_PATH,
    ) -> None:
        self.database_path = Path(database_path).resolve()
        self.schema_version = schema_version
        self.schema_path = Path(schema_path).resolve()
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = self._connect()
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _initialize(self) -> None:
        if not self.schema_path.is_file():
            raise DataTxtError(f"找不到 SQLite schema：{self.schema_path}")
        with self._connection() as connection:
            connection.executescript(self.schema_path.read_text(encoding="utf-8"))

    def kind_catalog(self) -> list[dict[str, Any]]:
        return public_template_kinds()

    def _kind_config(self, template_kind: str) -> dict[str, Any]:
        config = TEMPLATE_KINDS.get(template_kind)
        if not config:
            raise DataTxtError("不支援的範本類型。")
        return config

    def _name(self, value: Any) -> str:
        if not isinstance(value, str):
            raise DataTxtError("範本名稱必須是文字。")
        name = value.strip()
        if not name:
            raise DataTxtError("請輸入範本名稱。")
        if len(name) > 80:
            raise DataTxtError("範本名稱不可超過 80 個字。")
        return name

    def _fields(self, template_kind: str, value: Any) -> dict[str, str]:
        if not isinstance(value, dict):
            raise DataTxtError("範本欄位必須是物件。")
        allowed = set(self._kind_config(template_kind)["fields"])
        fields: dict[str, str] = {}
        for field, field_value in value.items():
            if field not in allowed:
                continue
            if not isinstance(field_value, str):
                raise DataTxtError(f"範本欄位 {field} 必須是字串。")
            if field_value != "":
                fields[field] = field_value
        if not fields:
            raise DataTxtError("目前記錄沒有可儲存的非空白範本欄位。")
        return fields

    def _row(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "templateId": row["template_id"],
            "templateVersion": row["template_version"],
            "schemaVersion": row["schema_version"],
            "templateKind": row["template_kind"],
            "name": row["name"],
            "sourceTable": row["source_table"],
            "fields": json.loads(row["fields_json"]),
            "isDefault": bool(row["is_default"]),
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }

    def list_templates(
        self, template_kind: str = "", defaults_only: bool = False
    ) -> list[dict[str, Any]]:
        parameters: list[Any] = []
        where = ["is_active = 1"]
        if template_kind:
            self._kind_config(template_kind)
            where.append("template_kind = ?")
            parameters.append(template_kind)
        if defaults_only:
            where.append("is_default = 1")
        sql = f"""
            SELECT * FROM cpami_data_templates
            WHERE {' AND '.join(where)}
            ORDER BY template_kind, is_default DESC, name COLLATE NOCASE
        """
        with self._connection() as connection:
            return [self._row(row) for row in connection.execute(sql, parameters)]

    def get_template(self, template_id: str) -> dict[str, Any]:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM cpami_data_templates WHERE template_id = ? AND is_active = 1",
                (template_id,),
            ).fetchone()
        if not row:
            raise DataTxtError("找不到指定範本。")
        return self._row(row)

    def create_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        template_kind = str(payload.get("templateKind", ""))
        config = self._kind_config(template_kind)
        supplied_version = payload.get("schemaVersion", self.schema_version)
        if supplied_version != self.schema_version:
            raise DataTxtError(
                f"範本 schemaVersion {supplied_version} 與目前版本 {self.schema_version} 不相容。"
            )
        name = self._name(payload.get("name"))
        fields = self._fields(template_kind, payload.get("fields"))
        is_default = bool(payload.get("isDefault", False))
        template_id = str(uuid.uuid4())
        now = utc_now()
        try:
            with self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                if is_default:
                    connection.execute(
                        "UPDATE cpami_data_templates SET is_default = 0, updated_at = ? "
                        "WHERE template_kind = ? AND is_active = 1",
                        (now, template_kind),
                    )
                connection.execute(
                    """
                    INSERT INTO cpami_data_templates (
                        template_id, template_version, schema_version, template_kind,
                        name, source_table, fields_json, is_default, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        template_id, TEMPLATE_VERSION, self.schema_version, template_kind,
                        name, config["sourceTable"],
                        json.dumps(fields, ensure_ascii=False, separators=(",", ":")),
                        int(is_default), now, now,
                    ),
                )
        except sqlite3.IntegrityError as exc:
            raise DataTxtError(f"同類型已有名為「{name}」的範本。") from exc
        return self.get_template(template_id)

    def update_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        current = self.get_template(template_id)
        template_kind = current["templateKind"]
        name = self._name(payload["name"]) if "name" in payload else current["name"]
        fields = (
            self._fields(template_kind, payload["fields"])
            if "fields" in payload
            else current["fields"]
        )
        is_default = bool(payload.get("isDefault", current["isDefault"]))
        now = utc_now()
        try:
            with self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                if is_default:
                    connection.execute(
                        "UPDATE cpami_data_templates SET is_default = 0, updated_at = ? "
                        "WHERE template_kind = ? AND is_active = 1 AND template_id <> ?",
                        (now, template_kind, template_id),
                    )
                connection.execute(
                    """
                    UPDATE cpami_data_templates
                    SET name = ?, fields_json = ?, is_default = ?, updated_at = ?
                    WHERE template_id = ? AND is_active = 1
                    """,
                    (
                        name,
                        json.dumps(fields, ensure_ascii=False, separators=(",", ":")),
                        int(is_default), now, template_id,
                    ),
                )
        except sqlite3.IntegrityError as exc:
            raise DataTxtError(f"同類型已有名為「{name}」的範本。") from exc
        return self.get_template(template_id)

    def delete_template(self, template_id: str) -> None:
        now = utc_now()
        with self._connection() as connection:
            cursor = connection.execute(
                """
                UPDATE cpami_data_templates
                SET is_active = 0, is_default = 0, updated_at = ?
                WHERE template_id = ? AND is_active = 1
                """,
                (now, template_id),
            )
        if cursor.rowcount != 1:
            raise DataTxtError("找不到指定範本。")

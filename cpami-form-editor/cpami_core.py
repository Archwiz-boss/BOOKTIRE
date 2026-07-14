"""內部系統與本機伺服器共用的唯一 CPAMI data.txt 格式引擎。"""

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any


TABLE_LABELS = {
    "BMSBASE": "案件主檔／申請書總表",
    "BM_TEC": "專業技師",
    "BMSLAN": "基地地號",
    "BMSLANOWNER": "土地所有權人",
    "BMSMEMO": "案件備註",
    "BMSP01": "起造人／棟戶門牌",
    "BMSP02": "設計人",
    "BMSP03": "監造人",
    "BMSP04": "承造人",
    "BMSPARK": "停車空間",
    "BMSSC": "開竣工相容資料",
    "BMSSTAIR": "樓層／用途／面積",
    "BMSWORK": "雜項工作物",
}

REPEATABLE_TABLES = {
    "BM_TEC",
    "BMSLAN",
    "BMSLANOWNER",
    "BMSMEMO",
    "BMSP01",
    "BMSP02",
    "BMSP03",
    "BMSP04",
    "BMSPARK",
    "BMSSTAIR",
    "BMSWORK",
}

SYNC_PAIRS = {
    "BMSBASE": [("USAGE_CODE", "USAGE_CODE_DESC")],
    "BMSMEMO": [("MEMO_SEQ", "MEMO_SEQ_NAME")],
    "BMSP01": [
        ("BLD_CODE1", "BLD_CODE1_DESC"),
        ("BLD_CODE2", "BLD_CODE2_DESC"),
        ("BLD_CODE3", "BLD_CODE3_DESC"),
    ],
    "BMSSTAIR": [
        ("USAGE_CODE1", "USAGE_CODE1_DESC"),
        ("USAGE_CODE2", "USAGE_CODE2_DESC"),
        ("USAGE_CODE3", "USAGE_CODE3_DESC"),
        ("USAGE_CODE1_OLD", "USAGE_CODE1_DESC_OLD"),
        ("USAGE_CODE2_OLD", "USAGE_CODE2_DESC_OLD"),
        ("USAGE_CODE3_OLD", "USAGE_CODE3_DESC_OLD"),
    ],
}

NUMERIC_FIELDS = {
    "LAW_COVER_RATE",
    "LAW_SPACE_RATE",
    "BASE_AREA_ARC",
    "BASE_AREA_SHRINK",
    "BASE_AREA_OTHER",
    "BASE_AREA_PURPOSE",
    "BASE_AREA_TOTAL",
    "STATUTORY_OPEN_SPACE",
    "BUIL_AREA_ARC",
    "BUIL_AREA_OTHER",
    "BUILDING_HEIGHT",
    "BUILDING_AREA",
    "TOTAL_CONSTRU_AREA",
    "BUILD_COVER_RATE",
    "SPACE_RATE",
    "PRICE",
    "CHWANG_NO",
    "BUILDING_NO",
    "UP_FLOOR_NO",
    "DN_FLOOR_NO",
    "TOT_HOUSE_NO",
    "BUILD_HIHIGHT",
    "AIRRAID_U_AREA",
    "AIRRAID_D_AREA",
    "LAW_AIRRAID_AREA",
    "AIRRAID_P_AREA",
    "OTHERS_PRICE",
    "TOT_AREA",
    "USE_AREA",
    "TOT_AREA_hold",
    "USE_AREA_hold",
    "NUM",
    "AREA",
    "STORY_AREA",
    "STORY_HEIGHT",
    "VERANDA_AREA",
    "TERRACE_AREA",
    "LENGTH",
    "HEIGHT",
    "WIDE",
}

FIELD_RE = re.compile(r'^@(d|m)\s+(\S+)\s+"(.*)"$')
TABLE_RE = re.compile(r"^@TableName\s+(\S+)$")
ROC_DATE_RE = re.compile(r"^\d{7}$")
NUMBER_RE = re.compile(r"^-?(?:\d+(?:\.\d*)?|\.\d+)$")


class DataTxtError(ValueError):
    """Raised when a data.txt file violates the legacy grammar."""


def parse_data_txt_bytes(raw: bytes) -> dict[str, Any]:
    try:
        text = raw.decode("cp950", errors="strict")
    except UnicodeDecodeError as exc:
        raise DataTxtError(
            f"不是有效的 CP950/Big5 data.txt（位元組位置 {exc.start}）。"
        ) from exc

    table_order: list[str] = []
    field_order: dict[str, list[str]] = {}
    tables: dict[str, list[dict[str, str]]] = {}
    current_table: str | None = None
    current_record: dict[str, str] | None = None

    for line_no, line in enumerate(text.splitlines(), start=1):
        if not line:
            continue
        table_match = TABLE_RE.match(line)
        if table_match:
            if current_record is not None:
                raise DataTxtError(f"第 {line_no} 行：上一筆記錄尚未 @RecordEnd。")
            current_table = table_match.group(1)
            if current_table not in tables:
                table_order.append(current_table)
                tables[current_table] = []
                field_order[current_table] = []
            continue
        if line == "@RecordBegin":
            if current_table is None:
                raise DataTxtError(f"第 {line_no} 行：@RecordBegin 前缺少 @TableName。")
            if current_record is not None:
                raise DataTxtError(f"第 {line_no} 行：記錄重複開始。")
            current_record = {}
            continue
        if line == "@RecordEnd":
            if current_table is None or current_record is None:
                raise DataTxtError(f"第 {line_no} 行：找不到對應的 @RecordBegin。")
            tables[current_table].append(current_record)
            current_record = None
            continue
        field_match = FIELD_RE.match(line)
        if field_match:
            if current_table is None or current_record is None:
                raise DataTxtError(f"第 {line_no} 行：欄位不在記錄內。")
            field = field_match.group(2)
            value = field_match.group(3)
            if field in current_record:
                raise DataTxtError(f"第 {line_no} 行：欄位 {field} 重複。")
            current_record[field] = value
            if field not in field_order[current_table]:
                field_order[current_table].append(field)
            continue
        raise DataTxtError(f"第 {line_no} 行無法辨識：{line[:80]}")

    if current_record is not None:
        raise DataTxtError("檔案結尾前缺少 @RecordEnd。")
    if not table_order:
        raise DataTxtError("找不到任何 @TableName。")

    return {
        "tableOrder": table_order,
        "fieldOrder": field_order,
        "tables": tables,
    }


def load_schema(path: str | Path) -> dict[str, Any]:
    schema_path = Path(path)
    if not schema_path.exists():
        raise RuntimeError(f"找不到格式結構：{schema_path}")
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"無法讀取格式結構：{schema_path}") from exc

    table_order = schema.get("tableOrder")
    field_order = schema.get("fieldOrder")
    table_meta = schema.get("tableMeta")
    schema_version = schema.get("schemaVersion")
    if (
        not isinstance(schema_version, str)
        or not schema_version
        or not isinstance(table_order, list)
        or not table_order
        or not all(isinstance(table, str) and table for table in table_order)
        or not isinstance(field_order, dict)
        or not isinstance(table_meta, dict)
    ):
        raise RuntimeError(f"格式結構缺少必要欄位：{schema_path}")
    for table in table_order:
        fields = field_order.get(table)
        meta = table_meta.get(table)
        if (
            not isinstance(fields, list)
            or not fields
            or not all(isinstance(field, str) and field for field in fields)
            or not isinstance(meta, dict)
            or not isinstance(meta.get("label"), str)
            or not isinstance(meta.get("repeatable"), bool)
        ):
            raise RuntimeError(f"格式結構中的 {table} 定義無效：{schema_path}")
    return schema


def assert_parsed_matches_schema(parsed: dict[str, Any], schema: dict[str, Any]) -> None:
    expected = schema["tableOrder"]
    if parsed["tableOrder"] != expected:
        raise DataTxtError(
            "資料表順序／集合與格式結構不同；需要 13 表：" + ", ".join(expected)
        )
    for table in expected:
        if parsed["fieldOrder"].get(table) != schema["fieldOrder"][table]:
            raise DataTxtError(f"{table} 欄位集合或順序與格式結構不一致。")


def parse_envelope(payload_dict: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload_dict, dict) or not isinstance(payload_dict.get("tables"), dict):
        raise DataTxtError("JSON 必須包含 tables 物件。")

    expected_version = schema["schemaVersion"]
    supplied_version = payload_dict.get("schemaVersion", expected_version)
    if supplied_version != expected_version:
        raise DataTxtError(
            f"schemaVersion 不相符：案件為 {supplied_version}，伺服器為 {expected_version}。"
        )
    form_set = payload_dict.get("formSet", "A")
    if not isinstance(form_set, str) or not form_set:
        raise DataTxtError("formSet 必須是非空字串。")
    return payload_dict["tables"]


def roc_now() -> tuple[str, str]:
    now = datetime.now()
    year = now.year - 1911
    date_text = f"{year:03d}{now:%m%d}"
    key = f"{year:03d}{now:%m%d%H%M%S}"
    return date_text, key


def prepare_payload(
    payload: dict[str, Any],
    schema: dict[str, Any],
    *,
    fill_defaults: bool,
) -> dict[str, list[dict[str, str]]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("tables"), dict):
        raise DataTxtError("JSON 必須包含 tables 物件。")

    incoming = payload["tables"]
    result: dict[str, list[dict[str, str]]] = {}
    _today, generated_key = roc_now()
    base_rows = incoming.get("BMSBASE") or []
    key = ""
    if isinstance(base_rows, list) and base_rows and isinstance(base_rows[0], dict):
        key = str(base_rows[0].get("INDEX_KEY", "")).strip()
    if fill_defaults and not key:
        key = generated_key

    for table in schema["tableOrder"]:
        rows = incoming.get(table, [])
        if rows is None:
            rows = []
        if not isinstance(rows, list):
            raise DataTxtError(f"{table} 必須是記錄陣列。")
        canonical_rows: list[dict[str, str]] = []
        for row_index, row in enumerate(rows, start=1):
            if not isinstance(row, dict):
                raise DataTxtError(f"{table} 第 {row_index} 筆不是物件。")
            canonical: dict[str, str] = {}
            for field in schema["fieldOrder"][table]:
                raw_value = row.get(field, "")
                value = "" if raw_value is None else str(raw_value)
                if '"' in value or "\r" in value or "\n" in value:
                    raise DataTxtError(
                        f"{table} 第 {row_index} 筆 {field} 含雙引號或換行，舊格式沒有可靠跳脫規則。"
                    )
                canonical[field] = value
            if fill_defaults:
                if "INDEX_KEY" in canonical:
                    canonical["INDEX_KEY"] = key
                if "person_seq" in canonical and not canonical["person_seq"].strip():
                    canonical["person_seq"] = str(row_index)
                if "PERSON_SEQ" in canonical and not canonical["PERSON_SEQ"].strip():
                    canonical["PERSON_SEQ"] = str(row_index)
                if "SPOKESMAN" in canonical and not canonical["SPOKESMAN"].strip():
                    canonical["SPOKESMAN"] = "Y" if row_index == 1 else "N"
            canonical_rows.append(canonical)
        result[table] = canonical_rows
    return result


def validate_tables(
    tables: dict[str, list[dict[str, str]]], schema: dict[str, Any]
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    base_rows = tables.get("BMSBASE", [])
    if len(base_rows) != 1:
        errors.append(f"BMSBASE 必須剛好 1 筆，目前為 {len(base_rows)} 筆。")
    else:
        base = base_rows[0]
        for field, label in (
            ("INDEX_KEY", "案件主鍵"),
            ("BMPAS", "縣市代碼"),
            ("BUILDING_NAME", "工程名稱"),
            ("APPLY_TYPE", "申請類型"),
        ):
            if not base.get(field, "").strip():
                errors.append(f"BMSBASE.{field}（{label}）不可空白。")

    expected_key = base_rows[0].get("INDEX_KEY", "") if base_rows else ""
    for table in schema["tableOrder"]:
        rows = tables.get(table, [])
        seen_seq: set[str] = set()
        for row_index, row in enumerate(rows, start=1):
            prefix = f"{table} 第 {row_index} 筆"
            if expected_key and row.get("INDEX_KEY", "") != expected_key:
                errors.append(f"{prefix} INDEX_KEY 與 BMSBASE 不一致。")
            sequence = row.get(
                "person_seq", row.get("Person_seq", row.get("PERSON_SEQ", ""))
            ).strip()
            if schema["tableMeta"][table]["repeatable"]:
                if not sequence:
                    warnings.append(f"{prefix} 缺少 PERSON_SEQ；匯出時會依列序補值。")
                elif sequence in seen_seq:
                    errors.append(f"{table} 的 PERSON_SEQ={sequence} 重複。")
                seen_seq.add(sequence)

            for field, value in row.items():
                if not value:
                    continue
                upper = field.upper()
                if (upper.endswith("_DATE") or upper in {"CR_DATE", "UP_DATE", "BIRTH_DATE"}) and not ROC_DATE_RE.fullmatch(value):
                    warnings.append(f"{prefix} {field} 建議使用民國 yyyMMdd 7 碼，目前為「{value}」。")
                base_field = re.sub(r"_(?:OLD|TEAR)$", "", field, flags=re.IGNORECASE)
                numeric_here = base_field in NUMERIC_FIELDS
                # BUILDING_NO is numeric only in the one-row BMSBASE table.  In
                # BMSP01/BMSSTAIR it is a user-facing building label such as A1.
                if base_field == "BUILDING_NO" and table != "BMSBASE":
                    numeric_here = False
                if numeric_here and not NUMBER_RE.fullmatch(value):
                    errors.append(f"{prefix} {field} 應為純數字，不含單位或千分位：{value}")
                try:
                    value.encode("cp950", errors="strict")
                except UnicodeEncodeError as exc:
                    bad = value[exc.start : exc.end]
                    errors.append(f"{prefix} {field} 含 CP950 無法表示的字元「{bad}」。")

            for code_field, desc_field in SYNC_PAIRS.get(table, []):
                if row.get(code_field, "").strip() and not row.get(desc_field, "").strip():
                    warnings.append(f"{prefix} 已填 {code_field}，但 {desc_field} 空白；報表可能沒有顯示文字。")

    counts = {table: len(tables.get(table, [])) for table in schema["tableOrder"]}
    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "counts": counts,
    }


def serialize_tables(
    tables: dict[str, list[dict[str, str]]], schema: dict[str, Any]
) -> bytes:
    lines: list[str] = []
    for table in schema["tableOrder"]:
        lines.append(f"@TableName {table}")
        for row in tables.get(table, []):
            lines.append("@RecordBegin")
            for field in schema["fieldOrder"][table]:
                lines.append(f'@d {field} "{row.get(field, "")}"')
            lines.append("@RecordEnd")
    text = "\r\n".join(lines) + "\r\n"
    try:
        return text.encode("cp950", errors="strict")
    except UnicodeEncodeError as exc:
        bad = text[exc.start : exc.end]
        raise DataTxtError(f"含 CP950 無法表示的字元「{bad}」。") from exc

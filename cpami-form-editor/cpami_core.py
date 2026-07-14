"""內部系統與本機伺服器共用的唯一 CPAMI data.txt 格式引擎。"""

from __future__ import annotations

import base64
import binascii
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
POSITIVE_INTEGER_RE = re.compile(r"^[1-9]\d*$")

EXTRA_NUMERIC_FIELDS = {
    "BMSROAD": {"person_seq", "LENGTH", "WIDE"},
    "BMSCHK": {"PERSON_SEQ", "NET_SEQ"},
    "BMSSCRP": {
        "PERSON_SEQ",
        "PAGE_NO",
        "ITEM01",
        "ITEM02",
        "ITEM03",
        "ITEM04",
        "ITEM05",
        "ITEM06",
        "ITEM07",
        "ITEM08",
        "PEO_TECH_DATE",
        "PEO_PLAIN_DATE",
    },
    "RPTPHOTO": {"PERSON_SEQ", "FILE_SIZE"},
    "BMELVTR": {"PERSON_SEQ", "CHECK_YEAR"},
}


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

    extension_path = schema_path.with_name("case_extension_schema.json")
    if extension_path.exists():
        try:
            extension = json.loads(extension_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"無法讀取案件擴充結構：{extension_path}") from exc
        if extension.get("schemaVersion") != schema_version:
            raise RuntimeError(
                f"案件擴充結構版本不相符：{extension.get('schemaVersion')} != {schema_version}"
            )
        extra_order = extension.get("extraTableOrder")
        extra_fields = extension.get("extraFieldOrder")
        extra_meta = extension.get("extraTableMeta")
        if (
            not isinstance(extra_order, list)
            or not all(isinstance(table, str) and table for table in extra_order)
            or not isinstance(extra_fields, dict)
            or not isinstance(extra_meta, dict)
        ):
            raise RuntimeError(f"案件擴充結構缺少必要欄位：{extension_path}")
        for table in extra_order:
            fields = extra_fields.get(table)
            meta = extra_meta.get(table)
            if (
                not isinstance(fields, list)
                or not fields
                or len(fields) != len(set(fields))
                or not all(isinstance(field, str) and field for field in fields)
                or not isinstance(meta, dict)
                or not isinstance(meta.get("label"), str)
                or not isinstance(meta.get("repeatable"), bool)
            ):
                raise RuntimeError(f"案件擴充結構中的 {table} 定義無效：{extension_path}")
        schema.update(
            {
                "extraTableOrder": extra_order,
                "extraFieldOrder": extra_fields,
                "extraTableMeta": extra_meta,
            }
        )
    else:
        schema.update(
            {"extraTableOrder": [], "extraFieldOrder": {}, "extraTableMeta": {}}
        )
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


def parse_case_envelope(
    payload_dict: dict[str, Any], schema: dict[str, Any]
) -> dict[str, Any]:
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
    extra_tables = payload_dict.get("extraTables", {})
    if extra_tables is None:
        extra_tables = {}
    if not isinstance(extra_tables, dict):
        raise DataTxtError("extraTables 必須是物件。")
    return {
        "schemaVersion": expected_version,
        "formSet": form_set,
        "tables": payload_dict["tables"],
        "extraTables": extra_tables,
    }


def parse_envelope(payload_dict: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    """Parse either legacy or versioned input and return the 13 data.txt tables."""
    return parse_case_envelope(payload_dict, schema)["tables"]


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
    allow_data_txt_unsafe: bool = False,
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
        # The legacy format stores field names inside each record.  A table
        # without a record therefore cannot carry its field contract.  Export
        # one blank canonical record so every data.txt remains a complete,
        # re-importable 13-table / 596-field document.
        if fill_defaults and not rows:
            rows = [{}]
        canonical_rows: list[dict[str, str]] = []
        for row_index, row in enumerate(rows, start=1):
            if not isinstance(row, dict):
                raise DataTxtError(f"{table} 第 {row_index} 筆不是物件。")
            canonical: dict[str, str] = {}
            for field in schema["fieldOrder"][table]:
                raw_value = row.get(field, "")
                value = "" if raw_value is None else str(raw_value)
                if not allow_data_txt_unsafe and ('"' in value or "\r" in value or "\n" in value):
                    raise DataTxtError(
                        f"{table} 第 {row_index} 筆 {field} 含雙引號或換行，舊格式沒有可靠跳脫規則。"
                    )
                canonical[field] = value
            if fill_defaults:
                if "INDEX_KEY" in canonical:
                    canonical["INDEX_KEY"] = key
                for sequence_field in ("person_seq", "Person_seq", "PERSON_SEQ"):
                    if sequence_field in canonical and not canonical[sequence_field].strip():
                        canonical[sequence_field] = str(row_index)
                if "SPOKESMAN" in canonical and not canonical["SPOKESMAN"].strip():
                    canonical["SPOKESMAN"] = "Y" if row_index == 1 else "N"
            canonical_rows.append(canonical)
        result[table] = canonical_rows
    return result


def prepare_extra_tables(
    payload: dict[str, Any],
    schema: dict[str, Any],
    *,
    fill_defaults: bool,
    index_key: str = "",
) -> dict[str, list[dict[str, str]]]:
    incoming = payload.get("extraTables", {})
    if incoming is None:
        incoming = {}
    if not isinstance(incoming, dict):
        raise DataTxtError("extraTables 必須是物件。")

    result: dict[str, list[dict[str, str]]] = {}
    for table in schema.get("extraTableOrder", []):
        rows = incoming.get(table, [])
        if rows is None:
            rows = []
        if not isinstance(rows, list):
            raise DataTxtError(f"{table} 必須是記錄陣列。")
        canonical_rows: list[dict[str, str]] = []
        for row_index, row in enumerate(rows, start=1):
            if not isinstance(row, dict):
                raise DataTxtError(f"{table} 第 {row_index} 筆不是物件。")
            canonical = {
                field: "" if row.get(field) is None else str(row.get(field, ""))
                for field in schema["extraFieldOrder"][table]
            }
            if fill_defaults:
                for key_field in ("INDEX_KEY", "Index_key", "index_key"):
                    if key_field in canonical:
                        canonical[key_field] = index_key
                for sequence_field in ("person_seq", "Person_seq", "PERSON_SEQ"):
                    if sequence_field in canonical and not canonical[sequence_field].strip():
                        canonical[sequence_field] = str(row_index)
                if "SPOKESMAN" in canonical and not canonical["SPOKESMAN"].strip():
                    canonical["SPOKESMAN"] = "Y" if row_index == 1 else "N"
                if table == "C21_3" and not canonical["Rpt_FmName"].strip():
                    canonical["Rpt_FmName"] = "C21-3"
            canonical_rows.append(canonical)
        result[table] = canonical_rows
    return result


def prepare_case_envelope(
    payload: dict[str, Any],
    schema: dict[str, Any],
    *,
    fill_defaults: bool,
    allow_data_txt_unsafe: bool = False,
) -> dict[str, Any]:
    parsed = parse_case_envelope(payload, schema)
    tables = prepare_payload(
        {"tables": parsed["tables"]},
        schema,
        fill_defaults=fill_defaults,
        allow_data_txt_unsafe=allow_data_txt_unsafe,
    )
    base_rows = tables.get("BMSBASE", [])
    index_key = base_rows[0].get("INDEX_KEY", "") if base_rows else ""
    extra_tables = prepare_extra_tables(
        {"extraTables": parsed["extraTables"]},
        schema,
        fill_defaults=fill_defaults,
        index_key=index_key,
    )
    return {
        "schemaVersion": schema["schemaVersion"],
        "formSet": parsed["formSet"],
        "tables": tables,
        "extraTables": extra_tables,
    }


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
                if '"' in value or "\r" in value or "\n" in value:
                    errors.append(
                        f"{prefix} {field} 含雙引號或換行，data.txt 沒有可靠跳脫規則。"
                    )
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


def validate_extra_tables(
    extra_tables: dict[str, list[dict[str, str]]],
    schema: dict[str, Any],
    *,
    index_key: str,
) -> dict[str, Any]:
    warnings: list[str] = []
    counts: dict[str, int] = {}
    for table in schema.get("extraTableOrder", []):
        rows = extra_tables.get(table, [])
        counts[table] = len(rows)
        seen_sequences: set[str] = set()
        for row_index, row in enumerate(rows, start=1):
            prefix = f"{table} 第 {row_index} 筆"
            row_key = next(
                (
                    row.get(key_field, "")
                    for key_field in ("INDEX_KEY", "Index_key", "index_key")
                    if key_field in row
                ),
                "",
            )
            if index_key and row_key != index_key:
                warnings.append(f"{prefix} INDEX_KEY 與 BMSBASE 不一致。")
            if table == "C21_3":
                sequence = row.get("Rpt_Seq", "").strip()
                if not sequence:
                    warnings.append(f"{prefix} 缺少 Rpt_Seq 檢討項目代碼。")
                elif not re.fullmatch(r"\d{3}", sequence):
                    warnings.append(f"{prefix} Rpt_Seq 建議使用 3 碼代碼，目前為「{sequence}」。")
                elif sequence in seen_sequences:
                    warnings.append(f"{table} 的 Rpt_Seq={sequence} 重複。")
                seen_sequences.add(sequence)
            else:
                sequence = row.get(
                    "person_seq", row.get("Person_seq", row.get("PERSON_SEQ", ""))
                ).strip()
                if not sequence:
                    warnings.append(f"{prefix} 缺少 PERSON_SEQ；儲存完整案件時會依列序補值。")
                elif not POSITIVE_INTEGER_RE.fullmatch(sequence):
                    warnings.append(f"{prefix} PERSON_SEQ 建議使用正整數，目前為「{sequence}」。")
                elif sequence in seen_sequences:
                    warnings.append(f"{table} 的 PERSON_SEQ={sequence} 重複。")
                seen_sequences.add(sequence)

            for field in EXTRA_NUMERIC_FIELDS.get(table, set()):
                value = row.get(field, "").strip()
                if value and not NUMBER_RE.fullmatch(value):
                    warnings.append(f"{prefix} {field} 建議使用純數字，目前為「{value}」。")

            for field, value in row.items():
                if not value or field in {"PEO_TECH_DATE", "PEO_PLAIN_DATE"}:
                    continue
                upper = field.upper()
                if (upper.endswith("_DATE") or upper.startswith("CHK_DATE")) and not ROC_DATE_RE.fullmatch(value):
                    warnings.append(f"{prefix} {field} 建議使用民國 yyyMMdd 7 碼，目前為「{value}」。")

            if table == "BMSCHK" and row.get("CHK_Item_code", "").strip() and not row.get("CHK_Item", "").strip():
                warnings.append(f"{prefix} 已填 CHK_Item_code，但 CHK_Item 顯示名稱空白。")
            if table == "C21_3" and row.get("Rpt_Seq", "").strip() and not row.get("Rpt_Item", "").strip():
                warnings.append(f"{prefix} 已填 Rpt_Seq，但 Rpt_Item 檢討項目名稱空白。")
            if table == "RPTPHOTO" and row.get("barcode", ""):
                try:
                    base64.b64decode(row["barcode"], validate=True)
                except (binascii.Error, ValueError):
                    warnings.append(f"{prefix} barcode 不是有效的 Base64 附件內容。")

    return {"warnings": warnings, "counts": counts}


def validate_case_envelope(envelope: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    report = validate_tables(envelope["tables"], schema)
    base_rows = envelope["tables"].get("BMSBASE", [])
    index_key = base_rows[0].get("INDEX_KEY", "") if base_rows else ""
    extra_report = validate_extra_tables(
        envelope.get("extraTables", {}), schema, index_key=index_key
    )
    report["warnings"].extend(extra_report["warnings"])
    report["extraCounts"] = extra_report["counts"]
    return report


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

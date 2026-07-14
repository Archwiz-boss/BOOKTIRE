"""將 CPAMI data.txt 或案件 JSON 封套匯入 PostgreSQL。"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = PROJECT_ROOT / "schema" / "data_txt_schema.json"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from cpami_core import (  # noqa: E402
    DataTxtError,
    assert_parsed_matches_schema,
    load_schema,
    parse_data_txt_bytes,
    parse_envelope,
    prepare_payload,
    validate_tables,
)


UPSERT_SQL = """
WITH updated AS (
    UPDATE cpami_case_documents
    SET schema_version = %(schema_version)s,
        apply_type = %(apply_type)s,
        building_name = %(building_name)s,
        status = %(status)s,
        payload = %(payload)s::jsonb,
        source_file = %(source_file)s,
        updated_at = now()
    WHERE %(status)s = 'draft'
      AND case_id = (
          SELECT case_id
          FROM cpami_case_documents
          WHERE index_key = %(index_key)s
            AND form_set = %(form_set)s
            AND status = 'draft'
          ORDER BY updated_at DESC, case_id
          LIMIT 1
      )
    RETURNING case_id
), inserted AS (
    INSERT INTO cpami_case_documents (
        form_set, schema_version, index_key, apply_type, building_name,
        status, payload, source_file
    )
    SELECT
        %(form_set)s, %(schema_version)s, %(index_key)s, %(apply_type)s,
        %(building_name)s, %(status)s, %(payload)s::jsonb, %(source_file)s
    WHERE NOT EXISTS (SELECT 1 FROM updated)
    RETURNING case_id
)
SELECT case_id, 'updated' AS action FROM updated
UNION ALL
SELECT case_id, 'inserted' AS action FROM inserted
""".strip()


def load_input(
    data_txt: Path | None,
    case_json: Path | None,
    schema: dict[str, Any],
) -> tuple[dict[str, list[dict[str, str]]], str]:
    if data_txt is not None:
        parsed = parse_data_txt_bytes(data_txt.read_bytes())
        assert_parsed_matches_schema(parsed, schema)
        tables = prepare_payload(
            {"tables": parsed["tables"]}, schema, fill_defaults=False
        )
        return tables, data_txt.name

    if case_json is None:
        raise DataTxtError("必須指定 --data-txt 或 --case-json。")
    payload = json.loads(case_json.read_text(encoding="utf-8-sig"))
    incoming_tables = parse_envelope(payload, schema)
    tables = prepare_payload(
        {"tables": incoming_tables}, schema, fill_defaults=False
    )
    return tables, case_json.name


def case_parameters(
    tables: dict[str, list[dict[str, str]]],
    schema: dict[str, Any],
    *,
    form_set: str,
    status: str,
    source_file: str,
) -> dict[str, str]:
    base_rows = tables.get("BMSBASE", [])
    base = base_rows[0] if base_rows else {}
    payload = json.dumps(
        {"tables": tables}, ensure_ascii=False, separators=(",", ":")
    )
    return {
        "schema_version": schema["schemaVersion"],
        "form_set": form_set,
        "index_key": base.get("INDEX_KEY", ""),
        "apply_type": base.get("APPLY_TYPE", ""),
        "building_name": base.get("BUILDING_NAME", ""),
        "status": status,
        "payload": payload,
        "source_file": source_file,
    }


def mask_text(value: str) -> str:
    if not value:
        return "（空白）"
    return value[0] + "＊" * min(max(len(value) - 1, 2), 6)


def mask_index_key(value: str) -> str:
    if len(value) <= 6:
        return mask_text(value)
    return value[:4] + "＊" * (len(value) - 6) + value[-2:]


def print_validation(report: dict[str, Any]) -> None:
    for warning in report["warnings"]:
        print(f"提醒：{warning}")
    for error in report["errors"]:
        print(f"錯誤：{error}")


def print_dry_run(params: dict[str, str], report: dict[str, Any]) -> None:
    payload = json.loads(params["payload"])
    counts = {
        table: len(rows) for table, rows in payload["tables"].items()
    }
    print("DRY-RUN：不會連線或寫入 PostgreSQL。")
    print("將執行的 SQL：")
    print(UPSERT_SQL)
    print("遮蔽後參數摘要：")
    summary = {
        "schema_version": params["schema_version"],
        "form_set": params["form_set"],
        "index_key": mask_index_key(params["index_key"]),
        "apply_type": params["apply_type"],
        "building_name": mask_text(params["building_name"]),
        "status": params["status"],
        "source_file": mask_text(params["source_file"]),
        "payload": f"{len(counts)} 表／{sum(counts.values())} 筆記錄（內容不顯示）",
        "validation": f"{len(report['errors'])} 個錯誤／{len(report['warnings'])} 個提醒",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def require_psycopg() -> Any:
    try:
        import psycopg
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "尚未安裝 psycopg。請執行：python -m pip install \"psycopg[binary]>=3.2,<4\""
        ) from exc
    return psycopg


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="匯入 CPAMI 案件至 PostgreSQL。")
    parser.add_argument("--dsn", help="PostgreSQL DSN；也可用 CPAMI_PG_DSN 環境變數")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--data-txt", type=Path, help="CP950 data.txt 路徑")
    source.add_argument("--case-json", type=Path, help="UTF-8 案件 JSON 封套路徑")
    parser.add_argument("--form-set", default="A", help="書表組，預設 A")
    parser.add_argument("--status", default="draft", help="文件狀態，預設 draft")
    parser.add_argument("--allow-invalid", action="store_true", help="允許有驗證錯誤的案件以 draft 儲存")
    parser.add_argument("--dry-run", action="store_true", help="只顯示 SQL 與遮蔽摘要，不連線")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.form_set.strip() or not args.status.strip():
        print("錯誤：form-set 與 status 不可空白。", file=sys.stderr)
        return 2

    try:
        schema = load_schema(SCHEMA_PATH)
        tables, source_file = load_input(args.data_txt, args.case_json, schema)
        report = validate_tables(tables, schema)
    except (DataTxtError, OSError, UnicodeError, json.JSONDecodeError, RuntimeError) as exc:
        print(f"匯入失敗：{exc}", file=sys.stderr)
        return 2

    print_validation(report)
    if report["errors"] and not args.allow_invalid:
        print("匯入中止：資料驗證未通過；如需保留草稿，請加 --allow-invalid。", file=sys.stderr)
        return 2
    if report["errors"] and args.status != "draft":
        print("匯入中止：有錯誤的案件只允許使用 status=draft。", file=sys.stderr)
        return 2

    params = case_parameters(
        tables,
        schema,
        form_set=args.form_set.strip(),
        status=args.status.strip(),
        source_file=source_file,
    )
    if args.dry_run:
        print_dry_run(params, report)
        return 0

    dsn = args.dsn or os.environ.get("CPAMI_PG_DSN", "")
    if not dsn:
        print("匯入失敗：請用 --dsn 或 CPAMI_PG_DSN 提供 PostgreSQL 連線字串。", file=sys.stderr)
        return 2
    try:
        psycopg = require_psycopg()
        with psycopg.connect(dsn) as connection:
            with connection.cursor() as cursor:
                cursor.execute(UPSERT_SQL, params)
                row = cursor.fetchone()
        if row is None:
            raise RuntimeError("資料庫未回傳案件識別碼。")
    except Exception as exc:
        print(f"匯入失敗：{exc}", file=sys.stderr)
        return 2

    action = "更新既有草稿" if row[1] == "updated" else "新增文件"
    print(f"匯入完成：{action}，case_id：{row[0]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""從 PostgreSQL 匯出 CPAMI CP950 data.txt。"""

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
    load_schema,
    parse_envelope,
    prepare_payload,
    serialize_tables,
    validate_tables,
)


SELECT_BY_INDEX_SQL = """
SELECT case_id, schema_version, form_set, status, payload, updated_at
FROM cpami_case_documents
WHERE index_key = %s
ORDER BY updated_at DESC, case_id
""".strip()

SELECT_BY_CASE_SQL = """
SELECT case_id, schema_version, form_set, status, payload, updated_at
FROM cpami_case_documents
WHERE index_key = %s
  AND case_id = %s::uuid
""".strip()


def require_psycopg() -> Any:
    try:
        import psycopg
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "尚未安裝 psycopg。請執行：python -m pip install \"psycopg[binary]>=3.2,<4\""
        ) from exc
    return psycopg


def payload_tables(
    row: tuple[Any, ...], schema: dict[str, Any]
) -> dict[str, list[dict[str, str]]]:
    _case_id, schema_version, form_set, _status, payload, _updated_at = row
    if isinstance(payload, str):
        payload = json.loads(payload)
    if not isinstance(payload, dict) or not isinstance(payload.get("tables"), dict):
        raise DataTxtError("資料庫 payload 缺少 tables 物件。")
    incoming = parse_envelope(
        {
            "schemaVersion": schema_version,
            "formSet": form_set,
            "tables": payload["tables"],
        },
        schema,
    )
    return prepare_payload({"tables": incoming}, schema, fill_defaults=False)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="從 PostgreSQL 匯出 CPAMI data.txt。")
    parser.add_argument("--dsn", help="PostgreSQL DSN；也可用 CPAMI_PG_DSN 環境變數")
    parser.add_argument("--index-key", required=True, help="BMSBASE.INDEX_KEY")
    parser.add_argument("--case-id", help="同一 INDEX_KEY 有多份文件時指定 UUID")
    parser.add_argument("--out", type=Path, required=True, help="輸出 data.txt 路徑")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    dsn = args.dsn or os.environ.get("CPAMI_PG_DSN", "")
    if not dsn:
        print("匯出失敗：請用 --dsn 或 CPAMI_PG_DSN 提供 PostgreSQL 連線字串。", file=sys.stderr)
        return 2

    try:
        schema = load_schema(SCHEMA_PATH)
        psycopg = require_psycopg()
        with psycopg.connect(dsn) as connection:
            with connection.cursor() as cursor:
                if args.case_id:
                    cursor.execute(SELECT_BY_CASE_SQL, (args.index_key, args.case_id))
                else:
                    cursor.execute(SELECT_BY_INDEX_SQL, (args.index_key,))
                rows = cursor.fetchall()
    except Exception as exc:
        print(f"匯出失敗：{exc}", file=sys.stderr)
        return 2

    if not rows:
        print("匯出失敗：找不到符合 INDEX_KEY／case_id 的案件文件。", file=sys.stderr)
        return 2
    if not args.case_id and len(rows) > 1:
        print(
            f"匯出失敗：INDEX_KEY={args.index_key} 共有 {len(rows)} 份文件，請加 --case-id 指定：",
            file=sys.stderr,
        )
        for row in rows:
            print(
                f"  {row[0]}｜form_set={row[2]}｜status={row[3]}｜updated_at={row[5]}",
                file=sys.stderr,
            )
        return 2

    row = rows[0]
    try:
        tables = payload_tables(row, schema)
        report = validate_tables(tables, schema)
        if report["errors"]:
            for error in report["errors"]:
                print(f"錯誤：{error}", file=sys.stderr)
            raise DataTxtError("案件資料驗證未通過，不可匯出 data.txt。")
        raw = serialize_tables(tables, schema)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_bytes(raw)
    except (DataTxtError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"匯出失敗：{exc}", file=sys.stderr)
        return 2

    print(f"匯出完成：case_id={row[0]}，{len(raw)} bytes，檔案：{args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

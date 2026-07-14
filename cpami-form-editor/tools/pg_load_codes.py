"""將 CPAMI codebook.json 代碼匯入 PostgreSQL。"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CODEBOOK_PATH = PROJECT_ROOT / "web" / "codebook.json"


UPSERT_SQL = """
INSERT INTO cpami_codes (code_type, code, sub, parent, label, mark, source)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (code_type, code, sub, parent) DO UPDATE
SET label = EXCLUDED.label,
    mark = EXCLUDED.mark,
    source = EXCLUDED.source
""".strip()


def text_value(value: Any) -> str:
    return "" if value is None else str(value)


def load_code_rows(
    path: Path,
) -> tuple[list[tuple[str, str, str, str, str, str, str]], dict[str, int]]:
    codebook = json.loads(path.read_text(encoding="utf-8"))
    code_types = codebook.get("codeTypes")
    official_sections = codebook.get("officialSections")
    if not isinstance(code_types, dict) or not isinstance(official_sections, list):
        raise ValueError("codebook.json 缺少 codeTypes 或 officialSections。")

    unique_rows: dict[tuple[str, str, str, str], tuple[str, str, str, str, str, str, str]] = {}
    legacy_count = 0
    for code_type, rows in code_types.items():
        if not isinstance(rows, list):
            raise ValueError(f"codeTypes.{code_type} 不是陣列。")
        for row in rows:
            key = (
                text_value(code_type),
                text_value(row.get("code")),
                text_value(row.get("sub")),
                text_value(row.get("parent")),
            )
            unique_rows[key] = (
                *key,
                text_value(row.get("label")),
                text_value(row.get("mark")),
                text_value(row.get("source")) or "bldcode.mdb",
            )
            legacy_count += 1

    for row in official_sections:
        key = (
            "SEC",
            text_value(row.get("code")),
            text_value(row.get("sub")),
            text_value(row.get("parent")),
        )
        unique_rows[key] = (
            *key,
            text_value(row.get("label")),
            text_value(row.get("mark")),
            "taichung-opendata",
        )

    stats = {
        "code_types": len(code_types),
        "legacy_rows": legacy_count,
        "official_sections": len(official_sections),
        "unique_rows": len(unique_rows),
    }
    return list(unique_rows.values()), stats


def require_psycopg() -> Any:
    try:
        import psycopg
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "尚未安裝 psycopg。請執行：python -m pip install \"psycopg[binary]>=3.2,<4\""
        ) from exc
    return psycopg


def print_stats(stats: dict[str, int], *, dry_run: bool) -> None:
    prefix = "DRY-RUN：不會連線或寫入 PostgreSQL。\n" if dry_run else ""
    print(
        prefix
        + f"代碼類型：{stats['code_types']}；舊系統代碼：{stats['legacy_rows']}；"
        + f"臺中市官方地段：{stats['official_sections']}；去重後唯一鍵：{stats['unique_rows']}。"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="將 CPAMI codebook 匯入 PostgreSQL。")
    parser.add_argument("--dsn", help="PostgreSQL DSN；也可用 CPAMI_PG_DSN 環境變數")
    parser.add_argument("--codebook", type=Path, default=DEFAULT_CODEBOOK_PATH, help="codebook.json 路徑")
    parser.add_argument("--dry-run", action="store_true", help="只顯示統計，不連線")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        rows, stats = load_code_rows(args.codebook)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        print(f"代碼載入失敗：{exc}", file=sys.stderr)
        return 2

    if args.dry_run:
        print_stats(stats, dry_run=True)
        return 0

    dsn = args.dsn or os.environ.get("CPAMI_PG_DSN", "")
    if not dsn:
        print("代碼載入失敗：請用 --dsn 或 CPAMI_PG_DSN 提供 PostgreSQL 連線字串。", file=sys.stderr)
        return 2
    try:
        psycopg = require_psycopg()
        with psycopg.connect(dsn) as connection:
            with connection.cursor() as cursor:
                cursor.executemany(UPSERT_SQL, rows)
    except Exception as exc:
        print(f"代碼載入失敗：{exc}", file=sys.stderr)
        return 2

    print_stats(stats, dry_run=False)
    print(f"代碼入庫完成：{stats['unique_rows']} 筆唯一鍵。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

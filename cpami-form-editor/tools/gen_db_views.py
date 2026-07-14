"""依 data.txt schema 產生 PostgreSQL JSONB 投影 view。"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PROJECT_ROOT.parent
DEFAULT_SCHEMA_PATH = PROJECT_ROOT / "schema" / "data_txt_schema.json"
DEFAULT_OUTPUT_PATH = REPO_ROOT / "db" / "views.sql"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from cpami_core import NUMERIC_FIELDS, load_schema  # noqa: E402


POSTGRES_RESERVED_WORDS = {
    "all", "analyse", "analyze", "and", "any", "array", "as", "asc",
    "asymmetric", "authorization", "binary", "both", "case", "cast",
    "check", "collate", "collation", "column", "concurrently", "constraint",
    "create", "cross", "current_catalog", "current_date", "current_role",
    "current_schema", "current_time", "current_timestamp", "current_user",
    "default", "deferrable", "desc", "distinct", "do", "else", "end",
    "except", "false", "fetch", "for", "foreign", "freeze", "from", "full",
    "grant", "group", "having", "ilike", "in", "initially", "inner",
    "intersect", "into", "is", "isnull", "join", "lateral", "leading",
    "left", "like", "limit", "localtime", "localtimestamp", "natural", "not",
    "notnull", "null", "offset", "on", "only", "or", "order", "outer",
    "overlaps", "placing", "primary", "references", "returning", "right",
    "select", "session_user", "similar", "some", "symmetric", "table",
    "tablesample", "then", "to", "trailing", "true", "union", "unique",
    "user", "using", "variadic", "verbose", "when", "where", "window",
    "with",
}


def sql_identifier(name: str) -> str:
    identifier = name.lower()
    if identifier in POSTGRES_RESERVED_WORDS or not re.fullmatch(
        r"[a-z_\u0080-\uffff][a-z0-9_\u0080-\uffff]*", identifier
    ):
        return f'"{identifier.replace(chr(34), chr(34) * 2)}"'
    return identifier


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def is_numeric_field(table: str, field: str) -> bool:
    base_field = re.sub(r"_(?:OLD|TEAR)$", "", field, flags=re.IGNORECASE)
    if base_field == "BUILDING_NO" and table != "BMSBASE":
        return False
    return base_field in NUMERIC_FIELDS


def is_date_field(field: str) -> bool:
    return field.upper().endswith("_DATE") or field.lower() == "owner_birth"


def view_columns(table: str, fields: list[str]) -> list[tuple[str, str]]:
    columns = [
        ("d.case_id", "case_id"),
        ("d.index_key", "index_key"),
        ("d.form_set", "form_set"),
    ]
    aliases = {alias for _expression, alias in columns}
    for field in fields:
        if field == "INDEX_KEY":
            continue
        alias = field.lower()
        if alias in aliases:
            raise ValueError(f"{table}.{field} 產生重複 SQL 欄名：{alias}")
        columns.append((f"r->>{sql_literal(field)}", alias))
        aliases.add(alias)
        if is_numeric_field(table, field):
            numeric_alias = f"{alias}_num"
            if numeric_alias in aliases:
                raise ValueError(f"{table}.{field} 產生重複 SQL 欄名：{numeric_alias}")
            columns.append(
                (f"NULLIF(r->>{sql_literal(field)}, '')::numeric", numeric_alias)
            )
            aliases.add(numeric_alias)
        if is_date_field(field):
            date_alias = f"{alias}_date"
            if date_alias in aliases:
                raise ValueError(f"{table}.{field} 產生重複 SQL 欄名：{date_alias}")
            columns.append(
                (f"cpami_roc_to_date(r->>{sql_literal(field)})", date_alias)
            )
            aliases.add(date_alias)
    return columns


def render_view(table: str, fields: list[str]) -> str:
    view_name = f"cpami_v_{table.lower()}"
    columns = view_columns(table, fields)
    select_lines = []
    for index, (expression, alias) in enumerate(columns):
        comma = "," if index < len(columns) - 1 else ""
        select_lines.append(f"    {expression} AS {sql_identifier(alias)}{comma}")
    return "\n".join(
        [
            f"CREATE OR REPLACE VIEW {view_name} AS",
            "SELECT",
            *select_lines,
            "FROM cpami_case_documents AS d",
            "CROSS JOIN LATERAL jsonb_array_elements(",
            f"    d.payload->{sql_literal('tables')}->{sql_literal(table)}",
            ") AS r;",
        ]
    )


def generate_sql(schema: dict[str, Any]) -> str:
    header = (
        "-- 本檔由 cpami-form-editor/tools/gen_db_views.py 產生，請勿手動編輯。\n"
        "-- JSONB payload 是正本；下列 view 只提供 text、numeric 與日期查詢投影。\n\n"
    )
    views = [
        render_view(table, schema["fieldOrder"][table])
        for table in schema["tableOrder"]
    ]
    return header + "\n\n".join(views) + "\n"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="產生 CPAMI PostgreSQL 投影 view SQL。")
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA_PATH, help="data_txt_schema.json 路徑")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT_PATH, help="輸出 views.sql 路徑")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    schema = load_schema(args.schema)
    output = generate_sql(schema)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(output, encoding="utf-8", newline="\n")
    print(f"已產生 {len(schema['tableOrder'])} 個投影 view：{args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

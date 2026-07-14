"""Extract the structural contract from a CPAMI ``data.txt`` file."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = APP_ROOT.parent / "data.txt"
DEFAULT_OUTPUT = APP_ROOT / "schema" / "data_txt_schema.json"
SCHEMA_VERSION = "2026-07-14"

if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from server import (  # noqa: E402  (the application root must be on sys.path first)
    REPEATABLE_TABLES,
    TABLE_LABELS,
    parse_data_txt_bytes,
)


def extract_schema(source: Path) -> dict:
    parsed = parse_data_txt_bytes(source.read_bytes())
    table_order = parsed["tableOrder"]
    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedFrom": source.name,
        "tableOrder": table_order,
        "fieldOrder": parsed["fieldOrder"],
        "tableMeta": {
            table: {
                "label": TABLE_LABELS.get(table, table),
                "repeatable": table in REPEATABLE_TABLES,
            }
            for table in table_order
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="從 data.txt 抽出不含案件資料的結構定義。")
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"來源 data.txt（預設：{DEFAULT_SOURCE}）",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"輸出 schema JSON（預設：{DEFAULT_OUTPUT}）",
    )
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    schema = extract_schema(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(schema, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    field_count = sum(len(fields) for fields in schema["fieldOrder"].values())
    print(f"已輸出 {len(schema['tableOrder'])} 表、{field_count} 欄：{output}")


if __name__ == "__main__":
    main()

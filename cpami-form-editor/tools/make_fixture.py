"""Build the deterministic, fictional CP950 fixture used by the test suite."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


APP_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMA = APP_ROOT / "schema" / "data_txt_schema.json"
DEFAULT_OUTPUT = APP_ROOT / "tests" / "fixtures" / "sample_data.txt"
INDEX_KEY = "1150101120000"
EXPECTED_TABLE_COUNT = 13
EXPECTED_FIELD_COUNT = 596


FIXTURE_ROWS: dict[str, list[dict[str, str]]] = {
    "BMSBASE": [
        {
            "BMPAS": "I80",
            "GOV": "I80",
            "BUILDING_CATEGORY": "01",
            "APPLY_TYPE": "A11-1",
            "BUILDING_NAME": "範例集合住宅新建工程",
        }
    ],
    "BM_TEC": [
        {
            "TEC_ITEM": "2",
            "TEC_NAME": "王範例",
            "TEC_TYPE": "04",
            "COM_NAME": "範例技師事務所",
            "COM_ADDR": "臺中市範例區範例路4號",
        }
    ],
    "BMSLAN": [
        {
            "DIST": "436",
            "SECTION": "4662",
            "ROAD_NO1": "0000",
            "ROAD_NO2": "1",
            "TOT_AREA": "600.5",
            "USE_AREA": "600.5",
        },
        {
            "DIST": "436",
            "SECTION": "4662",
            "ROAD_NO1": "0000",
            "ROAD_NO2": "2",
            "TOT_AREA": "399.5",
            "USE_AREA": "399.5",
        },
    ],
    "BMSLANOWNER": [
        {
            "DIST": "436",
            "SECTION": "4662",
            "ROAD_NO1": "0000",
            "ROAD_NO2": "1",
            "owner_id": "A123456789",
            "owner": "王範例",
            "owner_add": "臺中市範例區範例路1號",
            "owner_tel": "04-00000000",
        },
        {
            "DIST": "436",
            "SECTION": "4662",
            "ROAD_NO1": "0000",
            "ROAD_NO2": "2",
            "owner_id": "00000000",
            "owner": "範例建設股份有限公司",
            "owner_add": "臺中市範例區範例路2號",
            "owner_tel": "04-00000000",
        },
    ],
    "BMSMEMO": [
        {
            "MEMO_SEQ": "M591",
            "MEMO_SEQ_NAME": "火災警報器",
            "DESE": "範例備註",
        }
    ],
    "BMSP01": [
        {
            "BUILDING_NO": "A1",
            "CNAME": "範例建設股份有限公司",
            "IDENTIFY_NO": "00000000",
            "TEL_NO": "04-00000000",
            "BLD_CODE1": "H2",
            "BLD_CODE1_DESC": "住宅",
        },
        {
            "BUILDING_NO": "A2",
            "CNAME": "範例建設股份有限公司",
            "IDENTIFY_NO": "00000000",
            "TEL_NO": "04-00000000",
            "BLD_CODE1": "H2",
            "BLD_CODE1_DESC": "住宅",
        },
    ],
    "BMSP02": [
        {
            "CNAME": "王範例",
            "OFFICE_NAME": "範例建築師事務所",
            "COM_ADDRESS": "臺中市範例區範例路2號",
            "TEL_NO": "04-00000000",
            "eMail": "architect@example.com",
        }
    ],
    "BMSP03": [
        {
            "CNAME": "李範例",
            "OFFICE_NAME": "範例監造建築師事務所",
            "COM_ADDRESS": "臺中市範例區範例路3號",
            "TEL_NO": "04-00000000",
        }
    ],
    "BMSP04": [
        {
            "COMPANY_NAME": "範例營造股份有限公司",
            "COM_IDNO": "00000000",
            "BOSS": "陳範例",
            "COM_ADDRESS": "臺中市範例區範例路5號",
            "TECH_NAME": "林範例",
            "SCTNAME": "張範例",
        }
    ],
    "BMSPARK": [
        {
            "PARK_KIND": "1",
            "CAR_KIND": "1",
            "APPL_KIND": "1",
            "IN_OUT": "1",
            "UP_DOWN": "1",
            "NUM": "8",
            "AREA": "110",
            "AIR_FLAG": "N",
        },
        {
            "PARK_KIND": "1",
            "CAR_KIND": "2",
            "APPL_KIND": "2",
            "IN_OUT": "2",
            "UP_DOWN": "1",
            "NUM": "12",
            "AREA": "30",
            "AIR_FLAG": "N",
        },
    ],
    "BMSSC": [
        {
            "PRSTYLE": "1",
            "P01_NAME": "範例建設股份有限公司",
            "P04_NAME": "範例營造股份有限公司",
            "DATE_WORK_START": "1150201",
        }
    ],
    "BMSSTAIR": [
        {
            "STORY_CODE": "U0010",
            "USAGE_CODE1": "H2",
            "USAGE_CODE1_DESC": "住宅",
            "STORY_AREA": "500",
            "STORY_HEIGHT": "3.6",
        },
        {
            "STORY_CODE": "U0020",
            "USAGE_CODE1": "H2",
            "USAGE_CODE1_DESC": "住宅",
            "STORY_AREA": "480",
            "STORY_HEIGHT": "3.2",
        },
    ],
    "BMSWORK": [
        {
            "CONSNAME": "範例圍牆",
            "BUILDING_KIND": "RC造",
            "LENGTH": "50",
            "HEIGHT": "2",
            "WIDE": "0.15",
            "AREA": "100",
            "CONNUM": "1式",
        }
    ],
}


def load_schema(path: Path) -> dict[str, Any]:
    schema = json.loads(path.read_text(encoding="utf-8"))
    table_order = schema.get("tableOrder")
    field_order = schema.get("fieldOrder")
    if not isinstance(table_order, list) or not isinstance(field_order, dict):
        raise ValueError("schema 缺少 tableOrder 或 fieldOrder。")
    field_count = sum(len(field_order[table]) for table in table_order)
    if len(table_order) != EXPECTED_TABLE_COUNT or field_count != EXPECTED_FIELD_COUNT:
        raise ValueError(
            f"schema 結構不是預期的 {EXPECTED_TABLE_COUNT} 表、{EXPECTED_FIELD_COUNT} 欄。"
        )
    if set(FIXTURE_ROWS) != set(table_order):
        raise ValueError("fixture 的資料表集合與 schema 不一致。")
    return schema


def build_tables(schema: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    tables: dict[str, list[dict[str, str]]] = {}
    for table in schema["tableOrder"]:
        fields = schema["fieldOrder"][table]
        rows: list[dict[str, str]] = []
        for row_number, patch in enumerate(FIXTURE_ROWS[table], start=1):
            unknown = set(patch) - set(fields)
            if unknown:
                raise ValueError(f"{table} fixture 含 schema 未定義欄位：{sorted(unknown)}")
            row = {field: "" for field in fields}
            row.update(patch)
            if "INDEX_KEY" in row:
                row["INDEX_KEY"] = INDEX_KEY
            for sequence_field in ("person_seq", "Person_seq", "PERSON_SEQ"):
                if sequence_field in row:
                    row[sequence_field] = str(row_number)
            if "SPOKESMAN" in row and not row["SPOKESMAN"]:
                row["SPOKESMAN"] = "Y" if row_number == 1 else "N"
            rows.append(row)
        tables[table] = rows
    return tables


def serialize(schema: dict[str, Any], tables: dict[str, list[dict[str, str]]]) -> bytes:
    lines: list[str] = []
    for table in schema["tableOrder"]:
        lines.append(f"@TableName {table}")
        for row in tables[table]:
            lines.append("@RecordBegin")
            for field in schema["fieldOrder"][table]:
                value = row[field]
                if '"' in value or "\r" in value or "\n" in value:
                    raise ValueError(f"{table}.{field} 含 data.txt 不允許的字元。")
                lines.append(f'@d {field} "{value}"')
            lines.append("@RecordEnd")
    return ("\r\n".join(lines) + "\r\n").encode("cp950", errors="strict")


def main() -> None:
    parser = argparse.ArgumentParser(description="產生不含真實案件資料的測試 fixture。")
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    schema = load_schema(args.schema.resolve())
    tables = build_tables(schema)
    content = serialize(schema, tables)
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(content)
    row_count = sum(len(rows) for rows in tables.values())
    print(f"已輸出 {len(tables)} 表、{row_count} 筆虛構資料：{output}")


if __name__ == "__main__":
    main()

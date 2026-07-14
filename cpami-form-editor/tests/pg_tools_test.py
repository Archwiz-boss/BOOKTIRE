from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PROJECT_ROOT.parent
TOOLS_ROOT = PROJECT_ROOT / "tools"
SCHEMA_PATH = PROJECT_ROOT / "schema" / "data_txt_schema.json"
FIXTURE_PATH = PROJECT_ROOT / "tests" / "fixtures" / "sample_data.txt"
CODEBOOK_PATH = PROJECT_ROOT / "web" / "codebook.json"
SCHEMA_SQL_PATH = REPO_ROOT / "db" / "schema.sql"
VIEWS_SQL_PATH = REPO_ROOT / "db" / "views.sql"
DSN = os.environ.get("CPAMI_PG_DSN", "")

for import_path in (PROJECT_ROOT, TOOLS_ROOT):
    if str(import_path) not in sys.path:
        sys.path.insert(0, str(import_path))

import gen_db_views  # noqa: E402
import pg_export  # noqa: E402
import pg_import  # noqa: E402
import pg_load_codes  # noqa: E402
from cpami_core import (  # noqa: E402
    load_schema,
    parse_data_txt_bytes,
    serialize_tables,
)


def run_tool(script: str, *args: str, timeout: int = 60) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    if "--dry-run" in args:
        environment.pop("CPAMI_PG_DSN", None)
    return subprocess.run(
        [sys.executable, "-X", "utf8", str(TOOLS_ROOT / script), *args],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=environment,
        timeout=timeout,
        check=False,
    )


class PgToolsOfflineTest(unittest.TestCase):
    def test_schema_sql_is_idempotent_and_has_no_unique_index_key(self) -> None:
        sql = SCHEMA_SQL_PATH.read_text(encoding="utf-8")
        self.assertIn("CREATE TABLE IF NOT EXISTS cpami_projects", sql)
        self.assertIn("CREATE TABLE IF NOT EXISTS cpami_case_documents", sql)
        self.assertIn("CREATE TABLE IF NOT EXISTS cpami_codes", sql)
        self.assertIn("CREATE OR REPLACE FUNCTION cpami_roc_to_date", sql)
        self.assertEqual(sql.count("CREATE INDEX IF NOT EXISTS"), 3)
        self.assertNotRegex(sql.lower(), r"unique\s*\(\s*index_key")
        self.assertIn("UTF8", sql)
        self.assertIn("JSONB", sql)

    def test_generated_views_match_schema_and_tracked_sql(self) -> None:
        schema = load_schema(SCHEMA_PATH)
        with tempfile.TemporaryDirectory() as temporary_directory:
            generated_path = Path(temporary_directory) / "views.sql"
            result = run_tool("gen_db_views.py", "--out", str(generated_path))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            generated = generated_path.read_text(encoding="utf-8")

        self.assertEqual(generated, VIEWS_SQL_PATH.read_text(encoding="utf-8"))
        self.assertEqual(generated.count("CREATE OR REPLACE VIEW "), 13)
        for table in schema["tableOrder"]:
            view_name = f"cpami_v_{table.lower()}"
            match = re.search(
                rf"CREATE OR REPLACE VIEW {view_name} AS\nSELECT\n(.*?)\nFROM cpami_case_documents AS d",
                generated,
                flags=re.DOTALL,
            )
            self.assertIsNotNone(match, view_name)
            actual_columns = sum(
                " AS " in line for line in match.group(1).splitlines()
            )
            expected_columns = len(
                gen_db_views.view_columns(table, schema["fieldOrder"][table])
            )
            self.assertEqual(actual_columns, expected_columns, view_name)

        self.assertRegex(
            generated,
            r"NULLIF\(r->>'TOT_AREA', ''\)::numeric AS tot_area_num",
        )
        self.assertIn(
            "cpami_roc_to_date(r->>'owner_birth') AS owner_birth_date", generated
        )

    def test_pg_import_fixture_dry_run_masks_values(self) -> None:
        result = run_tool(
            "pg_import.py", "--data-txt", str(FIXTURE_PATH), "--dry-run"
        )
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        self.assertIn("DRY-RUN：不會連線或寫入 PostgreSQL", output)
        self.assertIn("WITH updated AS", output)
        self.assertIn('"payload": "13 表／18 筆記錄（內容不顯示）"', output)
        self.assertIn('"building_name": "範', output)
        self.assertNotIn("範例集合住宅新建工程", output)
        self.assertNotIn("範例建設股份有限公司", output)
        self.assertNotIn("A123456789", output)

    def test_pg_import_case_json_dry_run(self) -> None:
        schema = load_schema(SCHEMA_PATH)
        parsed = parse_data_txt_bytes(FIXTURE_PATH.read_bytes())
        envelope = {
            "schemaVersion": schema["schemaVersion"],
            "formSet": "B",
            "tables": parsed["tables"],
            "extraTables": {
                "BMSROAD": [
                    {
                        "INDEX_KEY": "1150101120000",
                        "person_seq": "1",
                        "SPOKESMAN": "Y",
                        "ROAD_SEC": "範例路",
                        "LENGTH": "20",
                        "WIDE": "8",
                    }
                ]
            },
        }
        with tempfile.TemporaryDirectory() as temporary_directory:
            case_path = Path(temporary_directory) / "case.json"
            case_path.write_text(
                json.dumps(envelope, ensure_ascii=False), encoding="utf-8"
            )
            result = run_tool(
                "pg_import.py", "--case-json", str(case_path), "--dry-run"
            )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(f'"schema_version": "{schema["schemaVersion"]}"', result.stdout)
        self.assertIn('"payload": "13 表／18 筆記錄（內容不顯示）"', result.stdout)
        self.assertIn('"extra_payload": "4 擴充表／1 筆記錄（內容不顯示）"', result.stdout)

    def test_pg_export_payload_roundtrip_without_database(self) -> None:
        schema = load_schema(SCHEMA_PATH)
        parsed = parse_data_txt_bytes(FIXTURE_PATH.read_bytes())
        database_row = (
            "00000000-0000-0000-0000-000000000000",
            schema["schemaVersion"],
            "A",
            "draft",
            {"tables": parsed["tables"]},
            None,
        )
        tables = pg_export.payload_tables(database_row, schema)
        self.assertEqual(
            serialize_tables(tables, schema), FIXTURE_PATH.read_bytes()
        )

    def test_pg_load_codes_dry_run_counts_are_correct(self) -> None:
        rows, stats = pg_load_codes.load_code_rows(CODEBOOK_PATH)
        self.assertEqual(
            stats,
            {
                "code_types": 43,
                "legacy_rows": 22383,
                "official_sections": 1626,
                "unique_rows": 23331,
            },
        )
        self.assertEqual(len(rows), 23331)
        self.assertTrue(any(row[0] == "ALLRPT" for row in rows))
        self.assertTrue(
            any(row[0] == "SEC" and row[6] == "taichung-opendata" for row in rows)
        )

        result = run_tool("pg_load_codes.py", "--dry-run")
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        self.assertIn("代碼類型：43", output)
        self.assertIn("舊系統代碼：22383", output)
        self.assertIn("臺中市官方地段：1626", output)
        self.assertIn("去重後唯一鍵：23331", output)

    def test_database_integration_when_dsn_is_available(self) -> None:
        if not DSN:
            self.skipTest("未設定 CPAMI_PG_DSN，略過 PostgreSQL 整合測試。")

        driver = pg_import.require_psycopg()
        with driver.connect(DSN) as connection:
            with connection.cursor() as cursor:
                cursor.execute(SCHEMA_SQL_PATH.read_text(encoding="utf-8"))
                cursor.execute(VIEWS_SQL_PATH.read_text(encoding="utf-8"))

        import_result = run_tool(
            "pg_import.py",
            "--dsn",
            DSN,
            "--data-txt",
            str(FIXTURE_PATH),
            timeout=120,
        )
        self.assertEqual(
            import_result.returncode, 0, import_result.stdout + import_result.stderr
        )
        case_match = re.search(
            r"case_id：([0-9a-fA-F-]{36})", import_result.stdout
        )
        self.assertIsNotNone(case_match, import_result.stdout)

        with tempfile.TemporaryDirectory() as temporary_directory:
            export_path = Path(temporary_directory) / "data.txt"
            export_result = run_tool(
                "pg_export.py",
                "--dsn",
                DSN,
                "--index-key",
                "1150101120000",
                "--case-id",
                case_match.group(1),
                "--out",
                str(export_path),
                timeout=120,
            )
            self.assertEqual(
                export_result.returncode,
                0,
                export_result.stdout + export_result.stderr,
            )
            self.assertEqual(export_path.read_bytes(), FIXTURE_PATH.read_bytes())

        codes_result = run_tool(
            "pg_load_codes.py", "--dsn", DSN, timeout=180
        )
        self.assertEqual(
            codes_result.returncode, 0, codes_result.stdout + codes_result.stderr
        )
        _rows, stats = pg_load_codes.load_code_rows(CODEBOOK_PATH)
        with driver.connect(DSN) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT count(*) FROM cpami_codes "
                    "WHERE source IN ('bldcode.mdb', 'taichung-opendata')"
                )
                loaded_count = cursor.fetchone()[0]
        self.assertEqual(loaded_count, stats["unique_rows"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

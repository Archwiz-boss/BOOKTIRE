from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = PROJECT_ROOT / "schema" / "data_txt_schema.json"
FIXTURE_PATH = PROJECT_ROOT / "tests" / "fixtures" / "sample_data.txt"
sys.path.insert(0, str(PROJECT_ROOT))

import cpami_core as core  # noqa: E402


class CpamiCoreTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = core.load_schema(SCHEMA_PATH)
        cls.fixture = FIXTURE_PATH.read_bytes()
        cls.parsed = core.parse_data_txt_bytes(cls.fixture)
        core.assert_parsed_matches_schema(cls.parsed, cls.schema)

    def fresh_tables(self) -> dict[str, list[dict[str, str]]]:
        return copy.deepcopy(self.parsed["tables"])

    def test_fixture_roundtrip_is_byte_identical(self) -> None:
        prepared = core.prepare_payload(
            {"tables": self.fresh_tables()}, self.schema, fill_defaults=False
        )
        self.assertEqual(core.serialize_tables(prepared, self.schema), self.fixture)

    def test_empty_case_export_materializes_all_tables_and_fields(self) -> None:
        empty_tables = {table: [] for table in self.schema["tableOrder"]}
        prepared = core.prepare_payload(
            {"tables": empty_tables}, self.schema, fill_defaults=True
        )
        self.assertTrue(
            all(len(prepared[table]) == 1 for table in self.schema["tableOrder"])
        )
        for table in self.schema["tableOrder"]:
            self.assertEqual(
                list(prepared[table][0]), self.schema["fieldOrder"][table]
            )
            for sequence_field in ("person_seq", "Person_seq", "PERSON_SEQ"):
                if sequence_field in prepared[table][0]:
                    self.assertEqual(prepared[table][0][sequence_field], "1")

        raw = core.serialize_tables(prepared, self.schema)
        parsed = core.parse_data_txt_bytes(raw)
        core.assert_parsed_matches_schema(parsed, self.schema)
        self.assertEqual(len(parsed["tableOrder"]), 13)
        self.assertEqual(
            sum(len(fields) for fields in parsed["fieldOrder"].values()), 596
        )

    def test_index_key_mismatch_is_an_error(self) -> None:
        tables = self.fresh_tables()
        tables["BMSLAN"][0]["INDEX_KEY"] = "1150101129999"
        report = core.validate_tables(tables, self.schema)
        self.assertTrue(any("INDEX_KEY" in error and "不一致" in error for error in report["errors"]))

    def test_duplicate_person_sequence_is_an_error(self) -> None:
        tables = self.fresh_tables()
        sequence_field = next(
            field
            for field in ("person_seq", "Person_seq", "PERSON_SEQ")
            if field in tables["BMSLAN"][0]
        )
        tables["BMSLAN"][1][sequence_field] = tables["BMSLAN"][0][sequence_field]
        report = core.validate_tables(tables, self.schema)
        self.assertTrue(any("PERSON_SEQ" in error and "重複" in error for error in report["errors"]))

    def test_non_numeric_value_is_an_error(self) -> None:
        tables = self.fresh_tables()
        tables["BMSLAN"][0]["TOT_AREA"] = "一百"
        report = core.validate_tables(tables, self.schema)
        self.assertTrue(any("TOT_AREA" in error and "純數字" in error for error in report["errors"]))

    def test_quote_or_newline_is_rejected(self) -> None:
        for invalid_value in ('範例"工程', "範例第一行\n範例第二行"):
            with self.subTest(invalid_value=invalid_value):
                tables = self.fresh_tables()
                tables["BMSBASE"][0]["BUILDING_NAME"] = invalid_value
                with self.assertRaisesRegex(core.DataTxtError, "雙引號或換行"):
                    core.prepare_payload(
                        {"tables": tables}, self.schema, fill_defaults=False
                    )

    def test_cp950_unencodable_character_is_an_error(self) -> None:
        tables = self.fresh_tables()
        tables["BMSBASE"][0]["BUILDING_NAME"] = "範例𠀋工程"
        report = core.validate_tables(tables, self.schema)
        self.assertTrue(any("CP950" in error and "𠀋" in error for error in report["errors"]))

    def test_legacy_payload_is_accepted(self) -> None:
        tables = self.fresh_tables()
        self.assertIs(core.parse_envelope({"tables": tables}, self.schema), tables)

    def test_versioned_envelope_is_accepted(self) -> None:
        tables = self.fresh_tables()
        envelope = {
            "schemaVersion": self.schema["schemaVersion"],
            "formSet": "A",
            "tables": tables,
        }
        self.assertIs(core.parse_envelope(envelope, self.schema), tables)

    def test_case_extension_schema_and_roundtrip_boundary(self) -> None:
        self.assertEqual(
            self.schema["extraTableOrder"],
            ["BMSROAD", "BMSCHK", "BMSSCRP", "RPTPHOTO", "C21_3", "BMELVTR"],
        )
        self.assertEqual(
            sum(len(fields) for fields in self.schema["extraFieldOrder"].values()),
            110,
        )
        envelope = core.prepare_case_envelope(
            {
                "schemaVersion": self.schema["schemaVersion"],
                "formSet": "B",
                "tables": self.fresh_tables(),
                "extraTables": {
                    "BMSROAD": [
                        {
                            "INDEX_KEY": "1150101120000",
                            "person_seq": "1",
                            "SPOKESMAN": "Y",
                            "ROAD_SEC": "範例路",
                            "MEMO": "可保存引號「範例」與\n多行說明",
                            "LENGTH": "20",
                            "WIDE": "8",
                        }
                    ],
                    "C21_3": [
                        {
                            "Index_key": "1150101120000",
                            "Rpt_FmName": "C21-3",
                            "Rpt_Seq": "001",
                            "Rpt_Item": "【1.防火區劃】",
                            "Rpt_Data": "符合規定",
                        }
                    ],
                    "BMELVTR": [
                        {
                            "INDEX_KEY": "1150101120000",
                            "PERSON_SEQ": "1",
                            "PAKENO": "E01",
                            "CHECK_YEAR": "115",
                            "ELEV_USE": "B",
                            "MFT_NAME": "範例電梯股份有限公司",
                        }
                    ],
                },
            },
            self.schema,
            fill_defaults=False,
        )
        self.assertEqual(envelope["formSet"], "B")
        self.assertEqual(envelope["extraTables"]["BMSROAD"][0]["ROAD_SEC"], "範例路")
        self.assertIn("\n", envelope["extraTables"]["BMSROAD"][0]["MEMO"])
        self.assertEqual(envelope["extraTables"]["C21_3"][0]["Rpt_Seq"], "001")
        self.assertEqual(envelope["extraTables"]["BMELVTR"][0]["ELEV_USE"], "B")
        self.assertEqual(
            core.serialize_tables(envelope["tables"], self.schema), self.fixture
        )

    def test_cd_extension_defaults_use_legacy_key_casing(self) -> None:
        envelope = core.prepare_case_envelope(
            {
                "schemaVersion": self.schema["schemaVersion"],
                "formSet": "C",
                "tables": self.fresh_tables(),
                "extraTables": {"C21_3": [{}], "BMELVTR": [{}]},
            },
            self.schema,
            fill_defaults=True,
        )
        self.assertEqual(envelope["extraTables"]["C21_3"][0]["Index_key"], "1150101120000")
        self.assertEqual(envelope["extraTables"]["C21_3"][0]["Rpt_FmName"], "C21-3")
        self.assertEqual(envelope["extraTables"]["BMELVTR"][0]["INDEX_KEY"], "1150101120000")
        self.assertEqual(envelope["extraTables"]["BMELVTR"][0]["PERSON_SEQ"], "1")

    def test_extra_table_quality_issues_are_warnings(self) -> None:
        envelope = core.prepare_case_envelope(
            {
                "schemaVersion": self.schema["schemaVersion"],
                "formSet": "B",
                "tables": self.fresh_tables(),
                "extraTables": {
                    "BMSCHK": [
                        {
                            "INDEX_KEY": "1150101120000",
                            "PERSON_SEQ": "1",
                            "CHK_Item_code": "000001",
                            "CHK_Item": "",
                            "CHK_Date1": "明天",
                            "NET_SEQ": "第一筆",
                        }
                    ],
                    "RPTPHOTO": [
                        {
                            "INDEX_KEY": "1150101120000",
                            "PERSON_SEQ": "1",
                            "barcode": "不是Base64",
                        }
                    ],
                    "C21_3": [
                        {
                            "Index_key": "1150101120000",
                            "Rpt_Seq": "第一項",
                            "Rpt_Item": "",
                        }
                    ],
                    "BMELVTR": [
                        {
                            "INDEX_KEY": "1150101120000",
                            "PERSON_SEQ": "1",
                            "CHECK_YEAR": "一一五",
                            "CHECK_DATE": "明天",
                        }
                    ],
                },
            },
            self.schema,
            fill_defaults=False,
        )
        report = core.validate_case_envelope(envelope, self.schema)
        self.assertTrue(report["ok"])
        self.assertTrue(any("NET_SEQ" in warning for warning in report["warnings"]))
        self.assertTrue(any("CHK_Item" in warning for warning in report["warnings"]))
        self.assertTrue(any("Base64" in warning for warning in report["warnings"]))
        self.assertTrue(any("Rpt_Seq" in warning for warning in report["warnings"]))
        self.assertTrue(any("Rpt_Item" in warning for warning in report["warnings"]))
        self.assertTrue(any("CHECK_YEAR" in warning for warning in report["warnings"]))
        self.assertEqual(report["extraCounts"]["BMSCHK"], 1)

    def test_case_json_can_preserve_data_txt_unsafe_draft_text(self) -> None:
        tables = self.fresh_tables()
        tables["BMSBASE"][0]["BUILDING_NAME"] = '範例"工程\n草稿'
        envelope = core.prepare_case_envelope(
            {
                "schemaVersion": self.schema["schemaVersion"],
                "formSet": "B",
                "tables": tables,
                "extraTables": {},
            },
            self.schema,
            fill_defaults=False,
            allow_data_txt_unsafe=True,
        )
        self.assertEqual(envelope["tables"]["BMSBASE"][0]["BUILDING_NAME"], '範例"工程\n草稿')
        report = core.validate_case_envelope(envelope, self.schema)
        self.assertFalse(report["ok"])
        self.assertTrue(any("雙引號或換行" in error for error in report["errors"]))

    def test_form_set_defaults_to_a(self) -> None:
        tables = self.fresh_tables()
        envelope_without_form_set = {
            "schemaVersion": self.schema["schemaVersion"],
            "tables": tables,
        }
        self.assertIs(
            core.parse_envelope(envelope_without_form_set, self.schema), tables
        )

    def test_schema_version_mismatch_includes_both_versions(self) -> None:
        wrong_version = "1900-01-01"
        with self.assertRaises(core.DataTxtError) as caught:
            core.parse_envelope(
                {
                    "schemaVersion": wrong_version,
                    "formSet": "A",
                    "tables": self.fresh_tables(),
                },
                self.schema,
            )
        message = str(caught.exception)
        self.assertIn(wrong_version, message)
        self.assertIn(self.schema["schemaVersion"], message)


if __name__ == "__main__":
    unittest.main(verbosity=2)

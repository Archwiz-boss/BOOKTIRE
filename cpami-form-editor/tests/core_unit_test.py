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

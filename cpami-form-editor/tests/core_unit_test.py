from __future__ import annotations

import copy
import json
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

    def test_double_quote_is_rejected(self) -> None:
        tables = self.fresh_tables()
        tables["BMSBASE"][0]["BUILDING_NAME"] = '範例"工程'
        with self.assertRaisesRegex(core.DataTxtError, "半形雙引號"):
            core.prepare_payload({"tables": tables}, self.schema, fill_defaults=False)
        report = core.validate_tables(tables, self.schema)
        self.assertTrue(any("半形雙引號" in error for error in report["errors"]))

    def test_multiline_long_text_roundtrips_and_only_warns(self) -> None:
        """A12_TITTLE 這類 LongText 是舊系統的 memo，值本身就可能有換行。"""
        title = (
            "茲有（詳土地使用權同意書附表　起造人名冊），範例建設股份有限公司\r\n"
            "負責人:王範例　擬在下列土地建築地上15層、地下3層，建築物1棟"
        )
        tables = self.fresh_tables()
        tables["BMSBASE"][0]["A12_TITTLE"] = title
        prepared = core.prepare_payload(
            {"tables": tables}, self.schema, fill_defaults=False
        )
        report = core.validate_tables(prepared, self.schema)
        self.assertEqual(report["errors"], [])
        self.assertTrue(
            any("含換行" in warning and "A12_TITTLE" in warning for warning in report["warnings"])
        )
        raw = core.serialize_tables(prepared, self.schema)
        reloaded = core.parse_data_txt_bytes(raw)
        self.assertEqual(reloaded["tables"]["BMSBASE"][0]["A12_TITTLE"], title)
        self.assertEqual(core.serialize_tables(prepared, self.schema), raw)

    def test_lone_lf_and_control_characters_do_not_split_a_field(self) -> None:
        """\\x0b 之類的控制字元是 memo 的資料，str.splitlines() 卻會拿它斷行。"""
        # U+0085 也在 splitlines() 的斷行集合裡，但 CP950 編不出來，不可能出現在檔案內。
        for separator in ("\n", "\r", "\r\n", "\x0b", "\x0c", "\x1c", "\x1d", "\x1e"):
            with self.subTest(separator=separator):
                title = f"第一段{separator}第二段"
                tables = self.fresh_tables()
                tables["BMSBASE"][0]["A12_TITTLE"] = title
                prepared = core.prepare_payload(
                    {"tables": tables}, self.schema, fill_defaults=False
                )
                raw = core.serialize_tables(prepared, self.schema)
                reloaded = core.parse_data_txt_bytes(raw)
                self.assertEqual(reloaded["tables"]["BMSBASE"][0]["A12_TITTLE"], title)
                self.assertEqual(
                    core.serialize_tables(
                        core.prepare_payload(
                            {"tables": reloaded["tables"]}, self.schema, fill_defaults=False
                        ),
                        self.schema,
                    ),
                    raw,
                )

    def test_unterminated_field_is_still_an_error(self) -> None:
        """多行值的支援不能把真的壞掉的檔案也一起吞掉。"""
        broken = self.fixture.replace(
            b'@d A12_TITTLE ""', b'@d A12_TITTLE "\xa4\xfd\xbdd\xa8\xd2', 1
        )
        self.assertNotEqual(broken, self.fixture)
        with self.assertRaisesRegex(core.DataTxtError, "無法辨識"):
            core.parse_data_txt_bytes(broken)

    def test_cp950_unencodable_character_is_an_error(self) -> None:
        tables = self.fresh_tables()
        tables["BMSBASE"][0]["BUILDING_NAME"] = "範例𠀋工程"
        report = core.validate_tables(tables, self.schema)
        self.assertTrue(any("CP950" in error and "𠀋" in error for error in report["errors"]))

    def test_big5_eudc_survives_load_and_export_byte_for_byte(self) -> None:
        """舊系統寫出的造字（罕用字姓名）必須讀得進來，而且匯出時位元組不變。"""
        eudc = b"\xfa\x40\x8e\x40\x81\x40\xc8\xfe"  # 四個造字區各取一個字
        name = "王" + core.decode_cp950(eudc)
        tables = self.fresh_tables()
        tables["BMSP01"][0]["CNAME"] = name
        prepared = core.prepare_payload(
            {"tables": tables}, self.schema, fill_defaults=False
        )
        report = core.validate_tables(prepared, self.schema)
        self.assertEqual(report["errors"], [])
        raw = core.serialize_tables(prepared, self.schema)
        self.assertTrue(b'@d CNAME "\xa4\xfd' + eudc + b'"' in raw)
        reloaded = core.parse_data_txt_bytes(raw)
        self.assertEqual(reloaded["tables"]["BMSP01"][0]["CNAME"], name)
        self.assertEqual(core.serialize_tables(prepared, self.schema), raw)

    def test_eudc_mapping_matches_windows_cp950_and_is_reversible(self) -> None:
        trail_bytes = tuple(range(0x40, 0x7F)) + tuple(range(0xA1, 0xFF))
        checked = 0
        for lead in range(0x81, 0x100):
            for trail in trail_bytes:
                sequence = bytes((lead, trail))
                try:
                    sequence.decode("cp950")
                except UnicodeDecodeError:
                    pass
                else:
                    continue  # 內建 codec 已經處理，相容層不該插手
                if sequence not in core._EUDC_DECODE:
                    continue
                decoded = core.decode_cp950(sequence)
                self.assertEqual(len(decoded), 1)
                if sequence not in core.UNC_EUDC_TO_UNICODE.values():
                    # 官方罕用字會被換成真正的字，其餘仍留在私人使用區。
                    in_pua = 0xE000 <= ord(decoded) <= 0xF848
                    known_unc = decoded in core.UNC_EUDC_TO_UNICODE.values()
                    self.assertTrue(in_pua or known_unc)
                self.assertEqual(core.encode_cp950(decoded), sequence)
                checked += 1
        self.assertEqual(checked, 5968)

    def test_unc_table_matches_the_codebook(self) -> None:
        """罕用字對照的來源是 bldcode 的 CODE_TYPE='UNC'，不可以手改成兩套。"""
        codebook = json.loads(
            (PROJECT_ROOT / "web" / "codebook.json").read_text(encoding="utf-8")
        )
        expected = {}
        for entry in codebook["codeTypes"]["UNC"]:
            label, mark = entry["label"], entry["mark"]
            if len(label) == 1 and mark.startswith("&#") and mark.endswith(";"):
                expected[label] = chr(int(mark[2:-1]))
        self.assertEqual(expected, core.UNC_EUDC_TO_UNICODE)

    def test_unc_substitution_is_safe_and_reversible(self) -> None:
        """雙向轉換成立的兩個前提，改對照表時必須重新驗證。"""
        reals = list(core.UNC_EUDC_TO_UNICODE.values())
        self.assertEqual(len(set(reals)), len(reals))  # 一對一，沒有兩個造字對到同一字
        for pua, real in core.UNC_EUDC_TO_UNICODE.items():
            # 真實字本身不可被 CP950 編碼——否則會和正規 Big5 字混淆。
            with self.assertRaises(UnicodeEncodeError):
                real.encode("cp950")
            self.assertEqual(core.encode_cp950(real), core._EUDC_ENCODE[pua])
            self.assertEqual(core.decode_cp950(core._EUDC_ENCODE[pua]), real)

    def test_rare_character_reads_as_the_real_word(self) -> None:
        """賴厝廍：舊系統存造字 0xFA76，畫面要看到「廍」而不是方框。"""
        name = "臺中市北屯區賴厝" + core.decode_cp950(b"\xfa\x76")
        self.assertEqual(name[-1], "廍")
        tables = self.fresh_tables()
        tables["BMSLANOWNER"][0]["owner_add"] = name
        prepared = core.prepare_payload(
            {"tables": tables}, self.schema, fill_defaults=False
        )
        report = core.validate_tables(prepared, self.schema)
        self.assertEqual(report["errors"], [])
        # 罕用字已經是真正的字，不該再被當成「看不懂的造字」提醒使用者。
        self.assertFalse(any("造字" in warning for warning in report["warnings"]))
        raw = core.serialize_tables(prepared, self.schema)
        self.assertIn("賴厝".encode("cp950") + b"\xfa\x76", raw)
        reloaded = core.parse_data_txt_bytes(raw)
        self.assertEqual(reloaded["tables"]["BMSLANOWNER"][0]["owner_add"], name)
        self.assertEqual(core.serialize_tables(prepared, self.schema), raw)

    def test_eudc_warning_names_the_field(self) -> None:
        tables = self.fresh_tables()
        tables["BMSP01"][0]["CNAME"] = "王" + core.decode_cp950(b"\xfa\x40")
        report = core.validate_tables(tables, self.schema)
        self.assertTrue(
            any("造字" in warning and "CNAME" in warning for warning in report["warnings"])
        )

    def test_truly_invalid_bytes_still_report_position_and_line(self) -> None:
        broken = bytearray(self.fixture)
        offset = broken.index(b"@RecordBegin") + 4
        broken[offset : offset + 2] = b"\xa3\xc0"  # Big5 未使用碼位，Windows 也讀不出來
        with self.assertRaises(core.DataTxtError) as caught:
            core.parse_data_txt_bytes(bytes(broken))
        message = str(caught.exception)
        self.assertIn(f"位元組位置 {offset}", message)
        self.assertIn("0xA3 0xC0", message)

    def test_utf8_file_is_named_as_the_cause(self) -> None:
        utf8_source = core.decode_cp950(self.fixture).encode("utf-8")
        with self.assertRaisesRegex(core.DataTxtError, "UTF-8"):
            core.parse_data_txt_bytes(utf8_source)

    def test_big5_duplicate_table_matches_the_live_codec(self) -> None:
        trail_bytes = tuple(range(0x40, 0x7F)) + tuple(range(0xA1, 0xFF))
        live = {}
        for lead in range(0x81, 0x100):
            for trail in trail_bytes:
                sequence = bytes((lead, trail))
                try:
                    canonical = sequence.decode("cp950").encode("cp950")
                except (UnicodeDecodeError, UnicodeEncodeError):
                    continue
                if canonical != sequence:
                    live[sequence] = canonical
        self.assertEqual(live, core.BIG5_DUPLICATE_SEQUENCES)

    def test_big5_duplicate_bytes_are_reported_on_import(self) -> None:
        source = self.fixture.replace(b'@d BUILDING_NAME "', b'@d BUILDING_NAME "\xa2\xcc', 1)
        self.assertNotEqual(source, self.fixture)
        notes = core.parse_data_txt_bytes(source)["byteNotes"]
        self.assertTrue(any("0xA2CC" in note and "0xA451" in note for note in notes))
        self.assertEqual(core.parse_data_txt_bytes(self.fixture)["byteNotes"], [])

    def variant_document(self) -> tuple[bytes, dict, dict]:
        """做一份「缺 3 張模板表、多 1 張模板沒有的表」的虛構 data.txt。

        真實的舊系統匯出就長這樣：沒填監造人就不輸出 BMSP03，二維條碼封包又會多帶
        BDMSIGN 之類的簽章表。
        """
        parsed = core.parse_data_txt_bytes(self.fixture)
        layout = core.document_layout(parsed)
        dropped = {"BMSP03", "BMSP04", "BMSSC"}
        layout["tableOrder"] = [t for t in layout["tableOrder"] if t not in dropped]
        layout["tableOrder"].insert(1, "BDMSIGN")
        layout["fieldOrder"]["BDMSIGN"] = ["INDEX_KEY", "SIGNSEQ", "SIGNINFO"]
        index_key = parsed["tables"]["BMSBASE"][0]["INDEX_KEY"]
        passthrough = {
            "BDMSIGN": [
                {"INDEX_KEY": index_key, "SIGNSEQ": "1", "SIGNINFO": "範例電子簽章"},
                {"INDEX_KEY": index_key, "SIGNSEQ": "2", "SIGNINFO": "範例建築師簽章"},
            ]
        }
        raw = core.serialize_tables(
            parsed["tables"], self.schema, layout=layout, passthrough=passthrough
        )
        return raw, layout, passthrough

    def test_document_with_missing_and_extra_tables_is_accepted(self) -> None:
        raw, layout, passthrough = self.variant_document()
        parsed = core.parse_data_txt_bytes(raw)
        core.assert_parsed_matches_schema(parsed, self.schema)
        self.assertEqual(parsed["tableOrder"], layout["tableOrder"])
        self.assertNotIn("BMSP03", parsed["tableOrder"])
        self.assertEqual(core.passthrough_tables(parsed, self.schema), passthrough)

    def test_export_reproduces_the_source_table_set_byte_for_byte(self) -> None:
        """匯出必須還原原檔的表集合與順序——舊系統要收得回去，不能多也不能少。"""
        raw, _, _ = self.variant_document()
        parsed = core.parse_data_txt_bytes(raw)
        layout = core.document_layout(parsed)
        passthrough = core.passthrough_tables(parsed, self.schema)
        prepared = core.prepare_payload(
            {"tables": parsed["tables"]}, self.schema, fill_defaults=True, layout=layout
        )
        self.assertNotIn("BMSP03", prepared)  # 不憑空補回原檔沒有的表
        rebuilt = core.serialize_tables(
            prepared, self.schema, layout=layout, passthrough=passthrough
        )
        self.assertEqual(rebuilt, raw)

    def test_blank_case_without_layout_still_exports_13_tables(self) -> None:
        empty = {table: [] for table in self.schema["tableOrder"]}
        prepared = core.prepare_payload(
            {"tables": empty}, self.schema, fill_defaults=True
        )
        parsed = core.parse_data_txt_bytes(core.serialize_tables(prepared, self.schema))
        self.assertEqual(parsed["tableOrder"], self.schema["tableOrder"])
        self.assertEqual(sum(len(f) for f in parsed["fieldOrder"].values()), 596)

    def test_document_without_bmsbase_is_rejected(self) -> None:
        raw = self.fixture.replace(b"@TableName BMSBASE\r\n", b"@TableName BMSFOO\r\n", 1)
        parsed = core.parse_data_txt_bytes(raw)
        with self.assertRaisesRegex(core.DataTxtError, "BMSBASE"):
            core.assert_parsed_matches_schema(parsed, self.schema)

    def test_shared_table_with_wrong_fields_is_still_rejected(self) -> None:
        raw = self.fixture.replace(b'@d BMPAS "', b'@d BMPASX "', 1)
        parsed = core.parse_data_txt_bytes(raw)
        with self.assertRaisesRegex(core.DataTxtError, "BMSBASE 欄位集合或順序"):
            core.assert_parsed_matches_schema(parsed, self.schema)

    def test_envelope_carries_layout_and_passthrough(self) -> None:
        raw, layout, passthrough = self.variant_document()
        parsed = core.parse_data_txt_bytes(raw)
        envelope = core.prepare_case_envelope(
            {
                "schemaVersion": self.schema["schemaVersion"],
                "formSet": "A",
                "tables": parsed["tables"],
                "extraTables": {},
                "documentLayout": core.document_layout(parsed),
                "passthroughTables": core.passthrough_tables(parsed, self.schema),
            },
            self.schema,
            fill_defaults=True,
        )
        self.assertEqual(envelope["documentLayout"]["tableOrder"], layout["tableOrder"])
        self.assertEqual(envelope["passthroughTables"], passthrough)
        self.assertEqual(
            core.serialize_tables(
                envelope["tables"],
                self.schema,
                layout=envelope["documentLayout"],
                passthrough=envelope["passthroughTables"],
            ),
            raw,
        )

    def test_layout_cannot_redefine_a_known_table(self) -> None:
        with self.assertRaisesRegex(core.DataTxtError, "BMSLAN 欄位集合或順序"):
            core.parse_document_layout(
                {"tableOrder": ["BMSLAN"], "fieldOrder": {"BMSLAN": ["INDEX_KEY"]}},
                self.schema,
            )

    def test_passthrough_cannot_hijack_a_known_table(self) -> None:
        with self.assertRaisesRegex(core.DataTxtError, "不該放在 passthroughTables"):
            core.parse_passthrough_tables({"BMSLAN": []}, None, self.schema)

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
        self.assertTrue(any("半形雙引號" in error for error in report["errors"]))

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

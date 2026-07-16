from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import struct
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Any


BASE_URL = os.environ.get("CPAMI_TEST_BASE_URL", "http://127.0.0.1:8765")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT.parent / "data.txt"
SCHEMA_PATH = PROJECT_ROOT / "schema" / "data_txt_schema.json"
EXTENSION_SCHEMA_PATH = PROJECT_ROOT / "schema" / "case_extension_schema.json"
FIXTURE_PATH = PROJECT_ROOT / "tests" / "fixtures" / "sample_data.txt"


def get(path: str) -> tuple[bytes, str, int]:
    with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=10) as response:
        return response.read(), response.headers.get_content_type(), response.status


def post(path: str, body: bytes, content_type: str) -> tuple[bytes, str, int]:
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        method="POST",
        headers={"Content-Type": content_type},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read(), response.headers.get_content_type(), response.status


def import_data_txt(raw: bytes) -> tuple[dict[str, Any], int]:
    body, content_type, status = post("/api/import-data-txt", raw, "text/plain")
    assert content_type == "application/json"
    return json.loads(body), status


def export_tables(tables: dict[str, list[dict[str, str]]]) -> tuple[bytes, str, int]:
    payload = json.dumps({"tables": tables}, ensure_ascii=False).encode("utf-8")
    return post("/api/export", payload, "application/json; charset=utf-8")


def post_json_response(path: str, payload: dict[str, Any]) -> tuple[dict[str, Any], int]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        response = urllib.request.urlopen(request, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        assert response.headers.get_content_type() == "application/json"
        return json.load(response), response.status


def package_zip(data_txt: bytes) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.comment = "CPAMI package fixture".encode("ascii")
        archive.writestr("案件資料/data.txt", data_txt)
        archive.writestr("案件資料/說明.txt", "此檔案不應被修改。".encode("utf-8"))
        binary = zipfile.ZipInfo("attachments/drawing.bin", date_time=(2025, 6, 1, 12, 30, 0))
        binary.compress_type = zipfile.ZIP_STORED
        binary.external_attr = 0o644 << 16
        archive.writestr(binary, bytes(range(256)))
    return output.getvalue()


def export_zip(payload: dict[str, Any], archive: bytes) -> tuple[bytes, str, int]:
    boundary = b"----CPAMIZipRoundtripBoundary"
    case_json = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    body = b"\r\n".join(
        [
            b"--" + boundary,
            b'Content-Disposition: form-data; name="case"; filename="case.json"',
            b"Content-Type: application/json",
            b"",
            case_json,
            b"--" + boundary,
            b'Content-Disposition: form-data; name="archive"; filename="sample-package.zip"',
            b"Content-Type: application/zip",
            b"",
            archive,
            b"--" + boundary + b"--",
            b"",
        ]
    )
    return post(
        "/api/export-zip",
        body,
        f"multipart/form-data; boundary={boundary.decode('ascii')}",
    )


def local_zip_header(archive: bytes, name: str) -> dict[str, Any]:
    with zipfile.ZipFile(io.BytesIO(archive), "r") as package:
        entry = package.getinfo(name)
        offset = entry.header_offset
        (
            signature,
            version_needed,
            _flags,
            _method,
            _time,
            _date,
            _crc,
            compressed_size,
            file_size,
            name_length,
            extra_length,
        ) = struct.unpack_from("<IHHHHHIIIHH", archive, offset)
    assert signature == 0x04034B50
    extra_start = offset + 30 + name_length
    extra = archive[extra_start:extra_start + extra_length]
    extra_ids: list[int] = []
    cursor = 0
    while cursor + 4 <= len(extra):
        extra_id, size = struct.unpack_from("<HH", extra, cursor)
        extra_ids.append(extra_id)
        cursor += 4 + size
    assert cursor == len(extra)
    return {
        "versionNeeded": version_needed,
        "compressedSize": compressed_size,
        "fileSize": file_size,
        "extraIds": extra_ids,
    }


index_bytes, index_type, index_status = get("/")
app_bytes, app_type, app_status = get("/app.js")
styles_bytes, styles_type, styles_status = get("/styles.css")
codebook_bytes, codebook_type, codebook_status = get("/codebook.json")
bootstrap_bytes, bootstrap_type, bootstrap_status = get("/api/bootstrap")

index = index_bytes.decode("utf-8")
app_source = app_bytes.decode("utf-8")
styles = styles_bytes.decode("utf-8")
codebook = json.loads(codebook_bytes)
bootstrap = json.loads(bootstrap_bytes)
schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
extension_schema = json.loads(EXTENSION_SCHEMA_PATH.read_text(encoding="utf-8"))

fixture = FIXTURE_PATH.read_bytes()
fixture_import, fixture_import_status = import_data_txt(fixture)
fixture_export, fixture_export_type, fixture_export_status = export_tables(
    fixture_import["tables"]
)
assert fixture_import_status == fixture_export_status == 200
assert fixture_export == fixture

sparse_tables = {
    table: fixture_import["tables"][table] if table == "BMSBASE" else []
    for table in schema["tableOrder"]
}
sparse_export, _sparse_export_type, sparse_export_status = export_tables(sparse_tables)
sparse_import, sparse_import_status = import_data_txt(sparse_export)
assert sparse_export_status == sparse_import_status == 200
assert all(len(sparse_import["tables"][table]) == 1 for table in schema["tableOrder"])
for table in schema["tableOrder"]:
    assert list(sparse_import["tables"][table][0]) == schema["fieldOrder"][table]

legacy_validation, legacy_validation_status = post_json_response(
    "/api/validate", {"tables": fixture_import["tables"]}
)
envelope = {
    "schemaVersion": schema["schemaVersion"],
    "formSet": "C",
    "tables": fixture_import["tables"],
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
            }
        ],
    },
}
envelope_validation, envelope_validation_status = post_json_response(
    "/api/validate", envelope
)
case_import, case_import_status = post_json_response("/api/import-case-json", envelope)
unsafe_envelope = json.loads(json.dumps(envelope, ensure_ascii=False))
unsafe_envelope["tables"]["BMSBASE"][0]["BUILDING_NAME"] = '範例"工程\n草稿'
unsafe_case_import, unsafe_case_import_status = post_json_response(
    "/api/import-case-json", unsafe_envelope
)
wrong_version = "1900-01-01"
version_error, version_error_status = post_json_response(
    "/api/validate", {**envelope, "schemaVersion": wrong_version}
)
envelope_export_payload = json.dumps(envelope, ensure_ascii=False).encode("utf-8")
envelope_export, _envelope_export_type, envelope_export_status = post(
    "/api/export", envelope_export_payload, "application/json; charset=utf-8"
)
assert legacy_validation_status == envelope_validation_status == 200
assert legacy_validation["ok"] and envelope_validation["ok"]
assert case_import_status == 200
assert case_import["formSet"] == "C"
assert case_import["extraTables"]["BMSROAD"][0]["ROAD_SEC"] == "範例路"
assert case_import["extraTables"]["C21_3"][0]["Rpt_Seq"] == "001"
assert case_import["extraTables"]["BMELVTR"][0]["ELEV_USE"] == "B"
assert unsafe_case_import_status == 200
assert unsafe_case_import["tables"]["BMSBASE"][0]["BUILDING_NAME"] == '範例"工程\n草稿'
assert not unsafe_case_import["validation"]["ok"]
assert any("雙引號或換行" in error for error in unsafe_case_import["validation"]["errors"])
assert envelope_validation["extraCounts"]["BMSROAD"] == 1
assert version_error_status == 400
assert wrong_version in version_error["error"]
assert schema["schemaVersion"] in version_error["error"]
assert envelope_export_status == 200 and envelope_export == fixture

original_package = package_zip(fixture)
package_import_body, package_import_type, package_import_status = post(
    "/api/import-zip", original_package, "application/zip"
)
package_import = json.loads(package_import_body)
assert package_import_type == "application/json" and package_import_status == 200
assert package_import["package"] == {
    "dataTxtPath": "案件資料/data.txt",
    "entryCount": 3,
}
assert package_import["tables"] == fixture_import["tables"]

unchanged_zip_payload = {
    "schemaVersion": schema["schemaVersion"],
    "formSet": "A",
    "tables": copy.deepcopy(package_import["tables"]),
    "extraTables": {table: [] for table in extension_schema["extraTableOrder"]},
}
unchanged_package, unchanged_package_type, unchanged_package_status = export_zip(
    unchanged_zip_payload, original_package
)
assert unchanged_package_status == 200
assert unchanged_package_type == "application/zip"
assert unchanged_package == original_package

zip_tables = copy.deepcopy(package_import["tables"])
zip_tables["BMSBASE"][0]["BUILDING_NAME"] = "ZIP 更新範例工程"
zip_payload = {
    "schemaVersion": schema["schemaVersion"],
    "formSet": "A",
    "tables": zip_tables,
    "extraTables": {table: [] for table in extension_schema["extraTableOrder"]},
}
expected_zip_data_txt, _expected_type, expected_zip_status = export_tables(zip_tables)
exported_package, exported_package_type, exported_package_status = export_zip(
    zip_payload, original_package
)
assert expected_zip_status == exported_package_status == 200
assert exported_package_type == "application/zip"
with zipfile.ZipFile(io.BytesIO(original_package), "r") as original_archive, zipfile.ZipFile(
    io.BytesIO(exported_package), "r"
) as exported_archive:
    assert exported_archive.namelist() == original_archive.namelist()
    assert exported_archive.comment == original_archive.comment
    assert exported_archive.read("案件資料/data.txt") == expected_zip_data_txt
    for name in ["案件資料/說明.txt", "attachments/drawing.bin"]:
        assert exported_archive.read(name) == original_archive.read(name)
        assert exported_archive.getinfo(name).date_time == original_archive.getinfo(name).date_time
        assert exported_archive.getinfo(name).external_attr == original_archive.getinfo(name).external_attr
    for name in exported_archive.namelist():
        header = local_zip_header(exported_package, name)
        assert header["versionNeeded"] < 45
        assert header["compressedSize"] != 0xFFFFFFFF
        assert header["fileSize"] != 0xFFFFFFFF
        assert 0x0001 not in header["extraIds"]

field_count = sum(len(fields) for fields in bootstrap["fieldOrder"].values())
real_roundtrip: bool | None = None
assert bootstrap["initialCase"] == "blank"
assert bootstrap["sampleLoaded"] is False
assert set(bootstrap["tables"]) == set(schema["tableOrder"])
assert all(bootstrap["tables"][table] == [] for table in schema["tableOrder"])
if DATA_PATH.exists():
    original = DATA_PATH.read_bytes()
    real_import, real_import_status = import_data_txt(original)
    real_export, _real_export_type, real_export_status = export_tables(real_import["tables"])
    assert real_import_status == real_export_status == 200
    real_roundtrip = real_export == original
    assert real_roundtrip
else:
    print("略過根目錄真實 data.txt roundtrip：檔案不存在。")

report = {
    "index": [index_status, index_type],
    "app": [app_status, app_type],
    "styles": [styles_status, styles_type],
    "codebook": [codebook_status, codebook_type, codebook["version"]],
    "bootstrap": [
        bootstrap_status,
        bootstrap_type,
        len(bootstrap["tableOrder"]),
        field_count,
        bootstrap["schemaVersion"],
        bootstrap["initialCase"],
    ],
    "hasBulkButton": "批次表格" in index,
    "hasSampleButton": "下載範例 CSV／XML" in index,
    "hasSearchablePicker": "optionPickerDialog" in index and "optionPickerSearch" in index,
    "hasRecentPicker": "optionPickerRecent" in index and "rememberPickerValue" in app_source,
    "shortOptionsUseNativeSelect": "OPTION_MODAL_THRESHOLD = 5" in app_source and "useModalForOptions" in app_source and "compact-option-select" in app_source,
    "bulkSelectAll": 'id="bulkToggleAllButton"' in index and "toggleAllBulkRows" in app_source and "syncBulkSelectAllButton" in app_source,
    "clearPageWarningModal": 'id="clearCurrentTableButton"' in index and 'id="clearTableDialog"' in index and "clearTableData" in app_source,
    "hasCompactActions": 'id="actionMenu"' in index and 'class="coverage-card"' not in index,
    "hasCollapsibleSections": "sectionStartsOpen" in app_source and 'id="toggleSectionsButton"' in index,
    "rawFieldNamesOptIn": 'id="toggleRawFieldsButton"' in index and "body.show-raw .raw-field" in styles,
    "modalBackdropClose": "closeDialogFromBackdrop" in app_source and 'dialog.dialog' in app_source,
    "bulkChangesPreserved": "bulkDirty" in app_source and "批次修改已自動保留" in app_source,
    "stableScrollbarSpace": "overflow-y: scroll" in styles and styles.count("scrollbar-gutter: stable") >= 2,
    "compactBulkColumns": "bulkColumnClass" in app_source and "minmax(54px, 1fr) 30px" in styles and "min-width: 126px" not in styles,
    "hasParcelCopyButton": "一鍵帶入本次地號" in app_source,
    "hasStairCopyButton": "一鍵帶入本次樓層概要" in app_source,
    "pickerHasFixedHeight": "height: min(430px, 52vh)" in styles,
    "legacyDatalistRemoved": "<datalist" not in app_source,
    "legacyCodes": codebook["source"]["bldcodeRows"],
    "officialSections": len(codebook["officialSections"]),
    "fixtureExport": [fixture_export_status, fixture_export_type, len(fixture_export)],
    "fixtureExactRoundtrip": fixture_export == fixture,
    "fixtureSha256": hashlib.sha256(fixture).hexdigest(),
    "sparseCaseCompleteExport": {
        "tables": len(sparse_import["tables"]),
        "fields": sum(len(fields) for fields in schema["fieldOrder"].values()),
        "allTablesHaveCanonicalRecord": all(
            len(sparse_import["tables"][table]) == 1 for table in schema["tableOrder"]
        ),
    },
    "envelopeApi": {
        "legacyValidate": legacy_validation_status,
        "envelopeValidate": envelope_validation_status,
        "versionMismatch": version_error_status,
        "envelopeExportExact": envelope_export == fixture,
        "caseJsonImport": case_import_status,
        "unsafeDraftCaseJsonImport": unsafe_case_import_status,
        "extraRoadRows": len(case_import["extraTables"]["BMSROAD"]),
        "extraC21Rows": len(case_import["extraTables"]["C21_3"]),
        "extraElevatorRows": len(case_import["extraTables"]["BMELVTR"]),
    },
    "zipPackage": {
        "import": package_import_status,
        "export": exported_package_status,
        "dataTxtPath": package_import["package"]["dataTxtPath"],
        "unchangedArchiveByteIdentical": unchanged_package == original_package,
        "smallEntriesUseZip20": True,
        "otherEntriesUnchanged": True,
    },
    "realRoundtrip": real_roundtrip,
    "bootstrapIsBlank": all(not rows for rows in bootstrap["tables"].values()),
}

assert index_status == app_status == styles_status == codebook_status == bootstrap_status == 200
assert report["hasBulkButton"] and report["hasSampleButton"]
assert report["hasSearchablePicker"] and report["hasParcelCopyButton"] and report["hasStairCopyButton"]
assert report["hasRecentPicker"] and report["shortOptionsUseNativeSelect"] and report["hasCompactActions"] and report["hasCollapsibleSections"] and report["rawFieldNamesOptIn"]
assert report["bulkSelectAll"] and report["clearPageWarningModal"]
assert report["modalBackdropClose"] and report["bulkChangesPreserved"] and report["stableScrollbarSpace"]
assert report["compactBulkColumns"]
assert report["pickerHasFixedHeight"] and report["legacyDatalistRemoved"]
assert codebook["source"]["bldcodeRows"] == 22383
assert len(codebook["officialSections"]) == 1626
assert bootstrap["schemaVersion"] == schema["schemaVersion"]
assert bootstrap["tableOrder"] == schema["tableOrder"]
assert bootstrap["fieldOrder"] == schema["fieldOrder"]
assert bootstrap["tableMeta"] == schema["tableMeta"]
assert bootstrap["extraTableOrder"] == extension_schema["extraTableOrder"]
assert bootstrap["extraFieldOrder"] == extension_schema["extraFieldOrder"]
assert bootstrap["extraTableMeta"] == extension_schema["extraTableMeta"]
assert set(bootstrap["extraTables"]) == set(extension_schema["extraTableOrder"])
assert all(not rows for rows in bootstrap["extraTables"].values())
assert report["bootstrapIsBlank"]
assert len(bootstrap["tableOrder"]) == 13 and field_count == 596
copy_pairs = {
    "BMSLAN": [
        ("DIST", "DIST_OLD"), ("SECTION", "SECTION_OLD"), ("ROAD_NO1", "ROAD_NO1_OLD"),
        ("ROAD_NO2", "ROAD_NO2_OLD"), ("TOT_AREA", "TOT_AREA_OLD"), ("USE_AREA", "USE_AREA_OLD"),
        ("USE_CATEGORY_CODE1", "USE_CATEGORY_CODE1_OLD"), ("USE_CATEGORY_CODE2", "USE_CATEGORY_CODE2_OLD"),
    ],
    "BMSSTAIR": [
        ("BUILDING_NO", "BUILDING_NO_OLD"), ("STORY_CODE", "STORY_CODE_OLD"),
        ("USAGE_CODE1", "USAGE_CODE1_OLD"), ("USAGE_CODE1_DESC", "USAGE_CODE1_DESC_OLD"), ("USAGE_CODE1_T", "USAGE_CODE1_OLD_T"),
        ("USAGE_CODE2", "USAGE_CODE2_OLD"), ("USAGE_CODE2_DESC", "USAGE_CODE2_DESC_OLD"), ("USAGE_CODE2_T", "USAGE_CODE2_OLD_T"),
        ("USAGE_CODE3", "USAGE_CODE3_OLD"), ("USAGE_CODE3_DESC", "USAGE_CODE3_DESC_OLD"), ("USAGE_CODE3_T", "USAGE_CODE3_OLD_T"),
        ("STORY_AREA", "STORY_AREA_OLD"), ("STORY_HEIGHT", "STORY_HEIGHT_OLD"),
        ("VERANDA_AREA", "VERANDA_AREA_OLD"), ("TERRACE_AREA", "TERRACE_AREA_OLD"),
    ],
}
for table, pairs in copy_pairs.items():
    fields = set(bootstrap["fieldOrder"][table])
    assert all(source in fields and target in fields for source, target in pairs)

print(json.dumps(report, ensure_ascii=False, indent=2))

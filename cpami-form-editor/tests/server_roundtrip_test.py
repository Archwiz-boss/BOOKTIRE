from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


BASE_URL = "http://127.0.0.1:8765"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT.parent / "data.txt"
SCHEMA_PATH = PROJECT_ROOT / "schema" / "data_txt_schema.json"
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

fixture = FIXTURE_PATH.read_bytes()
fixture_import, fixture_import_status = import_data_txt(fixture)
fixture_export, fixture_export_type, fixture_export_status = export_tables(
    fixture_import["tables"]
)
assert fixture_import_status == fixture_export_status == 200
assert fixture_export == fixture

legacy_validation, legacy_validation_status = post_json_response(
    "/api/validate", {"tables": fixture_import["tables"]}
)
envelope = {
    "schemaVersion": schema["schemaVersion"],
    "formSet": "A",
    "tables": fixture_import["tables"],
}
envelope_validation, envelope_validation_status = post_json_response(
    "/api/validate", envelope
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
assert version_error_status == 400
assert wrong_version in version_error["error"]
assert schema["schemaVersion"] in version_error["error"]
assert envelope_export_status == 200 and envelope_export == fixture

field_count = sum(len(fields) for fields in bootstrap["fieldOrder"].values())
real_roundtrip: bool | None = None
bootstrap_matches_real: bool | None = None
if DATA_PATH.exists():
    assert bootstrap["sampleLoaded"] is True
    original = DATA_PATH.read_bytes()
    real_import, real_import_status = import_data_txt(original)
    real_export, _real_export_type, real_export_status = export_tables(real_import["tables"])
    bootstrap_export, _bootstrap_export_type, bootstrap_export_status = export_tables(
        bootstrap["tables"]
    )
    assert real_import_status == real_export_status == bootstrap_export_status == 200
    real_roundtrip = real_export == original
    bootstrap_matches_real = (
        bootstrap["tables"] == real_import["tables"] and bootstrap_export == original
    )
    assert real_roundtrip and bootstrap_matches_real
else:
    assert bootstrap["sampleLoaded"] is False
    assert set(bootstrap["tables"]) == set(schema["tableOrder"])
    assert all(bootstrap["tables"][table] == [] for table in schema["tableOrder"])
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
        bootstrap["sampleLoaded"],
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
    "envelopeApi": {
        "legacyValidate": legacy_validation_status,
        "envelopeValidate": envelope_validation_status,
        "versionMismatch": version_error_status,
        "envelopeExportExact": envelope_export == fixture,
    },
    "realRoundtrip": real_roundtrip,
    "bootstrapMatchesReal": bootstrap_matches_real,
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
assert isinstance(bootstrap["sampleLoaded"], bool)
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

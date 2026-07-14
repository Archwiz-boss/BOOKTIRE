from __future__ import annotations

import hashlib
import json
import urllib.request
from pathlib import Path


BASE_URL = "http://127.0.0.1:8765"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT.parent / "data.txt"


def get(path: str) -> tuple[bytes, str, int]:
    with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=10) as response:
        return response.read(), response.headers.get_content_type(), response.status


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

payload = json.dumps({"tables": bootstrap["tables"]}, ensure_ascii=False).encode("utf-8")
request = urllib.request.Request(
    f"{BASE_URL}/api/export",
    data=payload,
    method="POST",
    headers={"Content-Type": "application/json; charset=utf-8"},
)
with urllib.request.urlopen(request, timeout=30) as response:
    exported = response.read()
    export_status = response.status
    export_type = response.headers.get_content_type()

original = DATA_PATH.read_bytes()
field_count = sum(len(fields) for fields in bootstrap["fieldOrder"].values())
report = {
    "index": [index_status, index_type],
    "app": [app_status, app_type],
    "styles": [styles_status, styles_type],
    "codebook": [codebook_status, codebook_type, codebook["version"]],
    "bootstrap": [bootstrap_status, bootstrap_type, len(bootstrap["tableOrder"]), field_count],
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
    "export": [export_status, export_type, len(exported)],
    "originalBytes": len(original),
    "exactRoundtrip": original == exported,
    "originalSha256": hashlib.sha256(original).hexdigest(),
    "exportSha256": hashlib.sha256(exported).hexdigest(),
}

assert index_status == app_status == styles_status == codebook_status == bootstrap_status == export_status == 200
assert report["hasBulkButton"] and report["hasSampleButton"]
assert report["hasSearchablePicker"] and report["hasParcelCopyButton"] and report["hasStairCopyButton"]
assert report["hasRecentPicker"] and report["shortOptionsUseNativeSelect"] and report["hasCompactActions"] and report["hasCollapsibleSections"] and report["rawFieldNamesOptIn"]
assert report["bulkSelectAll"] and report["clearPageWarningModal"]
assert report["modalBackdropClose"] and report["bulkChangesPreserved"] and report["stableScrollbarSpace"]
assert report["compactBulkColumns"]
assert report["pickerHasFixedHeight"] and report["legacyDatalistRemoved"]
assert codebook["source"]["bldcodeRows"] == 22383
assert len(codebook["officialSections"]) == 1626
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
assert original == exported

print(json.dumps(report, ensure_ascii=False, indent=2))

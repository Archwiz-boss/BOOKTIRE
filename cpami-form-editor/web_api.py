#!/usr/bin/env python3
"""Transport-free implementations of the editor's API operations.

`server.py`（本機 HTTP 服務）與 `web-demo/`（瀏覽器內的 Pyodide 試用版）都呼叫這裡，
確保 data.txt／ZIP 的格式規則只有一份實作，不會兩套邏輯各自漂移。
本模組不得引入任何 HTTP、伺服器或瀏覽器相依。
"""

from __future__ import annotations

import copy
import io
import json
import zipfile
from pathlib import Path
from typing import Any

import cpami_core as core
from cpami_core import DataTxtError

MAX_BODY = 96 * 1024 * 1024
MAX_ZIP_ENTRIES = 5000
MAX_ZIP_UNCOMPRESSED = 512 * 1024 * 1024
MAX_DATA_TXT = 16 * 1024 * 1024


def empty_case_tables(schema: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    return {table: [] for table in schema["tableOrder"]}


def decode_json_object(raw: bytes) -> dict[str, Any]:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DataTxtError("JSON 格式錯誤。") from exc
    if not isinstance(value, dict):
        raise DataTxtError("JSON 根節點必須是物件。")
    return value


# --------------------------------------------------------------------------- ZIP


def data_txt_zip_entry(archive: zipfile.ZipFile) -> zipfile.ZipInfo:
    entries = archive.infolist()
    if len(entries) > MAX_ZIP_ENTRIES:
        raise DataTxtError(f"ZIP 檔案項目超過 {MAX_ZIP_ENTRIES:,} 筆，為避免異常展開已拒絕載入。")
    if sum(entry.file_size for entry in entries) > MAX_ZIP_UNCOMPRESSED:
        raise DataTxtError("ZIP 解壓縮後的總大小超過 512 MB。")
    if any(entry.flag_bits & 0x1 for entry in entries):
        raise DataTxtError("不支援加密的 ZIP 檔案。")
    matches = [
        entry
        for entry in entries
        if not entry.is_dir() and Path(entry.filename.replace("\\", "/")).name.lower() == "data.txt"
    ]
    if not matches:
        raise DataTxtError("ZIP 內找不到 data.txt。")
    if len(matches) > 1:
        paths = "、".join(entry.filename for entry in matches[:5])
        raise DataTxtError(f"ZIP 內有多個 data.txt，無法判斷應使用哪一個：{paths}")
    if matches[0].file_size > MAX_DATA_TXT:
        raise DataTxtError("ZIP 內的 data.txt 超過 16 MB。")
    return matches[0]


def import_zip_package(raw: bytes) -> tuple[bytes, dict[str, Any]]:
    try:
        with zipfile.ZipFile(io.BytesIO(raw), "r") as archive:
            entry = data_txt_zip_entry(archive)
            with archive.open(entry, "r") as source:
                data_txt = source.read(MAX_DATA_TXT + 1)
            if len(data_txt) > MAX_DATA_TXT:
                raise DataTxtError("ZIP 內的 data.txt 超過 16 MB。")
            return data_txt, {
                "dataTxtPath": entry.filename,
                "entryCount": len(archive.infolist()),
            }
    except (zipfile.BadZipFile, NotImplementedError, RuntimeError) as exc:
        raise DataTxtError(f"ZIP 格式無法讀取：{exc}") from exc


def replace_data_txt_in_zip(raw_zip: bytes, data_txt: bytes) -> tuple[bytes, str]:
    import shutil

    output = io.BytesIO()
    try:
        with zipfile.ZipFile(io.BytesIO(raw_zip), "r") as source_archive:
            target_entry = data_txt_zip_entry(source_archive)
            if source_archive.read(target_entry) == data_txt:
                return raw_zip, target_entry.filename
            with zipfile.ZipFile(output, "w", allowZip64=True) as target_archive:
                target_archive.comment = source_archive.comment
                for entry in source_archive.infolist():
                    if entry is target_entry:
                        target_archive.writestr(entry, data_txt)
                        continue
                    if entry.is_dir():
                        target_archive.writestr(entry, b"")
                        continue
                    # 舊二維匯入器會拒絕小檔案被標成 ZIP64（錯誤 517）。
                    with source_archive.open(entry, "r") as source, target_archive.open(
                        entry, "w"
                    ) as target:
                        shutil.copyfileobj(source, target, length=1024 * 1024)
        return output.getvalue(), target_entry.filename
    except (zipfile.BadZipFile, NotImplementedError, RuntimeError) as exc:
        raise DataTxtError(f"ZIP 重新封裝失敗：{exc}") from exc


# --------------------------------------------------------------------- API 操作


def bootstrap(schema: dict[str, Any], template_storage: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "schemaVersion": schema["schemaVersion"],
        "tableOrder": copy.deepcopy(schema["tableOrder"]),
        "fieldOrder": copy.deepcopy(schema["fieldOrder"]),
        "tableMeta": copy.deepcopy(schema["tableMeta"]),
        "extraTableOrder": copy.deepcopy(schema.get("extraTableOrder", [])),
        "extraFieldOrder": copy.deepcopy(schema.get("extraFieldOrder", {})),
        "extraTableMeta": copy.deepcopy(schema.get("extraTableMeta", {})),
        "tables": empty_case_tables(schema),
        "extraTables": {table: [] for table in schema.get("extraTableOrder", [])},
        "initialCase": "blank",
        "sampleLoaded": False,
        "templateStorage": template_storage or {"enabled": False, "mode": "none", "kinds": []},
    }


def _imported_payload(data_txt: bytes, schema: dict[str, Any]) -> dict[str, Any]:
    parsed = core.parse_data_txt_bytes(data_txt)
    core.assert_parsed_matches_schema(parsed, schema)
    prepared = core.prepare_payload({"tables": parsed["tables"]}, schema, fill_defaults=False)
    return {
        "tables": prepared,
        "extraTables": {table: [] for table in schema.get("extraTableOrder", [])},
        "validation": core.validate_tables(prepared, schema),
    }


def import_data_txt(raw: bytes, schema: dict[str, Any]) -> dict[str, Any]:
    return _imported_payload(raw, schema)


def import_zip(raw: bytes, schema: dict[str, Any]) -> dict[str, Any]:
    data_txt, package = import_zip_package(raw)
    return {**_imported_payload(data_txt, schema), "package": package}


def import_case_json(payload: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    envelope = core.prepare_case_envelope(
        payload, schema, fill_defaults=False, allow_data_txt_unsafe=True
    )
    return {**envelope, "validation": core.validate_case_envelope(envelope, schema)}


def validate(payload: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    envelope = core.prepare_case_envelope(
        payload, schema, fill_defaults=False, allow_data_txt_unsafe=True
    )
    return core.validate_case_envelope(envelope, schema)


def export_data_txt(payload: dict[str, Any], schema: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
    """回傳 (CP950 位元組, 驗證結果)；驗證有 errors 時位元組為空。"""
    tables = core.parse_envelope(payload, schema)
    prepared = core.prepare_payload({"tables": tables}, schema, fill_defaults=True)
    validation = core.validate_tables(prepared, schema)
    if validation["errors"]:
        return b"", validation
    return core.serialize_tables(prepared, schema), validation


def export_zip(
    case: dict[str, Any], archive: bytes, schema: dict[str, Any]
) -> tuple[bytes, dict[str, Any], str]:
    """回傳 (ZIP 位元組, 驗證結果, data.txt 在 ZIP 內的路徑)。"""
    data_txt, validation = export_data_txt(case, schema)
    if validation["errors"]:
        return b"", validation, ""
    raw, data_txt_path = replace_data_txt_in_zip(archive, data_txt)
    return raw, validation, data_txt_path

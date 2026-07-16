#!/usr/bin/env python3
"""Local HTTP shell for the CPAMI data.txt editor."""

from __future__ import annotations

import argparse
import copy
import io
import ipaddress
import json
import secrets
import shutil
import socket
import zipfile
from email import policy
from email.parser import BytesParser
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import cpami_core as core
from cpami_core import DataTxtError


APP_ROOT = Path(__file__).resolve().parent
WEB_ROOT = APP_ROOT / "web"
SCHEMA_PATH = APP_ROOT / "schema" / "data_txt_schema.json"
DEFAULT_HOST = "0.0.0.0"
MAX_BODY = 96 * 1024 * 1024
MAX_ZIP_ENTRIES = 5000
MAX_ZIP_UNCOMPRESSED = 512 * 1024 * 1024
MAX_DATA_TXT = 16 * 1024 * 1024
TRUSTED_CLIENT_NETWORKS = tuple(
    ipaddress.ip_network(cidr)
    for cidr in (
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "fc00::/7",
        "fe80::/10",
    )
)


def empty_case_tables(schema: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    return {table: [] for table in schema["tableOrder"]}


SCHEMA = core.load_schema(SCHEMA_PATH)


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


def parse_multipart_parts(raw: bytes, content_type: str) -> dict[str, tuple[bytes, str]]:
    if not content_type.lower().startswith("multipart/form-data"):
        raise DataTxtError("ZIP 匯出請求必須使用 multipart/form-data。")
    message = BytesParser(policy=policy.default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("ascii") + raw
    )
    if not message.is_multipart():
        raise DataTxtError("ZIP 匯出請求格式錯誤。")
    parts: dict[str, tuple[bytes, str]] = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if name:
            parts[name] = (part.get_payload(decode=True) or b"", part.get_filename() or "")
    return parts


def decode_json_object(raw: bytes) -> dict[str, Any]:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DataTxtError("JSON 格式錯誤。") from exc
    if not isinstance(value, dict):
        raise DataTxtError("JSON 根節點必須是物件。")
    return value


def serialize_case_data_txt(payload: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
    tables = core.parse_envelope(payload, SCHEMA)
    prepared = core.prepare_payload({"tables": tables}, SCHEMA, fill_defaults=True)
    validation = core.validate_tables(prepared, SCHEMA)
    if validation["errors"]:
        return b"", validation
    return core.serialize_tables(prepared, SCHEMA), validation


class Handler(SimpleHTTPRequestHandler):
    server_version = "CPAMIFormEditor/1.0"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def client_is_loopback(self) -> bool:
        try:
            return ipaddress.ip_address(self.client_address[0]).is_loopback
        except ValueError:
            return False

    def client_is_trusted_network(self) -> bool:
        try:
            address = ipaddress.ip_address(self.client_address[0])
        except ValueError:
            return False
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        return address.is_loopback or any(
            address.version == network.version and address in network
            for network in TRUSTED_CLIENT_NETWORKS
        )

    def supplied_access_token(self) -> str:
        query = parse_qs(urlparse(self.path).query)
        if query.get("token"):
            return query["token"][0]
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("cpami_access")
        return morsel.value if morsel else ""

    def authorize_request(self) -> bool:
        if self.client_is_trusted_network():
            return True

        expected = getattr(self.server, "access_token", "")
        supplied = self.supplied_access_token()
        if expected and supplied and secrets.compare_digest(expected, supplied):
            parsed = urlparse(self.path)
            if "token" in parse_qs(parsed.query) and self.command == "GET":
                self.send_response(HTTPStatus.SEE_OTHER)
                self.send_header("Location", parsed.path or "/")
                self.send_header(
                    "Set-Cookie",
                    f"cpami_access={expected}; HttpOnly; SameSite=Strict; Path=/",
                )
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return False
            return True

        raw = (
            "非私有內網來源需要啟動視窗顯示的存取權杖。\n"
            "請使用 http://本機IP:8765/?token=... 的完整網址。\n"
        ).encode("utf-8")
        self.send_response(HTTPStatus.FORBIDDEN)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)
        return False

    def send_json(self, data: Any, status: int = 200) -> None:
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def read_body(self) -> bytes:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise DataTxtError("Content-Length 無效。") from exc
        if length <= 0 or length > MAX_BODY:
            raise DataTxtError("上傳內容為空或超過 96 MB。")
        return self.rfile.read(length)

    def read_json(self) -> dict[str, Any]:
        return decode_json_object(self.read_body())

    def template_store(self) -> Any:
        store = getattr(self.server, "template_store", None)
        if store is None:
            raise DataTxtError("目前使用無資料庫模式，未啟用共用範本功能。")
        return store

    def template_id_from_path(self, path: str) -> str:
        prefix = "/api/templates/"
        template_id = path[len(prefix):] if path.startswith(prefix) else ""
        if not template_id or "/" in template_id:
            raise DataTxtError("範本識別碼格式錯誤。")
        return template_id

    def do_GET(self) -> None:
        if not self.authorize_request():
            return
        path = urlparse(self.path).path
        if path == "/api/bootstrap":
            store = getattr(self.server, "template_store", None)
            data = {
                "schemaVersion": SCHEMA["schemaVersion"],
                "tableOrder": copy.deepcopy(SCHEMA["tableOrder"]),
                "fieldOrder": copy.deepcopy(SCHEMA["fieldOrder"]),
                "tableMeta": copy.deepcopy(SCHEMA["tableMeta"]),
                "extraTableOrder": copy.deepcopy(SCHEMA.get("extraTableOrder", [])),
                "extraFieldOrder": copy.deepcopy(SCHEMA.get("extraFieldOrder", {})),
                "extraTableMeta": copy.deepcopy(SCHEMA.get("extraTableMeta", {})),
                "tables": empty_case_tables(SCHEMA),
                "extraTables": {
                    table: [] for table in SCHEMA.get("extraTableOrder", [])
                },
                "initialCase": "blank",
                "sampleLoaded": False,
                "templateStorage": {
                    "enabled": store is not None,
                    "mode": getattr(self.server, "storage_mode", "none"),
                    "kinds": store.kind_catalog() if store is not None else [],
                },
            }
            self.send_json(data)
            return
        if path == "/api/health":
            self.send_json(
                {
                    "ok": True,
                    "initialCase": "blank",
                    "storageMode": getattr(self.server, "storage_mode", "none"),
                }
            )
            return
        if path == "/api/templates":
            query = parse_qs(urlparse(self.path).query)
            template_kind = query.get("kind", [""])[0]
            defaults_only = query.get("defaults", [""])[0] in {"1", "true", "yes"}
            try:
                templates = self.template_store().list_templates(
                    template_kind=template_kind,
                    defaults_only=defaults_only,
                )
                self.send_json({"templates": templates})
            except DataTxtError as exc:
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return
        if path.startswith("/api/templates/"):
            try:
                template = self.template_store().get_template(
                    self.template_id_from_path(path)
                )
                self.send_json({"template": template})
            except DataTxtError as exc:
                self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return
        super().do_GET()

    def do_POST(self) -> None:
        if not self.authorize_request():
            return
        path = urlparse(self.path).path
        try:
            if path == "/api/templates":
                template = self.template_store().create_template(self.read_json())
                self.send_json({"template": template}, status=HTTPStatus.CREATED)
                return

            if path == "/api/import-data-txt":
                parsed = core.parse_data_txt_bytes(self.read_body())
                core.assert_parsed_matches_schema(parsed, SCHEMA)
                prepared = core.prepare_payload(
                    {"tables": parsed["tables"]}, SCHEMA, fill_defaults=False
                )
                self.send_json(
                    {
                        "tables": prepared,
                        "extraTables": {
                            table: [] for table in SCHEMA.get("extraTableOrder", [])
                        },
                        "validation": core.validate_tables(prepared, SCHEMA),
                    }
                )
                return

            if path == "/api/import-zip":
                data_txt, package = import_zip_package(self.read_body())
                parsed = core.parse_data_txt_bytes(data_txt)
                core.assert_parsed_matches_schema(parsed, SCHEMA)
                prepared = core.prepare_payload(
                    {"tables": parsed["tables"]}, SCHEMA, fill_defaults=False
                )
                self.send_json(
                    {
                        "tables": prepared,
                        "extraTables": {
                            table: [] for table in SCHEMA.get("extraTableOrder", [])
                        },
                        "validation": core.validate_tables(prepared, SCHEMA),
                        "package": package,
                    }
                )
                return

            if path == "/api/import-case-json":
                envelope = core.prepare_case_envelope(
                    self.read_json(),
                    SCHEMA,
                    fill_defaults=False,
                    allow_data_txt_unsafe=True,
                )
                self.send_json(
                    {
                        **envelope,
                        "validation": core.validate_case_envelope(envelope, SCHEMA),
                    }
                )
                return

            if path == "/api/validate":
                envelope = core.prepare_case_envelope(
                    self.read_json(),
                    SCHEMA,
                    fill_defaults=False,
                    allow_data_txt_unsafe=True,
                )
                self.send_json(core.validate_case_envelope(envelope, SCHEMA))
                return

            if path == "/api/export":
                raw, validation = serialize_case_data_txt(self.read_json())
                if validation["errors"]:
                    self.send_json(validation, status=HTTPStatus.UNPROCESSABLE_ENTITY)
                    return
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Content-Length", str(len(raw)))
                self.send_header("Content-Disposition", 'attachment; filename="data.txt"')
                self.send_header("X-Content-Encoding", "cp950")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(raw)
                return

            if path == "/api/export-zip":
                parts = parse_multipart_parts(
                    self.read_body(), self.headers.get("Content-Type", "")
                )
                if "case" not in parts or "archive" not in parts:
                    raise DataTxtError("ZIP 匯出請求缺少案件資料或原始 ZIP。")
                data_txt, validation = serialize_case_data_txt(
                    decode_json_object(parts["case"][0])
                )
                if validation["errors"]:
                    self.send_json(validation, status=HTTPStatus.UNPROCESSABLE_ENTITY)
                    return
                raw, _data_txt_path = replace_data_txt_in_zip(parts["archive"][0], data_txt)
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Length", str(len(raw)))
                self.send_header(
                    "Content-Disposition", 'attachment; filename="CPAMI_package.zip"'
                )
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(raw)
                return

            self.send_json({"error": "找不到 API。"}, status=HTTPStatus.NOT_FOUND)
        except DataTxtError as exc:
            self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        except Exception as exc:  # pragma: no cover - surfaced for local diagnosis
            self.send_json({"error": f"伺服器錯誤：{exc}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_PUT(self) -> None:
        if not self.authorize_request():
            return
        path = urlparse(self.path).path
        try:
            if path.startswith("/api/templates/"):
                template = self.template_store().update_template(
                    self.template_id_from_path(path), self.read_json()
                )
                self.send_json({"template": template})
                return
            self.send_json({"error": "找不到 API。"}, status=HTTPStatus.NOT_FOUND)
        except DataTxtError as exc:
            self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        except Exception as exc:  # pragma: no cover - surfaced for local diagnosis
            self.send_json({"error": f"伺服器錯誤：{exc}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_DELETE(self) -> None:
        if not self.authorize_request():
            return
        path = urlparse(self.path).path
        try:
            if path.startswith("/api/templates/"):
                self.template_store().delete_template(self.template_id_from_path(path))
                self.send_json({"ok": True})
                return
            self.send_json({"error": "找不到 API。"}, status=HTTPStatus.NOT_FOUND)
        except DataTxtError as exc:
            self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        except Exception as exc:  # pragma: no cover - surfaced for local diagnosis
            self.send_json({"error": f"伺服器錯誤：{exc}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)


def local_ipv4_addresses() -> list[str]:
    addresses: set[str] = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = info[4][0]
            if not ipaddress.ip_address(address).is_loopback:
                addresses.add(address)
    except OSError:
        pass
    return sorted(addresses)


def host_allows_remote_connections(host: str) -> bool:
    if host in {"0.0.0.0", "::"}:
        return True
    try:
        return not ipaddress.ip_address(host).is_loopback
    except ValueError:
        return host.lower() != "localhost"


def main() -> None:
    parser = argparse.ArgumentParser(description="CPAMI data.txt 本機編輯器")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--access-token",
        default="",
        help="外部連線權杖；未指定時每次啟動自動產生。",
    )
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.access_token = args.access_token or secrets.token_urlsafe(24)  # type: ignore[attr-defined]
    print(f"CPAMI 表單編輯器監聽：{args.host}:{args.port}")
    print(f"本機網址：http://127.0.0.1:{args.port}")
    if host_allows_remote_connections(args.host):
        addresses = local_ipv4_addresses()
        print("內網網址（私有網路來源不需權杖）：")
        if addresses:
            for address in addresses:
                print(f"  http://{address}:{args.port}/")
        else:
            print(f"  http://本機區域網路IP:{args.port}/")
        print("非私有網路來源仍需權杖：")
        print(f"  http://對外網址:{args.port}/?token={server.access_token}")  # type: ignore[attr-defined]
        print("請勿把服務直接暴露到公網；優先使用 VPN 或可信任內網。")
    print(f"格式結構：{SCHEMA_PATH}")
    print("初始案件：空白（data.txt 只在使用者主動選取後載入）")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

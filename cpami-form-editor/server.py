#!/usr/bin/env python3
"""Local HTTP shell for the CPAMI data.txt editor."""

from __future__ import annotations

import argparse
import copy
import ipaddress
import json
import secrets
import socket
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
SAMPLE_PATH = APP_ROOT.parent / "data.txt"
MAX_BODY = 24 * 1024 * 1024


def load_initial_tables(schema: dict[str, Any]) -> tuple[dict[str, list[dict[str, str]]], bool]:
    try:
        raw = SAMPLE_PATH.read_bytes()
    except OSError:
        return {table: [] for table in schema["tableOrder"]}, False
    parsed = core.parse_data_txt_bytes(raw)
    core.assert_parsed_matches_schema(parsed, schema)
    return parsed["tables"], True


SCHEMA = core.load_schema(SCHEMA_PATH)
INITIAL_TABLES, SAMPLE_LOADED = load_initial_tables(SCHEMA)


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

    def supplied_access_token(self) -> str:
        query = parse_qs(urlparse(self.path).query)
        if query.get("token"):
            return query["token"][0]
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get("cpami_access")
        return morsel.value if morsel else ""

    def authorize_request(self) -> bool:
        if self.client_is_loopback():
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
            "外部連線需要啟動視窗顯示的存取權杖。\n"
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
            raise DataTxtError("上傳內容為空或超過 24 MB。")
        return self.rfile.read(length)

    def read_json(self) -> dict[str, Any]:
        try:
            decoded = self.read_body().decode("utf-8")
            value = json.loads(decoded)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise DataTxtError("JSON 格式錯誤。") from exc
        if not isinstance(value, dict):
            raise DataTxtError("JSON 根節點必須是物件。")
        return value

    def do_GET(self) -> None:
        if not self.authorize_request():
            return
        path = urlparse(self.path).path
        if path == "/api/bootstrap":
            data = {
                "schemaVersion": SCHEMA["schemaVersion"],
                "tableOrder": copy.deepcopy(SCHEMA["tableOrder"]),
                "fieldOrder": copy.deepcopy(SCHEMA["fieldOrder"]),
                "tableMeta": copy.deepcopy(SCHEMA["tableMeta"]),
                "tables": copy.deepcopy(INITIAL_TABLES),
                "sampleLoaded": SAMPLE_LOADED,
            }
            self.send_json(data)
            return
        if path == "/api/health":
            self.send_json({"ok": True, "sample": str(SAMPLE_PATH)})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if not self.authorize_request():
            return
        path = urlparse(self.path).path
        try:
            if path == "/api/import-data-txt":
                parsed = core.parse_data_txt_bytes(self.read_body())
                core.assert_parsed_matches_schema(parsed, SCHEMA)
                prepared = core.prepare_payload(
                    {"tables": parsed["tables"]}, SCHEMA, fill_defaults=False
                )
                self.send_json(
                    {
                        "tables": prepared,
                        "validation": core.validate_tables(prepared, SCHEMA),
                    }
                )
                return

            if path == "/api/validate":
                tables = core.parse_envelope(self.read_json(), SCHEMA)
                prepared = core.prepare_payload(
                    {"tables": tables}, SCHEMA, fill_defaults=False
                )
                self.send_json(core.validate_tables(prepared, SCHEMA))
                return

            if path == "/api/export":
                tables = core.parse_envelope(self.read_json(), SCHEMA)
                prepared = core.prepare_payload(
                    {"tables": tables}, SCHEMA, fill_defaults=True
                )
                validation = core.validate_tables(prepared, SCHEMA)
                if validation["errors"]:
                    self.send_json(validation, status=HTTPStatus.UNPROCESSABLE_ENTITY)
                    return
                raw = core.serialize_tables(prepared, SCHEMA)
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Content-Length", str(len(raw)))
                self.send_header("Content-Disposition", 'attachment; filename="data.txt"')
                self.send_header("X-Content-Encoding", "cp950")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(raw)
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
    parser.add_argument("--host", default="127.0.0.1")
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
        print("外部連線需要以下含權杖網址：")
        if addresses:
            for address in addresses:
                print(f"  http://{address}:{args.port}/?token={server.access_token}")  # type: ignore[attr-defined]
        else:
            print(f"  http://本機區域網路IP:{args.port}/?token={server.access_token}")  # type: ignore[attr-defined]
        print("請勿把不含權杖的服務直接暴露到公網。")
    print(f"格式結構：{SCHEMA_PATH}")
    if SAMPLE_LOADED:
        print(f"初始案件：{SAMPLE_PATH}")
    else:
        print("初始案件：未載入（空案件模式）")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

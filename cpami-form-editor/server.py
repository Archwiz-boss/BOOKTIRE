#!/usr/bin/env python3
"""Local CPAMI data.txt editor server.

The browser UI edits JSON, while this server owns the strict CP950 parser and
serializer.  It deliberately uses only Python's standard library so the tool
can run on an offline Windows workstation.
"""

from __future__ import annotations

import argparse
import copy
import ipaddress
import json
import re
import secrets
import socket
from datetime import datetime
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


APP_ROOT = Path(__file__).resolve().parent
WEB_ROOT = APP_ROOT / "web"
SAMPLE_PATH = APP_ROOT.parent / "data.txt"
MAX_BODY = 24 * 1024 * 1024

TABLE_LABELS = {
    "BMSBASE": "案件主檔／申請書總表",
    "BM_TEC": "專業技師",
    "BMSLAN": "基地地號",
    "BMSLANOWNER": "土地所有權人",
    "BMSMEMO": "案件備註",
    "BMSP01": "起造人／棟戶門牌",
    "BMSP02": "設計人",
    "BMSP03": "監造人",
    "BMSP04": "承造人",
    "BMSPARK": "停車空間",
    "BMSSC": "開竣工相容資料",
    "BMSSTAIR": "樓層／用途／面積",
    "BMSWORK": "雜項工作物",
}

REPEATABLE_TABLES = {
    "BM_TEC",
    "BMSLAN",
    "BMSLANOWNER",
    "BMSMEMO",
    "BMSP01",
    "BMSP02",
    "BMSP03",
    "BMSP04",
    "BMSPARK",
    "BMSSTAIR",
    "BMSWORK",
}

SYNC_PAIRS = {
    "BMSBASE": [("USAGE_CODE", "USAGE_CODE_DESC")],
    "BMSMEMO": [("MEMO_SEQ", "MEMO_SEQ_NAME")],
    "BMSP01": [
        ("BLD_CODE1", "BLD_CODE1_DESC"),
        ("BLD_CODE2", "BLD_CODE2_DESC"),
        ("BLD_CODE3", "BLD_CODE3_DESC"),
    ],
    "BMSSTAIR": [
        ("USAGE_CODE1", "USAGE_CODE1_DESC"),
        ("USAGE_CODE2", "USAGE_CODE2_DESC"),
        ("USAGE_CODE3", "USAGE_CODE3_DESC"),
        ("USAGE_CODE1_OLD", "USAGE_CODE1_DESC_OLD"),
        ("USAGE_CODE2_OLD", "USAGE_CODE2_DESC_OLD"),
        ("USAGE_CODE3_OLD", "USAGE_CODE3_DESC_OLD"),
    ],
}

NUMERIC_FIELDS = {
    "LAW_COVER_RATE",
    "LAW_SPACE_RATE",
    "BASE_AREA_ARC",
    "BASE_AREA_SHRINK",
    "BASE_AREA_OTHER",
    "BASE_AREA_PURPOSE",
    "BASE_AREA_TOTAL",
    "STATUTORY_OPEN_SPACE",
    "BUIL_AREA_ARC",
    "BUIL_AREA_OTHER",
    "BUILDING_HEIGHT",
    "BUILDING_AREA",
    "TOTAL_CONSTRU_AREA",
    "BUILD_COVER_RATE",
    "SPACE_RATE",
    "PRICE",
    "CHWANG_NO",
    "BUILDING_NO",
    "UP_FLOOR_NO",
    "DN_FLOOR_NO",
    "TOT_HOUSE_NO",
    "BUILD_HIHIGHT",
    "AIRRAID_U_AREA",
    "AIRRAID_D_AREA",
    "LAW_AIRRAID_AREA",
    "AIRRAID_P_AREA",
    "OTHERS_PRICE",
    "TOT_AREA",
    "USE_AREA",
    "TOT_AREA_hold",
    "USE_AREA_hold",
    "NUM",
    "AREA",
    "STORY_AREA",
    "STORY_HEIGHT",
    "VERANDA_AREA",
    "TERRACE_AREA",
    "LENGTH",
    "HEIGHT",
    "WIDE",
}

FIELD_RE = re.compile(r'^@(d|m)\s+(\S+)\s+"(.*)"$')
TABLE_RE = re.compile(r"^@TableName\s+(\S+)$")
ROC_DATE_RE = re.compile(r"^\d{7}$")
NUMBER_RE = re.compile(r"^-?(?:\d+(?:\.\d*)?|\.\d+)$")


class DataTxtError(ValueError):
    """Raised when a data.txt file violates the legacy grammar."""


def parse_data_txt_bytes(raw: bytes) -> dict[str, Any]:
    try:
        text = raw.decode("cp950", errors="strict")
    except UnicodeDecodeError as exc:
        raise DataTxtError(
            f"不是有效的 CP950/Big5 data.txt（位元組位置 {exc.start}）。"
        ) from exc

    table_order: list[str] = []
    field_order: dict[str, list[str]] = {}
    tables: dict[str, list[dict[str, str]]] = {}
    current_table: str | None = None
    current_record: dict[str, str] | None = None

    for line_no, line in enumerate(text.splitlines(), start=1):
        if not line:
            continue
        table_match = TABLE_RE.match(line)
        if table_match:
            if current_record is not None:
                raise DataTxtError(f"第 {line_no} 行：上一筆記錄尚未 @RecordEnd。")
            current_table = table_match.group(1)
            if current_table not in tables:
                table_order.append(current_table)
                tables[current_table] = []
                field_order[current_table] = []
            continue
        if line == "@RecordBegin":
            if current_table is None:
                raise DataTxtError(f"第 {line_no} 行：@RecordBegin 前缺少 @TableName。")
            if current_record is not None:
                raise DataTxtError(f"第 {line_no} 行：記錄重複開始。")
            current_record = {}
            continue
        if line == "@RecordEnd":
            if current_table is None or current_record is None:
                raise DataTxtError(f"第 {line_no} 行：找不到對應的 @RecordBegin。")
            tables[current_table].append(current_record)
            current_record = None
            continue
        field_match = FIELD_RE.match(line)
        if field_match:
            if current_table is None or current_record is None:
                raise DataTxtError(f"第 {line_no} 行：欄位不在記錄內。")
            field = field_match.group(2)
            value = field_match.group(3)
            if field in current_record:
                raise DataTxtError(f"第 {line_no} 行：欄位 {field} 重複。")
            current_record[field] = value
            if field not in field_order[current_table]:
                field_order[current_table].append(field)
            continue
        raise DataTxtError(f"第 {line_no} 行無法辨識：{line[:80]}")

    if current_record is not None:
        raise DataTxtError("檔案結尾前缺少 @RecordEnd。")
    if not table_order:
        raise DataTxtError("找不到任何 @TableName。")

    return {
        "tableOrder": table_order,
        "fieldOrder": field_order,
        "tables": tables,
    }


def load_template() -> dict[str, Any]:
    if not SAMPLE_PATH.exists():
        raise RuntimeError(f"找不到格式模板：{SAMPLE_PATH}")
    parsed = parse_data_txt_bytes(SAMPLE_PATH.read_bytes())
    parsed["tableMeta"] = {
        table: {
            "label": TABLE_LABELS.get(table, table),
            "repeatable": table in REPEATABLE_TABLES,
        }
        for table in parsed["tableOrder"]
    }
    return parsed


TEMPLATE = load_template()


def roc_now() -> tuple[str, str]:
    now = datetime.now()
    year = now.year - 1911
    date_text = f"{year:03d}{now:%m%d}"
    key = f"{year:03d}{now:%m%d%H%M%S}"
    return date_text, key


def prepare_payload(payload: dict[str, Any], *, fill_defaults: bool) -> dict[str, list[dict[str, str]]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("tables"), dict):
        raise DataTxtError("JSON 必須包含 tables 物件。")

    incoming = payload["tables"]
    result: dict[str, list[dict[str, str]]] = {}
    _today, generated_key = roc_now()
    base_rows = incoming.get("BMSBASE") or []
    key = ""
    if isinstance(base_rows, list) and base_rows and isinstance(base_rows[0], dict):
        key = str(base_rows[0].get("INDEX_KEY", "")).strip()
    if fill_defaults and not key:
        key = generated_key

    for table in TEMPLATE["tableOrder"]:
        rows = incoming.get(table, [])
        if rows is None:
            rows = []
        if not isinstance(rows, list):
            raise DataTxtError(f"{table} 必須是記錄陣列。")
        canonical_rows: list[dict[str, str]] = []
        for row_index, row in enumerate(rows, start=1):
            if not isinstance(row, dict):
                raise DataTxtError(f"{table} 第 {row_index} 筆不是物件。")
            canonical: dict[str, str] = {}
            for field in TEMPLATE["fieldOrder"][table]:
                raw_value = row.get(field, "")
                value = "" if raw_value is None else str(raw_value)
                if '"' in value or "\r" in value or "\n" in value:
                    raise DataTxtError(
                        f"{table} 第 {row_index} 筆 {field} 含雙引號或換行，舊格式沒有可靠跳脫規則。"
                    )
                canonical[field] = value
            if fill_defaults:
                if "INDEX_KEY" in canonical:
                    canonical["INDEX_KEY"] = key
                if "person_seq" in canonical and not canonical["person_seq"].strip():
                    canonical["person_seq"] = str(row_index)
                if "PERSON_SEQ" in canonical and not canonical["PERSON_SEQ"].strip():
                    canonical["PERSON_SEQ"] = str(row_index)
                if "SPOKESMAN" in canonical and not canonical["SPOKESMAN"].strip():
                    canonical["SPOKESMAN"] = "Y" if row_index == 1 else "N"
            canonical_rows.append(canonical)
        result[table] = canonical_rows
    return result


def validate_tables(tables: dict[str, list[dict[str, str]]]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    base_rows = tables.get("BMSBASE", [])
    if len(base_rows) != 1:
        errors.append(f"BMSBASE 必須剛好 1 筆，目前為 {len(base_rows)} 筆。")
    else:
        base = base_rows[0]
        for field, label in (
            ("INDEX_KEY", "案件主鍵"),
            ("BMPAS", "縣市代碼"),
            ("BUILDING_NAME", "工程名稱"),
            ("APPLY_TYPE", "申請類型"),
        ):
            if not base.get(field, "").strip():
                errors.append(f"BMSBASE.{field}（{label}）不可空白。")

    expected_key = base_rows[0].get("INDEX_KEY", "") if base_rows else ""
    for table, rows in tables.items():
        seen_seq: set[str] = set()
        for row_index, row in enumerate(rows, start=1):
            prefix = f"{table} 第 {row_index} 筆"
            if expected_key and row.get("INDEX_KEY", "") != expected_key:
                errors.append(f"{prefix} INDEX_KEY 與 BMSBASE 不一致。")
            sequence = row.get(
                "person_seq", row.get("Person_seq", row.get("PERSON_SEQ", ""))
            ).strip()
            if table in REPEATABLE_TABLES:
                if not sequence:
                    warnings.append(f"{prefix} 缺少 PERSON_SEQ；匯出時會依列序補值。")
                elif sequence in seen_seq:
                    errors.append(f"{table} 的 PERSON_SEQ={sequence} 重複。")
                seen_seq.add(sequence)

            for field, value in row.items():
                if not value:
                    continue
                upper = field.upper()
                if (upper.endswith("_DATE") or upper in {"CR_DATE", "UP_DATE", "BIRTH_DATE"}) and not ROC_DATE_RE.fullmatch(value):
                    warnings.append(f"{prefix} {field} 建議使用民國 yyyMMdd 7 碼，目前為「{value}」。")
                base_field = re.sub(r"_(?:OLD|TEAR)$", "", field, flags=re.IGNORECASE)
                numeric_here = base_field in NUMERIC_FIELDS
                # BUILDING_NO is numeric only in the one-row BMSBASE table.  In
                # BMSP01/BMSSTAIR it is a user-facing building label such as A1.
                if base_field == "BUILDING_NO" and table != "BMSBASE":
                    numeric_here = False
                if numeric_here and not NUMBER_RE.fullmatch(value):
                    errors.append(f"{prefix} {field} 應為純數字，不含單位或千分位：{value}")
                try:
                    value.encode("cp950", errors="strict")
                except UnicodeEncodeError as exc:
                    bad = value[exc.start : exc.end]
                    errors.append(f"{prefix} {field} 含 CP950 無法表示的字元「{bad}」。")

            for code_field, desc_field in SYNC_PAIRS.get(table, []):
                if row.get(code_field, "").strip() and not row.get(desc_field, "").strip():
                    warnings.append(f"{prefix} 已填 {code_field}，但 {desc_field} 空白；報表可能沒有顯示文字。")

    counts = {table: len(rows) for table, rows in tables.items()}
    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "counts": counts,
    }


def serialize_tables(tables: dict[str, list[dict[str, str]]]) -> bytes:
    lines: list[str] = []
    for table in TEMPLATE["tableOrder"]:
        lines.append(f"@TableName {table}")
        for row in tables.get(table, []):
            lines.append("@RecordBegin")
            for field in TEMPLATE["fieldOrder"][table]:
                lines.append(f'@d {field} "{row.get(field, "")}"')
            lines.append("@RecordEnd")
    text = "\r\n".join(lines) + "\r\n"
    try:
        return text.encode("cp950", errors="strict")
    except UnicodeEncodeError as exc:
        bad = text[exc.start : exc.end]
        raise DataTxtError(f"含 CP950 無法表示的字元「{bad}」。") from exc


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
            data = copy.deepcopy(TEMPLATE)
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
                parsed = parse_data_txt_bytes(self.read_body())
                expected = TEMPLATE["tableOrder"]
                if parsed["tableOrder"] != expected:
                    raise DataTxtError(
                        "資料表順序／集合與模板不同；需要 13 表：" + ", ".join(expected)
                    )
                for table in expected:
                    if parsed["fieldOrder"].get(table) != TEMPLATE["fieldOrder"][table]:
                        raise DataTxtError(f"{table} 欄位集合或順序與模板不一致。")
                prepared = prepare_payload({"tables": parsed["tables"]}, fill_defaults=False)
                self.send_json({"tables": prepared, "validation": validate_tables(prepared)})
                return

            if path == "/api/validate":
                prepared = prepare_payload(self.read_json(), fill_defaults=False)
                self.send_json(validate_tables(prepared))
                return

            if path == "/api/export":
                prepared = prepare_payload(self.read_json(), fill_defaults=True)
                validation = validate_tables(prepared)
                if validation["errors"]:
                    self.send_json(validation, status=HTTPStatus.UNPROCESSABLE_ENTITY)
                    return
                raw = serialize_tables(prepared)
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
    print(f"格式模板：{SAMPLE_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

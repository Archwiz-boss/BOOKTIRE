#!/usr/bin/env python3
"""Optional SQLite template-library mode for the CPAMI editor."""

from __future__ import annotations

import argparse
import secrets
from http.server import ThreadingHTTPServer
from pathlib import Path

import server as base
from sqlite_templates import SQLiteTemplateStore


DEFAULT_DATABASE = base.APP_ROOT.parent / "runtime" / "sqlite" / "cpami_templates.db"


def main() -> None:
    parser = argparse.ArgumentParser(description="CPAMI 編輯器（SQLite 共用範本模式）")
    parser.add_argument("--host", default=base.DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--access-token", default="")
    args = parser.parse_args()

    template_store = SQLiteTemplateStore(args.database, base.SCHEMA["schemaVersion"])
    http_server = ThreadingHTTPServer((args.host, args.port), base.Handler)
    http_server.access_token = args.access_token or secrets.token_urlsafe(24)  # type: ignore[attr-defined]
    http_server.template_store = template_store  # type: ignore[attr-defined]
    http_server.storage_mode = "sqlite-templates"  # type: ignore[attr-defined]

    print(f"CPAMI SQLite 範本模式監聽：{args.host}:{args.port}")
    print(f"本機網址：http://127.0.0.1:{args.port}")
    if base.host_allows_remote_connections(args.host):
        addresses = base.local_ipv4_addresses()
        print("內網網址（私有網路來源不需權杖）：")
        if addresses:
            for address in addresses:
                print(f"  http://{address}:{args.port}/")
        else:
            print(f"  http://本機區域網路IP:{args.port}/")
        print("非私有網路來源仍需權杖：")
        print(f"  http://對外網址:{args.port}/?token={http_server.access_token}")  # type: ignore[attr-defined]
    print(f"共用範本資料庫：{template_store.database_path}")
    print("完整案件不會寫入 SQLite；仍由各瀏覽器匯出 data.txt／ZIP／案件 JSON。")
    try:
        http_server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        http_server.server_close()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""雙擊即用的啟動器：開好本機服務、自動開瀏覽器，並在視窗印出白話操作指引。

與 `server.py` 的差別只在「預設值」與「使用者體驗」，格式邏輯完全共用：
- 預設只綁 127.0.0.1（僅本機），不像 server.py 預設對整個區域網路開放。
- 連接埠被占用時自動往後找可用的，避免使用者看到 WinError 10048 就卡住。
- 例外不讓視窗直接關掉，否則雙擊執行的人看不到任何錯誤訊息。
"""

from __future__ import annotations

import argparse
import errno
import os
import secrets
import sys
import threading
import time
import webbrowser
from http.server import ThreadingHTTPServer


def _configure_console() -> None:
    """Windows 主控台預設是 cp950，印出說明用的框線字元會直接丟 UnicodeEncodeError。"""
    if os.name == "nt":
        try:
            import ctypes

            ctypes.windll.kernel32.SetConsoleOutputCP(65001)
            ctypes.windll.kernel32.SetConsoleCP(65001)
        except Exception:
            pass
    for stream in (sys.stdout, sys.stderr):
        try:
            # line_buffering：輸出被導向檔案時 Python 會改成全緩衝，使用者就看不到
            # 啟動說明了；服務是長時間執行的，訊息必須立刻出現。
            stream.reconfigure(  # type: ignore[union-attr]
                encoding="utf-8", errors="replace", line_buffering=True
            )
        except Exception:
            pass


_configure_console()

import server as base  # noqa: E402  （必須在主控台編碼設定之後，其啟動訊息也含中文）
from app_paths import is_frozen, writable_root  # noqa: E402

DEFAULT_PORT = 8765
PORT_SCAN_LIMIT = 20
LOCAL_ONLY_HOST = "127.0.0.1"
LAN_HOST = "0.0.0.0"


def build_server(host: str, port: int) -> ThreadingHTTPServer:
    """在 port 起算往後找第一個能綁定的連接埠。"""
    last_error: OSError | None = None
    for candidate in range(port, port + PORT_SCAN_LIMIT):
        try:
            return ThreadingHTTPServer((host, candidate), base.Handler)
        except OSError as exc:
            if exc.errno not in {errno.EADDRINUSE, getattr(errno, "WSAEADDRINUSE", 10048)}:
                raise
            last_error = exc
    raise SystemExit(
        f"連接埠 {port}～{port + PORT_SCAN_LIMIT - 1} 都被占用，無法啟動。\n"
        f"請關閉其他佔用的程式，或用 --port 指定其他號碼。（{last_error}）"
    )


def open_browser_later(url: str) -> None:
    def worker() -> None:
        time.sleep(1.2)
        try:
            webbrowser.open(url)
        except Exception:  # pragma: no cover - 開不了瀏覽器不該讓服務死掉
            pass

    threading.Thread(target=worker, daemon=True).start()


def print_banner(
    url: str, host: str, port: int, token: str, sqlite_path: object, sqlite_warning: str
) -> None:
    print("=" * 62)
    print("  CPAMI 建照書表資料編輯器")
    print("=" * 62)
    print()
    print("  服務已啟動，瀏覽器會自動開啟下面這個網址：")
    print()
    print(f"      {url}")
    print()
    if not base.host_allows_remote_connections(host):
        print("  目前只有這台電腦可以連線（其他電腦連不進來，最安全）。")
    else:
        print("  目前同一個區域網路的其他電腦／手機也可以連線：")
        addresses = base.local_ipv4_addresses()
        for address in addresses or ["本機區域網路IP"]:
            print(f"      http://{address}:{port}/")
        print("  非私有網路的來源需要用這個帶權杖的網址：")
        print(f"      http://對外網址:{port}/?token={token}")
        print("  本服務沒有 HTTPS，請勿直接暴露到網際網路，優先走 VPN 或可信內網。")
    print()
    if sqlite_path is not None:
        print("  已啟用「常用資料範本」：起造人、建築師事務所、承造人等重複填寫的")
        print("  欄位可以存起來重複使用，畫面上會出現「共用範本」按鈕。")
        print(f"      {sqlite_path}")
        print("  （只存你主動按儲存的範本，完整案件永遠不會寫進去。）")
        print("  不想在硬碟留下任何東西，可改用 --no-sqlite 啟動。")
        print()
    elif sqlite_warning:
        print(f"  ⚠ {sqlite_warning}")
        print()
    print("  ── 請注意 ──────────────────────────────────────────")
    print("  1. 使用期間請「不要關掉這個黑色視窗」，關掉服務就停了。")
    print("  2. 案件資料只存在瀏覽器分頁裡，改完一定要按「匯出」存檔。")
    print("  3. 要結束時，先在瀏覽器存好檔，再關掉這個視窗即可。")
    print("  ────────────────────────────────────────────────────")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CPAMI 建照書表資料編輯器（雙擊啟動版）",
        epilog=(
            "不加任何參數就是最常用的模式：只給本機使用、自動開瀏覽器、"
            "啟用常用資料範本。"
        ),
    )
    parser.add_argument(
        "--lan",
        action="store_true",
        help="開放同一區域網路的其他電腦／手機連線（預設只有本機可用）。",
    )
    parser.add_argument("--host", default="", help="自行指定監聽位址，會覆蓋 --lan。")
    parser.add_argument("--port", type=int, default=0, help=f"自行指定連接埠（預設 {DEFAULT_PORT}）。")
    parser.add_argument(
        "--sqlite",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="常用資料範本（預設啟用）。--no-sqlite 可關閉，關閉後完全不寫入硬碟。",
    )
    parser.add_argument("--no-browser", action="store_true", help="啟動後不要自動開瀏覽器。")
    parser.add_argument("--access-token", default="", help="外部連線權杖；未指定時每次啟動自動產生。")
    args = parser.parse_args()

    host = args.host or (LAN_HOST if args.lan else LOCAL_ONLY_HOST)
    port = args.port or DEFAULT_PORT

    template_store = None
    sqlite_path: object = None
    sqlite_warning = ""
    if args.sqlite:
        # exe 可能被放在 Program Files、唯讀網路磁碟或光碟上。建不出資料庫時
        # 只能降級成不儲存的模式，不可以讓整個編輯器開不起來。
        try:
            from sqlite_templates import SQLiteTemplateStore

            database = writable_root() / "runtime" / "sqlite" / "cpami_templates.db"
            template_store = SQLiteTemplateStore(database, base.SCHEMA["schemaVersion"])
            sqlite_path = template_store.database_path
        except Exception as exc:  # noqa: BLE001 - 降級是刻意的，任何原因都不該中斷啟動
            template_store = None
            sqlite_path = None
            sqlite_warning = (
                f"無法在這個位置建立常用資料範本（{type(exc).__name__}: {exc}）。\n"
                "    編輯器仍可正常使用，只是這次不會儲存範本。\n"
                "    把程式複製到「文件」或桌面等可寫入的資料夾就能啟用。"
            )

    server = build_server(host, port)
    actual_port = server.server_address[1]
    token = args.access_token or secrets.token_urlsafe(24)
    server.access_token = token  # type: ignore[attr-defined]
    if template_store is not None:
        server.template_store = template_store  # type: ignore[attr-defined]
        server.storage_mode = "sqlite-templates"  # type: ignore[attr-defined]

    url = f"http://{LOCAL_ONLY_HOST}:{actual_port}/"
    print_banner(url, host, actual_port, token, sqlite_path, sqlite_warning)
    if not args.no_browser:
        open_browser_later(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服務已停止。")
    finally:
        server.server_close()


def run() -> None:
    """凍結成 exe 後的進入點：任何錯誤都要留在畫面上讓使用者看得到。"""
    try:
        main()
    except SystemExit as exc:
        if exc.code not in (None, 0):
            print(f"\n{exc}")
            _pause_if_frozen()
        raise
    except Exception as exc:  # pragma: no cover - 雙擊執行時唯一的錯誤出口
        print("\n啟動失敗：")
        print(f"  {type(exc).__name__}: {exc}")
        print("\n請把上面這幾行截圖，回報到專案的 GitHub Issues。")
        _pause_if_frozen()
        sys.exit(1)


def _pause_if_frozen() -> None:
    if is_frozen():
        try:
            input("\n按 Enter 鍵關閉這個視窗…")
        except EOFError:
            pass


if __name__ == "__main__":
    run()

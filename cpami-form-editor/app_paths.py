#!/usr/bin/env python3
"""Resource and writable-data locations for both source and frozen (.exe) runs."""

from __future__ import annotations

import sys
from pathlib import Path


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def _bundle_root() -> Path:
    # PyInstaller onefile 把附帶資料解壓到 sys._MEIPASS；此時 __file__ 位於暫存目錄，
    # 不能用來推導專案根目錄，也絕不能拿來寫檔（程式結束就被刪除）。
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


#: `web/`、`schema/` 等唯讀資源的所在目錄。
APP_ROOT = _bundle_root() if is_frozen() else Path(__file__).resolve().parent

#: 原始碼樹的專案根目錄；凍結後改以打包進來的資源根目錄代表，供 `sqlite/schema.sql` 使用。
PROJECT_ROOT = APP_ROOT if is_frozen() else APP_ROOT.parent


def writable_root() -> Path:
    """執行期可寫入的目錄：凍結後放在 exe 旁邊，原始碼執行時放在專案根目錄。"""
    if is_frozen():
        return Path(sys.executable).resolve().parent
    return PROJECT_ROOT

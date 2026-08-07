#!/usr/bin/env python3
"""把線上試用版（GitHub Pages 用的純靜態網站）組裝到 _site/。

試用版沒有自己的前端副本：畫面、代碼庫、格式引擎全部從桌面版原地複製過來，
只額外加上 `web-demo/` 的載入畫面與 fetch 轉接層。因此改桌面版就等於改試用版，
不會出現兩份 app.js 或兩套格式規則各自漂移的情況。

用法：
    python -X utf8 tools/build_demo.py [--output _site]
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
APP_DIR = REPO_ROOT / "cpami-form-editor"
WEB_DIR = APP_DIR / "web"
SCHEMA_DIR = APP_DIR / "schema"
DEMO_DIR = REPO_ROOT / "web-demo"

#: 要在瀏覽器裡執行的 Python 模組。刻意不含 server.py／sqlite_*：
#: 那些是本機服務與資料庫的外殼，試用版用不到，也不該被下載到訪客電腦。
PY_MODULES = ("cpami_core.py", "web_api.py")

DEMO_BANNER = """  <div class="demo-notice">
    <span class="demo-notice-tag">線上試用版</span>
    <span>你開的每一份檔案都<strong>只留在這台電腦的瀏覽器裡</strong>，不會上傳到任何伺服器。</span>
    <a href="https://github.com/Archwiz-boss/BOOKTIRE/releases/latest">下載桌面版（免安裝）</a>
    <a href="https://github.com/Archwiz-boss/BOOKTIRE">原始碼與說明</a>
  </div>
"""


def patch_index(html: str) -> str:
    """加入試用版樣式、提示條，並確保轉接層在 app.js 之前執行。"""
    if "demo-adapter.js" in html:
        raise SystemExit("index.html 看起來已經被改造過，請確認來源是桌面版原檔。")

    before = html
    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        '<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="demo.css">',
        1,
    )
    if html == before:
        raise SystemExit("找不到 styles.css 的 <link>，index.html 結構可能已變動。")

    before = html
    html = re.sub(r"<body>\s*\n", "<body>\n" + DEMO_BANNER, html, count=1)
    if html == before:
        raise SystemExit("找不到 <body>，index.html 結構可能已變動。")

    # 轉接層必須是 app.js 之前的同步 script：app.js 最後一行就會呼叫 bootstrap()。
    before = html
    html = html.replace(
        '<script src="app.js"></script>',
        '<script src="demo-adapter.js"></script>\n  <script src="app.js"></script>',
        1,
    )
    if html == before:
        raise SystemExit("找不到 app.js 的 <script>，index.html 結構可能已變動。")

    return html


def build(output: Path) -> None:
    if not WEB_DIR.is_dir():
        raise SystemExit(f"找不到前端目錄：{WEB_DIR}")

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    copied: list[str] = []
    for item in sorted(WEB_DIR.iterdir()):
        if item.is_file():
            shutil.copy2(item, output / item.name)
            copied.append(item.name)

    (output / "py").mkdir()
    for name in PY_MODULES:
        shutil.copy2(APP_DIR / name, output / "py" / name)

    (output / "schema").mkdir()
    for item in sorted(SCHEMA_DIR.glob("*.json")):
        shutil.copy2(item, output / "schema" / item.name)

    for name in ("demo-adapter.js", "demo.css"):
        shutil.copy2(DEMO_DIR / name, output / name)

    index = output / "index.html"
    index.write_text(patch_index(index.read_text(encoding="utf-8")), encoding="utf-8")

    # GitHub Pages 預設會用 Jekyll 處理，底線開頭的目錄會被吃掉；停用它最保險。
    (output / ".nojekyll").write_text("", encoding="utf-8")

    total = sum(f.stat().st_size for f in output.rglob("*") if f.is_file())
    print(f"已產生 {output}")
    print(f"  前端檔案：{', '.join(copied)}")
    print(f"  Python 模組：{', '.join(PY_MODULES)}")
    print(f"  總大小：{total / 1024 / 1024:.1f} MB")


def main() -> None:
    parser = argparse.ArgumentParser(description="組裝 GitHub Pages 線上試用版")
    parser.add_argument("--output", type=Path, default=REPO_ROOT / "_site")
    args = parser.parse_args()
    build(args.output.resolve())


if __name__ == "__main__":
    sys.exit(main())

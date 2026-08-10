"""診斷一份 data.txt／ZIP 為什麼載不進來，並清點 Big5 造字與重複碼。

用法（在 cpami-form-editor/ 目錄下）：

    python -X utf8 .\\tools\\diagnose_data_txt.py "C:\\路徑\\data.txt"
    python -X utf8 .\\tools\\diagnose_data_txt.py "C:\\路徑\\案件.zip"

會印出檔案內容的片段（含姓名、地址等個資），只在本機看，不要貼到雲端或 issue。
"""

from __future__ import annotations

import argparse
import io
import re
import sys
import zipfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import cpami_core as core  # noqa: E402


CONTEXT_BYTES = 24


def load_bytes(path: Path) -> tuple[bytes, str]:
    raw = path.read_bytes()
    if raw[:2] != b"PK":
        return raw, str(path)
    with zipfile.ZipFile(io.BytesIO(raw), "r") as archive:
        entry = core_zip_entry(archive)
        with archive.open(entry, "r") as source:
            return source.read(), f"{path}!{entry.filename}"


def core_zip_entry(archive: zipfile.ZipFile) -> zipfile.ZipInfo:
    matches = [
        entry
        for entry in archive.infolist()
        if not entry.is_dir()
        and Path(entry.filename.replace("\\", "/")).name.lower() == "data.txt"
    ]
    if not matches:
        names = "、".join(entry.filename for entry in archive.infolist()[:10])
        raise SystemExit(f"ZIP 內找不到 data.txt。項目：{names}")
    if len(matches) > 1:
        raise SystemExit(
            "ZIP 內有多個 data.txt：" + "、".join(entry.filename for entry in matches)
        )
    return matches[0]


def describe_position(raw: bytes, position: int) -> None:
    line_no = raw.count(b"\n", 0, position) + 1
    line_start = raw.rfind(b"\n", 0, position) + 1
    print(f"  位元組位置 {position}（第 {line_no} 行，行內第 {position - line_start + 1} 個位元組）")
    window = raw[max(0, position - CONTEXT_BYTES) : position + CONTEXT_BYTES]
    print(f"  前後位元組：{window.hex(' ')}")
    print(f"  出問題的位元組：{raw[position:position + 2].hex(' ') or '(檔案結尾)'}")
    prefix = raw[line_start:position]
    print(f"  該行到出錯處為止：{prefix.decode('cp950', errors='replace')[-60:]!r}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path, help="data.txt 或含 data.txt 的 ZIP")
    args = parser.parse_args()

    raw, label = load_bytes(args.path)
    print(f"來源：{label}")
    print(f"大小：{len(raw):,} 位元組")

    if raw.startswith(b"\xef\xbb\xbf"):
        print("警告：開頭有 UTF-8 BOM，不是舊系統原始檔。")
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        print("警告：開頭有 UTF-16 BOM，不是舊系統原始檔。")

    print("\n[1] 純 Python cp950（修好之前的行為）")
    try:
        raw.decode("cp950", errors="strict")
        print("  可以解碼。")
    except UnicodeDecodeError as exc:
        print("  解碼失敗：")
        describe_position(raw, exc.start)

    print("\n[2] Windows CP950 語意（含 Big5 造字，修好之後的行為）")
    try:
        text = core.decode_cp950(raw)
        print(f"  可以解碼，共 {len(text):,} 個字元。")
    except UnicodeDecodeError as exc:
        print("  仍然解碼失敗——這不是造字問題：")
        describe_position(raw, exc.start)
        try:
            raw.decode("utf-8")
            print("  整份檔案其實是 UTF-8；請改用舊系統匯出的原始檔。")
        except UnicodeDecodeError:
            print("  也不是 UTF-8；檔案可能已損毀或被截斷。")
        return 1

    eudc = core.eudc_characters(text)
    print(f"\n[3] Big5 造字：{len(eudc)} 種")
    for char in eudc[:20]:
        print(f"  U+{ord(char):04X} ← 位元組 {core.encode_cp950(char).hex(' ')}（{text.count(char)} 處）")

    notes = core.big5_duplicate_notes(raw)
    print(f"\n[4] Big5 重複碼：{len(notes)} 種")
    for note in notes:
        print(f"  {note}")

    print("\n[5] 位元組級 roundtrip")
    print(f"  解碼後再編碼與原檔相同：{core.encode_cp950(text) == raw}")

    print("\n[6] 值裡面的控制字元（多行長文字的來源）")
    #  str.splitlines() 會在這些字元斷行，舊系統的 LongText 卻可能拿它們當內容。
    suspicious = {
        "\r": "CR", "\n": "LF", "\x0b": "VT", "\x0c": "FF",
        "\x1c": "FS", "\x1d": "GS", "\x1e": "RS",
    }
    hits = 0
    for line_no, line in core._logical_lines(text):
        match = core.FIELD_RE.match(line)
        if not match:
            continue
        found = {name for char, name in suspicious.items() if char in match.group(3)}
        if found:
            hits += 1
            if hits <= 10:
                print(f"  第 {line_no} 行 {match.group(2)}：含 {'、'.join(sorted(found))}")
    print(f"  共 {hits} 個欄位的值含控制字元" + ("（皆已可正常解析）" if hits else ""))

    print("\n[7] 以格式引擎完整解析")
    try:
        parsed = core.parse_data_txt_bytes(raw)
    except core.DataTxtError as exc:
        print(f"  解析失敗：{exc}")
        failed_line = re.search(r"第 (\d+) 行", str(exc))
        if failed_line:
            target = int(failed_line.group(1))
            offset = 0
            for _ in range(target - 1):
                nxt = raw.find(b"\r\n", offset)
                if nxt == -1:
                    break
                offset = nxt + 2
            end = raw.find(b"\r\n", offset)
            end = len(raw) if end == -1 else end + 2
            print(f"  第 {target} 行的原始位元組（含行尾）：")
            print(f"    {raw[offset:min(end, offset + 400)].hex(' ')}")
        return 1
    print(f"  表數：{len(parsed['tableOrder'])}")
    print(f"  欄位總數：{sum(len(fields) for fields in parsed['fieldOrder'].values())}")
    schema = core.load_schema(PROJECT_ROOT / "schema" / "data_txt_schema.json")
    try:
        core.assert_parsed_matches_schema(parsed, schema)
        print("  與 13 表 596 欄的模板相符。")
    except core.DataTxtError as exc:
        print(f"  與模板不符：{exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

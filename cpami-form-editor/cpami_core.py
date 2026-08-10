"""內部系統與本機伺服器共用的唯一 CPAMI data.txt 格式引擎。"""

from __future__ import annotations

import base64
import binascii
import codecs
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any


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

# 值可能含真正的換行（舊系統的 LongText／Access memo），所以 DOTALL。
FIELD_RE = re.compile(r'^@(d|m)\s+(\S+)\s+"(.*)"$', re.DOTALL)
FIELD_OPEN_RE = re.compile(r'^@(?:d|m)\s+\S+\s+"')
STRUCTURE_RE = re.compile(r"^@(?:RecordBegin$|RecordEnd$|TableName\s)")
LINE_SPLIT_RE = re.compile(r"(\r\n|\r|\n)")
TABLE_RE = re.compile(r"^@TableName\s+(\S+)$")
ROC_DATE_RE = re.compile(r"^\d{7}$")
NUMBER_RE = re.compile(r"^-?(?:\d+(?:\.\d*)?|\.\d+)$")
POSITIVE_INTEGER_RE = re.compile(r"^[1-9]\d*$")

EXTRA_NUMERIC_FIELDS = {
    "BMSROAD": {"person_seq", "LENGTH", "WIDE"},
    "BMSCHK": {"PERSON_SEQ", "NET_SEQ"},
    "BMSSCRP": {
        "PERSON_SEQ",
        "PAGE_NO",
        "ITEM01",
        "ITEM02",
        "ITEM03",
        "ITEM04",
        "ITEM05",
        "ITEM06",
        "ITEM07",
        "ITEM08",
        "PEO_TECH_DATE",
        "PEO_PLAIN_DATE",
    },
    "RPTPHOTO": {"PERSON_SEQ", "FILE_SIZE"},
    "BMELVTR": {"PERSON_SEQ", "CHECK_YEAR"},
}


class DataTxtError(ValueError):
    """Raised when a data.txt file violates the legacy grammar."""


# ----------------------------------------------------------- CP950 造字相容層
#
# Python 內建的 cp950 codec 只涵蓋標準 Big5 與 ETen 擴充，會直接拒絕 Big5 造字區
# （使用者自定義字／EUDC）。舊系統是 Windows 程式，用的是 Windows 版 CP950，那份
# 對照表把造字區映射到 Unicode 私人使用區；戶政罕用字姓名、罕用地段名稱正是落在
# 這裡，所以舊系統匯出的真實 data.txt 常常帶著 Python 解不開、Windows 卻讀得出來
# 的位元組。少了這層，整份檔案會在第一個造字處被判成「不是有效的 CP950/Big5」。
#
# 下面的演算法已與 Windows CP950（MultiByteToWideChar）逐格核對：Python 解不開的
# 5,968 組雙位元組序列全數相符。解碼與編碼互為反函數，位元組級 roundtrip 不受影響。
_EUDC_TRAIL_BYTES = tuple(range(0x40, 0x7F)) + tuple(range(0xA1, 0xFF))  # 每個前導位元組 157 格
_EUDC_LEAD_RANGES = (
    (0xFA, 0xFE, 0xE000),  # 造字區一
    (0x8E, 0xA0, 0xE311),  # 造字區二
    (0x81, 0x8D, 0xEEB8),  # 造字區三
)


def _build_eudc_maps() -> tuple[dict[bytes, str], dict[str, bytes]]:
    decode_map: dict[bytes, str] = {}

    def register(lead: int, trail: int, code_point: int) -> None:
        sequence = bytes((lead, trail))
        try:
            sequence.decode("cp950")
        except UnicodeDecodeError:
            # 只補 Python 解不開的格；本來就解得開的一律沿用 codec，不改既有行為。
            decode_map[sequence] = chr(code_point)

    for first, last, base in _EUDC_LEAD_RANGES:
        for lead_offset, lead in enumerate(range(first, last + 1)):
            for trail_offset, trail in enumerate(_EUDC_TRAIL_BYTES):
                register(lead, trail, base + lead_offset * 157 + trail_offset)
    # 造字區四自 0xC6A1 起算——0xC6 這列只有後半段算在內，因此不能套上面的通式。
    code_point = 0xF6B1
    for trail in range(0xA1, 0xFF):
        register(0xC6, trail, code_point)
        code_point += 1
    for lead in (0xC7, 0xC8):
        for trail in _EUDC_TRAIL_BYTES:
            register(lead, trail, code_point)
            code_point += 1
    return decode_map, {char: sequence for sequence, char in decode_map.items()}


_EUDC_DECODE, _EUDC_ENCODE = _build_eudc_maps()
_EUDC_ERRORS = "cpami-cp950-eudc"


def _eudc_error_handler(exc: UnicodeError) -> tuple[Any, int]:
    if isinstance(exc, UnicodeDecodeError):
        replacement = _EUDC_DECODE.get(bytes(exc.object[exc.start : exc.start + 2]))
        if replacement is not None:
            return replacement, exc.start + 2
    elif isinstance(exc, UnicodeEncodeError):
        chunk = bytearray()
        for char in exc.object[exc.start : exc.end]:
            sequence = _EUDC_ENCODE.get(char)
            if sequence is None:
                raise exc
            chunk += sequence
        return bytes(chunk), exc.end
    raise exc


codecs.register_error(_EUDC_ERRORS, _eudc_error_handler)


# 舊系統的罕用字（戶政姓名、地名用字）在 Big5 沒有碼位，於是存成造字，另外用
# bldcode 的 `UNC` 碼表記下「造字 ↔ 真正的 Unicode 字」。少了這層，畫面上的
# 「賴厝廍」會變成「賴厝□」。對照取自 bldcode.mdb 的 CODE_TYPE='UNC'（15 列＝
# 1 列說明＋14 筆，其中 U+E020 重複），tests 會拿 web/codebook.json 重新核對。
#
# 能雙向轉換是因為兩個條件同時成立，改動前必須重新驗證（tests 有守）：
#   1. 對照嚴格一對一，沒有一個造字對到兩個字、也沒有兩個造字對到同一個字；
#   2. 這 14 個真實字**本身都無法用 CP950 編碼**——正因如此舊系統才要造字。
#      所以文字裡出現「廍」就只可能來自造字 0xFA76，不會和正規 Big5 字混淆。
UNC_EUDC_TO_UNICODE = {
    "\ue020": "嵵",  # 嵵  Big5 造字 FA60
    "\ue025": "磘",  # 磘  FA65
    "\ue036": "廍",  # 廍  FA76（賴厝廍）
    "\ue03d": "双",  # 双  FA7D
    "\ue046": "烟",  # 烟  FAA8
    "\ue049": "猪",  # 猪  FAAB
    "\ue058": "鷄",  # 鷄  FABA
    "\ue05a": "菓",  # 菓  FABC
    "\ue060": "脚",  # 脚  FAC2
    "\ue065": "舘",  # 舘  FAC7
    "\ue12c": "脇",  # 脇  FBF1
    "\ue1cf": "厦",  # 厦  FCF7
    "\ue206": "芉",  # 芉  FD6F
}
_UNC_TO_UNICODE = str.maketrans(UNC_EUDC_TO_UNICODE)
_UNC_TO_EUDC = str.maketrans({real: pua for pua, real in UNC_EUDC_TO_UNICODE.items()})


def decode_cp950(raw: bytes) -> str:
    """以 Windows CP950 的語意解碼，含 Big5 造字區與官方罕用字對照。"""
    return raw.decode("cp950", errors=_EUDC_ERRORS).translate(_UNC_TO_UNICODE)


def encode_cp950(text: str) -> bytes:
    """decode_cp950 的反函數；罕用字與造字都會還原成原本的 Big5 位元組。"""
    return text.translate(_UNC_TO_EUDC).encode("cp950", errors=_EUDC_ERRORS)


def eudc_characters(text: str) -> list[str]:
    """回傳 text 內出現過的造字，依出現順序去重。"""
    found: dict[str, None] = {}
    for char in text:
        if char in _EUDC_ENCODE:
            found.setdefault(char, None)
    return list(found)


# Big5 有 10 組「重複碼」：同一個字有兩種位元組寫法。CP950 解碼後只編得回其中一種
# （Windows 與 Python 同樣行為，舊系統自己讀寫也會這樣正規化），因此這些位元組無法在
# 匯出時原樣還原。對應關係照舊不動，只在載入時點名，讓使用者知道哪裡的位元組會變。
# tests/core_unit_test.py 會拿實際 codec 重掃一次，確保這張表不隨 Python 版本走鐘。
BIG5_DUPLICATE_SEQUENCES = {
    b"\xa2\xcc": b"\xa4\x51",  # 十
    b"\xa2\xce": b"\xa4\xca",  # 卅
    b"\xf9\xe9": b"\xa2\xa5",  # ╞
    b"\xf9\xea": b"\xa2\xa6",  # ╪
    b"\xf9\xeb": b"\xa2\xa7",  # ╡
    b"\xf9\xf9": b"\xa2\xa4",  # ═
    b"\xf9\xfa": b"\xa2\x7e",  # ╭
    b"\xf9\xfb": b"\xa2\xa1",  # ╮
    b"\xf9\xfc": b"\xa2\xa2",  # ╰
    b"\xf9\xfd": b"\xa2\xa3",  # ╯
}


def big5_duplicate_notes(raw: bytes) -> list[str]:
    """列出 raw 內用到的 Big5 重複碼，以及匯出時會被換成哪一組位元組。"""
    notes: list[str] = []
    for sequence, canonical in BIG5_DUPLICATE_SEQUENCES.items():
        count = raw.count(sequence)
        if not count:
            continue
        notes.append(
            f"「{sequence.decode('cp950')}」在原檔用的是 Big5 重複碼 "
            f"0x{sequence.hex().upper()}（{count} 處）；匯出時會寫成 "
            f"0x{canonical.hex().upper()}，字仍相同但位元組不同。"
        )
    return notes


def _decode_failure_message(raw: bytes, exc: UnicodeDecodeError) -> str:
    """把「位元組位置 N」這種無從下手的訊息，補成看得出病因的診斷。"""
    position = exc.start
    line_no = raw.count(b"\n", 0, position) + 1
    hex_bytes = " ".join(f"0x{byte:02X}" for byte in raw[position : position + 2])
    hint = ""
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        hint = "檔案開頭是 UTF-16 BOM，不是舊系統的 CP950 檔；請改用舊系統匯出的原始檔。"
    elif raw.startswith(b"\xef\xbb\xbf"):
        hint = "檔案開頭是 UTF-8 BOM，不是舊系統的 CP950 檔；請改用舊系統匯出的原始檔。"
    else:
        try:
            raw.decode("utf-8")
        except UnicodeDecodeError:
            if position + 1 >= len(raw):
                hint = "檔案在半個中文字中間就結束了，可能在傳輸或複製時被截斷。"
        else:
            hint = "整份檔案其實是 UTF-8 編碼（可能被記事本另存過）；請改用舊系統匯出的原始檔。"
    message = (
        f"不是有效的 CP950/Big5 data.txt"
        f"（位元組位置 {position}，第 {line_no} 行，位元組 {hex_bytes}）。"
    )
    return f"{message}{hint}" if hint else message


def _logical_lines(text: str) -> list[tuple[int, str]]:
    """把 data.txt 切成邏輯行，回傳 (實體行號, 內容)。

    不能用 str.splitlines()：它還會在 \\x0b、\\x0c、\\x1c–\\x1e、\\x85、U+2028/9 斷行，
    而這些字元在舊系統的 LongText（Access memo）欄位裡是資料的一部分，被當成換行
    就會把一筆 @d 攔腰切斷，整份檔案就以「第 N 行無法辨識」被擋下來。

    LongText 欄位本身也可能含真正的換行（多行的同意書前言、備註），因此結尾少了雙
    引號的 @d／@m 會繼續吃下一行，直到補上結尾。吃進來的換行原樣留在值裡，匯出時
    再原樣寫回，位元組級 roundtrip 不受影響。
    """
    parts = LINE_SPLIT_RE.split(text)
    raw_lines = parts[0::2]
    # separators[i] 是 raw_lines[i] 後面那個行結束符；最後一行沒有。
    separators = parts[1::2] + [""]

    logical: list[tuple[int, str]] = []
    index = 0
    while index < len(raw_lines):
        line = raw_lines[index]
        if FIELD_OPEN_RE.match(line) and not FIELD_RE.match(line):
            merged = line
            cursor = index
            while cursor + 1 < len(raw_lines):
                following = raw_lines[cursor + 1]
                # 遇到下一個結構標記就停手：那代表這一筆是真的壞掉，不是多行值。
                if STRUCTURE_RE.match(following) or FIELD_OPEN_RE.match(following):
                    break
                merged += separators[cursor] + following
                cursor += 1
                if FIELD_RE.match(merged):
                    break
            if FIELD_RE.match(merged):
                logical.append((index + 1, merged))
                index = cursor + 1
                continue
        logical.append((index + 1, line))
        index += 1
    return logical


def parse_data_txt_bytes(raw: bytes) -> dict[str, Any]:
    try:
        text = decode_cp950(raw)
    except UnicodeDecodeError as exc:
        raise DataTxtError(_decode_failure_message(raw, exc)) from exc

    table_order: list[str] = []
    field_order: dict[str, list[str]] = {}
    tables: dict[str, list[dict[str, str]]] = {}
    current_table: str | None = None
    current_record: dict[str, str] | None = None

    for line_no, line in _logical_lines(text):
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
        "byteNotes": big5_duplicate_notes(raw),
    }


def load_schema(path: str | Path) -> dict[str, Any]:
    schema_path = Path(path)
    if not schema_path.exists():
        raise RuntimeError(f"找不到格式結構：{schema_path}")
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"無法讀取格式結構：{schema_path}") from exc

    table_order = schema.get("tableOrder")
    field_order = schema.get("fieldOrder")
    table_meta = schema.get("tableMeta")
    schema_version = schema.get("schemaVersion")
    if (
        not isinstance(schema_version, str)
        or not schema_version
        or not isinstance(table_order, list)
        or not table_order
        or not all(isinstance(table, str) and table for table in table_order)
        or not isinstance(field_order, dict)
        or not isinstance(table_meta, dict)
    ):
        raise RuntimeError(f"格式結構缺少必要欄位：{schema_path}")
    for table in table_order:
        fields = field_order.get(table)
        meta = table_meta.get(table)
        if (
            not isinstance(fields, list)
            or not fields
            or not all(isinstance(field, str) and field for field in fields)
            or not isinstance(meta, dict)
            or not isinstance(meta.get("label"), str)
            or not isinstance(meta.get("repeatable"), bool)
        ):
            raise RuntimeError(f"格式結構中的 {table} 定義無效：{schema_path}")

    extension_path = schema_path.with_name("case_extension_schema.json")
    if extension_path.exists():
        try:
            extension = json.loads(extension_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"無法讀取案件擴充結構：{extension_path}") from exc
        if extension.get("schemaVersion") != schema_version:
            raise RuntimeError(
                f"案件擴充結構版本不相符：{extension.get('schemaVersion')} != {schema_version}"
            )
        extra_order = extension.get("extraTableOrder")
        extra_fields = extension.get("extraFieldOrder")
        extra_meta = extension.get("extraTableMeta")
        if (
            not isinstance(extra_order, list)
            or not all(isinstance(table, str) and table for table in extra_order)
            or not isinstance(extra_fields, dict)
            or not isinstance(extra_meta, dict)
        ):
            raise RuntimeError(f"案件擴充結構缺少必要欄位：{extension_path}")
        for table in extra_order:
            fields = extra_fields.get(table)
            meta = extra_meta.get(table)
            if (
                not isinstance(fields, list)
                or not fields
                or len(fields) != len(set(fields))
                or not all(isinstance(field, str) and field for field in fields)
                or not isinstance(meta, dict)
                or not isinstance(meta.get("label"), str)
                or not isinstance(meta.get("repeatable"), bool)
            ):
                raise RuntimeError(f"案件擴充結構中的 {table} 定義無效：{extension_path}")
        schema.update(
            {
                "extraTableOrder": extra_order,
                "extraFieldOrder": extra_fields,
                "extraTableMeta": extra_meta,
            }
        )
    else:
        schema.update(
            {"extraTableOrder": [], "extraFieldOrder": {}, "extraTableMeta": {}}
        )
    return schema


def assert_parsed_matches_schema(parsed: dict[str, Any], schema: dict[str, Any]) -> None:
    """檢查一份 data.txt 認不認得，但不要求它剛好是模板的 13 表。

    模板是從單一份範例檔萃取出來的，真實的舊系統會依案件內容增減表：沒填監造人就
    不輸出 BMSP03，有昇降設備就多一張 BMELVTR，二維條碼封包還會帶 BDMLIST／BDMSIGN
    等圖說與簽章表。硬要求 13 表會讓這些真實案件整份開不了，所以這裡只確認：

    * BMSBASE 一定要在（沒有它就不是 CPAMI 案件）；
    * 檔案與模板都有的表，欄位集合與順序必須完全一致（那才是真正的契約）。

    模板有、檔案沒有的表不補；檔案有、模板沒有的表由呼叫端原樣保留（passthrough），
    匯出時依原順序寫回。表的取捨與順序一律以原檔為準——匯出的檔案還要能匯回舊系統，
    不能多也不能少。
    """
    if "BMSBASE" not in parsed["tableOrder"]:
        raise DataTxtError(
            "找不到 BMSBASE 案件主檔；這不是 CPAMI 的 data.txt。"
            "（檔案內的表：" + ", ".join(parsed["tableOrder"][:20]) + "）"
        )
    for table in parsed["tableOrder"]:
        expected_fields = schema["fieldOrder"].get(table)
        if expected_fields is None:
            continue  # 模板沒有的表，原樣保留，不比對欄位
        if parsed["fieldOrder"].get(table) != expected_fields:
            raise DataTxtError(f"{table} 欄位集合或順序與格式結構不一致。")


def document_layout(parsed: dict[str, Any]) -> dict[str, Any]:
    """原檔的版面：表順序與各表欄序。匯出時照這個寫回，才不會多表或少表。"""
    return {
        "tableOrder": list(parsed["tableOrder"]),
        "fieldOrder": {table: list(fields) for table, fields in parsed["fieldOrder"].items()},
    }


def passthrough_tables(
    parsed: dict[str, Any], schema: dict[str, Any]
) -> dict[str, list[dict[str, str]]]:
    """編輯器沒有建模的表（BDMLIST 圖說清單、BDMSIGN 電子簽章等）原封不動帶著走。"""
    return {
        table: [dict(row) for row in parsed["tables"][table]]
        for table in parsed["tableOrder"]
        if table not in schema["fieldOrder"]
    }


def parse_document_layout(value: Any, schema: dict[str, Any]) -> dict[str, Any] | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise DataTxtError("documentLayout 必須是物件。")
    table_order = value.get("tableOrder")
    field_order = value.get("fieldOrder")
    if not isinstance(table_order, list) or not table_order:
        raise DataTxtError("documentLayout.tableOrder 必須是非空陣列。")
    if not all(isinstance(table, str) and table for table in table_order):
        raise DataTxtError("documentLayout.tableOrder 只能是表名字串。")
    if len(set(table_order)) != len(table_order):
        raise DataTxtError("documentLayout.tableOrder 有重複的表名。")
    if not isinstance(field_order, dict):
        raise DataTxtError("documentLayout.fieldOrder 必須是物件。")
    layout_fields: dict[str, list[str]] = {}
    for table in table_order:
        fields = field_order.get(table)
        if not isinstance(fields, list) or not fields:
            raise DataTxtError(f"documentLayout.fieldOrder 缺少 {table} 的欄序。")
        if not all(isinstance(field, str) and field for field in fields):
            raise DataTxtError(f"documentLayout.fieldOrder.{table} 只能是欄名字串。")
        expected_fields = schema["fieldOrder"].get(table)
        if expected_fields is not None and fields != expected_fields:
            raise DataTxtError(f"{table} 欄位集合或順序與格式結構不一致。")
        layout_fields[table] = list(fields)
    return {"tableOrder": list(table_order), "fieldOrder": layout_fields}


def parse_passthrough_tables(
    value: Any, layout: dict[str, Any] | None, schema: dict[str, Any]
) -> dict[str, list[dict[str, str]]]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise DataTxtError("passthroughTables 必須是物件。")
    known = set(layout["tableOrder"]) if layout else set()
    result: dict[str, list[dict[str, str]]] = {}
    for table, rows in value.items():
        if table in schema["fieldOrder"]:
            raise DataTxtError(f"{table} 是編輯器自己的表，不該放在 passthroughTables。")
        if layout is not None and table not in known:
            raise DataTxtError(f"passthroughTables 的 {table} 不在 documentLayout.tableOrder 內。")
        if not isinstance(rows, list):
            raise DataTxtError(f"passthroughTables.{table} 必須是記錄陣列。")
        canonical_rows: list[dict[str, str]] = []
        for row_index, row in enumerate(rows, start=1):
            if not isinstance(row, dict):
                raise DataTxtError(f"passthroughTables.{table} 第 {row_index} 筆不是物件。")
            canonical_rows.append(
                {
                    str(field): "" if row_value is None else str(row_value)
                    for field, row_value in row.items()
                }
            )
        result[table] = canonical_rows
    return result


def parse_case_envelope(
    payload_dict: dict[str, Any], schema: dict[str, Any]
) -> dict[str, Any]:
    if not isinstance(payload_dict, dict) or not isinstance(payload_dict.get("tables"), dict):
        raise DataTxtError("JSON 必須包含 tables 物件。")

    expected_version = schema["schemaVersion"]
    supplied_version = payload_dict.get("schemaVersion", expected_version)
    if supplied_version != expected_version:
        raise DataTxtError(
            f"schemaVersion 不相符：案件為 {supplied_version}，伺服器為 {expected_version}。"
        )
    form_set = payload_dict.get("formSet", "A")
    if not isinstance(form_set, str) or not form_set:
        raise DataTxtError("formSet 必須是非空字串。")
    extra_tables = payload_dict.get("extraTables", {})
    if extra_tables is None:
        extra_tables = {}
    if not isinstance(extra_tables, dict):
        raise DataTxtError("extraTables 必須是物件。")
    layout = parse_document_layout(payload_dict.get("documentLayout"), schema)
    return {
        "schemaVersion": expected_version,
        "formSet": form_set,
        "tables": payload_dict["tables"],
        "extraTables": extra_tables,
        "documentLayout": layout,
        "passthroughTables": parse_passthrough_tables(
            payload_dict.get("passthroughTables"), layout, schema
        ),
    }


def parse_envelope(payload_dict: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    """Parse either legacy or versioned input and return the 13 data.txt tables."""
    return parse_case_envelope(payload_dict, schema)["tables"]


def roc_now() -> tuple[str, str]:
    now = datetime.now()
    year = now.year - 1911
    date_text = f"{year:03d}{now:%m%d}"
    key = f"{year:03d}{now:%m%d%H%M%S}"
    return date_text, key


def prepare_payload(
    payload: dict[str, Any],
    schema: dict[str, Any],
    *,
    fill_defaults: bool,
    allow_data_txt_unsafe: bool = False,
    layout: dict[str, Any] | None = None,
) -> dict[str, list[dict[str, str]]]:
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

    # 有原檔版面時只處理原檔真的有的表：原檔沒有 BMSP03，就不能無中生有補一張，
    # 否則匯回舊系統的會是一份結構被改過的檔案。
    tables_in_document = set(layout["tableOrder"]) if layout else None

    for table in schema["tableOrder"]:
        if tables_in_document is not None and table not in tables_in_document:
            continue
        rows = incoming.get(table, [])
        if rows is None:
            rows = []
        if not isinstance(rows, list):
            raise DataTxtError(f"{table} 必須是記錄陣列。")
        # The legacy format stores field names inside each record.  A table
        # without a record therefore cannot carry its field contract.  Export
        # one blank canonical record so every data.txt remains a complete,
        # re-importable 13-table / 596-field document.
        if fill_defaults and not rows:
            rows = [{}]
        canonical_rows: list[dict[str, str]] = []
        for row_index, row in enumerate(rows, start=1):
            if not isinstance(row, dict):
                raise DataTxtError(f"{table} 第 {row_index} 筆不是物件。")
            canonical: dict[str, str] = {}
            for field in schema["fieldOrder"][table]:
                raw_value = row.get(field, "")
                value = "" if raw_value is None else str(raw_value)
                # 換行沒列在這裡：舊系統的 LongText 欄位本來就會寫出多行值，解析器
                # 讀得回來、序列化也原樣寫回。半形雙引號才是真的無解——舊格式沒有
                # 跳脫規則，寫出去會讓欄位邊界無法判讀。
                if not allow_data_txt_unsafe and '"' in value:
                    raise DataTxtError(
                        f"{table} 第 {row_index} 筆 {field} 含半形雙引號，舊格式沒有可靠跳脫規則。"
                    )
                canonical[field] = value
            if fill_defaults:
                if "INDEX_KEY" in canonical:
                    canonical["INDEX_KEY"] = key
                for sequence_field in ("person_seq", "Person_seq", "PERSON_SEQ"):
                    if sequence_field in canonical and not canonical[sequence_field].strip():
                        canonical[sequence_field] = str(row_index)
                if "SPOKESMAN" in canonical and not canonical["SPOKESMAN"].strip():
                    canonical["SPOKESMAN"] = "Y" if row_index == 1 else "N"
            canonical_rows.append(canonical)
        result[table] = canonical_rows
    return result


def prepare_extra_tables(
    payload: dict[str, Any],
    schema: dict[str, Any],
    *,
    fill_defaults: bool,
    index_key: str = "",
) -> dict[str, list[dict[str, str]]]:
    incoming = payload.get("extraTables", {})
    if incoming is None:
        incoming = {}
    if not isinstance(incoming, dict):
        raise DataTxtError("extraTables 必須是物件。")

    result: dict[str, list[dict[str, str]]] = {}
    for table in schema.get("extraTableOrder", []):
        rows = incoming.get(table, [])
        if rows is None:
            rows = []
        if not isinstance(rows, list):
            raise DataTxtError(f"{table} 必須是記錄陣列。")
        canonical_rows: list[dict[str, str]] = []
        for row_index, row in enumerate(rows, start=1):
            if not isinstance(row, dict):
                raise DataTxtError(f"{table} 第 {row_index} 筆不是物件。")
            canonical = {
                field: "" if row.get(field) is None else str(row.get(field, ""))
                for field in schema["extraFieldOrder"][table]
            }
            if fill_defaults:
                for key_field in ("INDEX_KEY", "Index_key", "index_key"):
                    if key_field in canonical:
                        canonical[key_field] = index_key
                for sequence_field in ("person_seq", "Person_seq", "PERSON_SEQ"):
                    if sequence_field in canonical and not canonical[sequence_field].strip():
                        canonical[sequence_field] = str(row_index)
                if "SPOKESMAN" in canonical and not canonical["SPOKESMAN"].strip():
                    canonical["SPOKESMAN"] = "Y" if row_index == 1 else "N"
                if table == "C21_3" and not canonical["Rpt_FmName"].strip():
                    canonical["Rpt_FmName"] = "C21-3"
            canonical_rows.append(canonical)
        result[table] = canonical_rows
    return result


def prepare_case_envelope(
    payload: dict[str, Any],
    schema: dict[str, Any],
    *,
    fill_defaults: bool,
    allow_data_txt_unsafe: bool = False,
) -> dict[str, Any]:
    parsed = parse_case_envelope(payload, schema)
    tables = prepare_payload(
        {"tables": parsed["tables"]},
        schema,
        fill_defaults=fill_defaults,
        allow_data_txt_unsafe=allow_data_txt_unsafe,
        layout=parsed["documentLayout"],
    )
    base_rows = tables.get("BMSBASE", [])
    index_key = base_rows[0].get("INDEX_KEY", "") if base_rows else ""
    extra_tables = prepare_extra_tables(
        {"extraTables": parsed["extraTables"]},
        schema,
        fill_defaults=fill_defaults,
        index_key=index_key,
    )
    return {
        "schemaVersion": schema["schemaVersion"],
        "formSet": parsed["formSet"],
        "tables": tables,
        "extraTables": extra_tables,
        "documentLayout": parsed["documentLayout"],
        "passthroughTables": parsed["passthroughTables"],
    }


def validate_tables(
    tables: dict[str, list[dict[str, str]]], schema: dict[str, Any]
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    eudc_locations: list[str] = []
    multiline_locations: list[str] = []
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
    for table in schema["tableOrder"]:
        rows = tables.get(table, [])
        seen_seq: set[str] = set()
        for row_index, row in enumerate(rows, start=1):
            prefix = f"{table} 第 {row_index} 筆"
            if expected_key and row.get("INDEX_KEY", "") != expected_key:
                errors.append(f"{prefix} INDEX_KEY 與 BMSBASE 不一致。")
            sequence = row.get(
                "person_seq", row.get("Person_seq", row.get("PERSON_SEQ", ""))
            ).strip()
            if schema["tableMeta"][table]["repeatable"]:
                if not sequence:
                    warnings.append(f"{prefix} 缺少 PERSON_SEQ；匯出時會依列序補值。")
                elif sequence in seen_seq:
                    errors.append(f"{table} 的 PERSON_SEQ={sequence} 重複。")
                seen_seq.add(sequence)

            for field, value in row.items():
                if not value:
                    continue
                if '"' in value:
                    errors.append(
                        f"{prefix} {field} 含半形雙引號，data.txt 沒有可靠跳脫規則。"
                    )
                if "\r" in value or "\n" in value:
                    multiline_locations.append(f"{prefix} {field}")
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
                    encode_cp950(value)
                except UnicodeEncodeError as exc:
                    bad = value[exc.start : exc.end]
                    errors.append(f"{prefix} {field} 含 CP950 無法表示的字元「{bad}」。")
                if eudc_characters(value):
                    eudc_locations.append(f"{prefix} {field}")

            for code_field, desc_field in SYNC_PAIRS.get(table, []):
                if row.get(code_field, "").strip() and not row.get(desc_field, "").strip():
                    warnings.append(f"{prefix} 已填 {code_field}，但 {desc_field} 空白；報表可能沒有顯示文字。")

    if multiline_locations:
        sample = "、".join(multiline_locations[:3])
        warnings.append(
            f"有 {len(multiline_locations)} 處欄位的值本身含換行（舊系統的多行長文字），例如 {sample}。"
            "換行會原樣保留並寫回 data.txt；若不需要，可在該欄位手動改成單行。"
        )

    if eudc_locations:
        sample = "、".join(eudc_locations[:3])
        warnings.append(
            f"有 {len(eudc_locations)} 處欄位含 Big5 造字（罕用字姓名、地段用字），例如 {sample}。"
            "沒有安裝舊系統造字檔的電腦會顯示為空白或方框，但編輯與匯出都會原樣保留。"
        )

    counts = {table: len(tables.get(table, [])) for table in schema["tableOrder"]}
    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "counts": counts,
    }


def validate_extra_tables(
    extra_tables: dict[str, list[dict[str, str]]],
    schema: dict[str, Any],
    *,
    index_key: str,
) -> dict[str, Any]:
    warnings: list[str] = []
    counts: dict[str, int] = {}
    for table in schema.get("extraTableOrder", []):
        rows = extra_tables.get(table, [])
        counts[table] = len(rows)
        seen_sequences: set[str] = set()
        for row_index, row in enumerate(rows, start=1):
            prefix = f"{table} 第 {row_index} 筆"
            row_key = next(
                (
                    row.get(key_field, "")
                    for key_field in ("INDEX_KEY", "Index_key", "index_key")
                    if key_field in row
                ),
                "",
            )
            if index_key and row_key != index_key:
                warnings.append(f"{prefix} INDEX_KEY 與 BMSBASE 不一致。")
            if table == "C21_3":
                sequence = row.get("Rpt_Seq", "").strip()
                if not sequence:
                    warnings.append(f"{prefix} 缺少 Rpt_Seq 檢討項目代碼。")
                elif not re.fullmatch(r"\d{3}", sequence):
                    warnings.append(f"{prefix} Rpt_Seq 建議使用 3 碼代碼，目前為「{sequence}」。")
                elif sequence in seen_sequences:
                    warnings.append(f"{table} 的 Rpt_Seq={sequence} 重複。")
                seen_sequences.add(sequence)
            else:
                sequence = row.get(
                    "person_seq", row.get("Person_seq", row.get("PERSON_SEQ", ""))
                ).strip()
                if not sequence:
                    warnings.append(f"{prefix} 缺少 PERSON_SEQ；儲存完整案件時會依列序補值。")
                elif not POSITIVE_INTEGER_RE.fullmatch(sequence):
                    warnings.append(f"{prefix} PERSON_SEQ 建議使用正整數，目前為「{sequence}」。")
                elif sequence in seen_sequences:
                    warnings.append(f"{table} 的 PERSON_SEQ={sequence} 重複。")
                seen_sequences.add(sequence)

            for field in EXTRA_NUMERIC_FIELDS.get(table, set()):
                value = row.get(field, "").strip()
                if value and not NUMBER_RE.fullmatch(value):
                    warnings.append(f"{prefix} {field} 建議使用純數字，目前為「{value}」。")

            for field, value in row.items():
                if not value or field in {"PEO_TECH_DATE", "PEO_PLAIN_DATE"}:
                    continue
                upper = field.upper()
                if (upper.endswith("_DATE") or upper.startswith("CHK_DATE")) and not ROC_DATE_RE.fullmatch(value):
                    warnings.append(f"{prefix} {field} 建議使用民國 yyyMMdd 7 碼，目前為「{value}」。")

            if table == "BMSCHK" and row.get("CHK_Item_code", "").strip() and not row.get("CHK_Item", "").strip():
                warnings.append(f"{prefix} 已填 CHK_Item_code，但 CHK_Item 顯示名稱空白。")
            if table == "C21_3" and row.get("Rpt_Seq", "").strip() and not row.get("Rpt_Item", "").strip():
                warnings.append(f"{prefix} 已填 Rpt_Seq，但 Rpt_Item 檢討項目名稱空白。")
            if table == "RPTPHOTO" and row.get("barcode", ""):
                try:
                    base64.b64decode(row["barcode"], validate=True)
                except (binascii.Error, ValueError):
                    warnings.append(f"{prefix} barcode 不是有效的 Base64 附件內容。")

    return {"warnings": warnings, "counts": counts}


def validate_case_envelope(envelope: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    report = validate_tables(envelope["tables"], schema)
    base_rows = envelope["tables"].get("BMSBASE", [])
    index_key = base_rows[0].get("INDEX_KEY", "") if base_rows else ""
    extra_report = validate_extra_tables(
        envelope.get("extraTables", {}), schema, index_key=index_key
    )
    report["warnings"].extend(extra_report["warnings"])
    report["extraCounts"] = extra_report["counts"]
    return report


def serialize_tables(
    tables: dict[str, list[dict[str, str]]],
    schema: dict[str, Any],
    *,
    layout: dict[str, Any] | None = None,
    passthrough: dict[str, list[dict[str, str]]] | None = None,
) -> bytes:
    """把案件寫回 data.txt。

    有 layout（原檔版面）時一律照原檔的表順序與欄序寫回，編輯器沒建模的表從
    passthrough 原樣輸出；沒有 layout 時（新建空白案件）才用模板的 13 表。
    """
    passthrough = passthrough or {}
    table_order = layout["tableOrder"] if layout else schema["tableOrder"]
    field_order = layout["fieldOrder"] if layout else schema["fieldOrder"]

    lines: list[str] = []
    for table in table_order:
        lines.append(f"@TableName {table}")
        rows = tables.get(table) if table in schema["fieldOrder"] else passthrough.get(table)
        for row in rows or []:
            lines.append("@RecordBegin")
            for field in field_order[table]:
                lines.append(f'@d {field} "{row.get(field, "")}"')
            lines.append("@RecordEnd")
    text = "\r\n".join(lines) + "\r\n"
    try:
        return encode_cp950(text)
    except UnicodeEncodeError as exc:
        bad = text[exc.start : exc.end]
        raise DataTxtError(f"含 CP950 無法表示的字元「{bad}」。") from exc

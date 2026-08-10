# CPAMI 二維條碼封包擴充表 數據對應表

舊系統匯出的二維條碼封包（`<時戳>-<流水>.zip`）除了模板已知的 13 表，還會依案件內容
多帶幾張表。本檔記錄這些表的用途、鍵值與欄位清單，作為日後是否開放編輯的依據。

**目前狀態：唯讀原樣保留。** 編輯器載入時完整保存、匯出時依原順序原內容寫回
（`passthroughTables`），畫面不顯示、不可編輯。要開放編輯必須先補齊本檔的「待查」欄位。

## 依據

| 來源 | 說明 |
|---|---|
| `cpami/Arch2016C/ARCH2016.exe` | 舊系統主程式（Delphi）。SQL 敘述與介面文案由字串擷取而來 |
| `cpami/Arch2016C/exec.sql` | Access DDL 遷移腳本 |
| `cpami/Arch2016C/bldcode.mdb` | 代碼庫（`CODE_TYPE` 清單） |
| 真實二維封包 `data.txt` | 欄位名稱與順序（**只取欄名，不引用任何案件值**） |

`cpami/Arch2016C/_Build.mdb` 設有資料庫密碼，尚未開啟；欄位型別、長度與代碼定義因此
仍有缺口，見各表的「待查」。

## 匯出機制（已由 `ARCH2016.exe` 證實）

```
%s%s-%s.zip                       ← 封包檔名樣式
%sverfile.txt / %sdata.txt        ← 封包內容
SELECT * FROM %s WHERE INDEX_KEY = %s AND PERSON_SEQ <> 0 ORDER BY PERSON_SEQ
SELECT * FROM %s WHERE INDEX_KEY = %s
SELECT * FROM %s WHERE 1 = 2      ← 只取欄位定義、不取資料
@TableName %s / @RecordBegin / @d %s %s / @RecordEnd
```

表名是參數，程式跑一個**表名清單迴圈**逐表輸出。**13 表不是格式規定**，而是該案件
剛好有那些表。這正是編輯器採「匯出忠實還原原檔表集合」的依據（見 `CLAUDE.md` §2 第 1 條）。

## BDMLIST — 圖檔（圖說）清單

案件所附圖說／檔案的清單。介面文案佐證：「請選擇圖檔」「寫入圖檔資訊」「圖號為」
「之圖檔命名規範將檔案重新整理後，再重新匯入」「圖面配置已全部套用為「…」之設定值」。

鍵值：`INDEX_KEY` ＋ `PICSEQ`。程式內有 `qryBdmlistBeforeDelete`／`AfterInsert`／`AfterDelete` 觸發程序。

| 欄位 | 研判 |
|---|---|
| `SYSID` | 系統識別碼 |
| `INDEX_KEY` | 案件主鍵，與 13 表一致 |
| `PICSEQ` | 圖檔序號 |
| `PICKIND` | 圖類（代碼；**代碼表待查**） |
| `PICNAME` | 圖名 |
| `PICNUM` | 圖號 |
| `PICMEMO` | 圖說備註 |
| `FILENAME` | 實體檔名，`BDMSIGN` 以此關聯 |
| `SIGNNUM` | 已簽章數 |
| `BMPAS` | 主管機關縣市代碼 |
| `PICSIZE` | 圖幅尺寸（**單位／代碼待查**） |
| `FILESIZE` | 檔案位元組數 |
| `MEMO_VER`／`MEMO_UPDATE` | 備註版本／更新時間 |
| `PERSON_SEQ` | 人員序號 |
| `DATAID` | 資料識別碼 |
| `thomb` | 縮圖（原欄名即小寫拼字，**不得訂正**） |
| `LAYOUTID` | 圖面配置設定 |
| `ORIDATE` | 原始日期 |
| `NEWFLAG`／`CHFLAG` | 新增／異動旗標（**值域待查**） |
| `BARCODEDATE`／`BARCODENO` | 二維條碼產生日期／編號 |
| `CR_DATE`／`UP_DATE`／`OP_USER` | 建檔／更新／操作者 |

## BDMSIGN — 圖章／電子簽章

逐個檔案的電子簽章。介面文案佐證：「不可移除此圖章」「是否要刪除此圖章」。

鍵值：`INDEX_KEY` ＋ `FILENAME` ＋ `SIGNSEQ`。程式內的敘述：

```
SELECT * FROM BDMSIGN WHERE INDEX_KEY = %s AND FILENAME = %s
SELECT * FROM BDMSIGN WHERE INDEX_KEY = %s AND FILENAME = %s AND SIGNFILE = %s
SELECT MAX(SIGNSEQ) FROM BDMSIGN WHERE INDEX_KEY = %s AND FILENAME = %s
DELETE FROM BDMSIGN WHERE INDEX_KEY = %s AND SERIAL = %s
DELETE FROM BDMSIGN WHERE INDEX_KEY = %s AND SIGNFILE <> ''
```

| 欄位 | 研判 |
|---|---|
| `SYSID` | 系統識別碼 |
| `INDEX_KEY` | 案件主鍵 |
| `FILENAME` | 被簽章的檔案，對應 `BDMLIST.FILENAME` |
| `SIGNSEQ` | 同一檔案的簽章序號 |
| `SIGNFILE` | 圖章檔 |
| `SIGNINFO` | 圖章資訊（**內容格式待查**；實際案件中此欄含換行） |
| `SERIAL` | 憑證序號，刪除時作為鍵 |
| `USERNAME` | 簽章者 |
| `BMPAS` | 主管機關縣市代碼 |
| `DATAID` | 資料識別碼 |
| `CR_DATE`／`UP_DATE`／`OP_USER` | 建檔／更新／操作者 |

> 這是**具法律效力的簽章資料**。匯出時漏寫等同讓案件失去簽章，因此
> `passthroughTables` 的原樣保留是硬性要求，不是便利措施。

## BMSRPTSELF — 自主檢查表作答

鍵值：`INDEX_KEY` ＋ `PAS`。作答內容整包存成 JSON 字串：

```
SELECT * FROM BMSRPTSELF WHERE INDEX_KEY = %s and PAS = %s
INSERT INTO BMSRPTSELF(INDEX_KEY, PAS, JSON) values(%s, %s, %s)
UPDATE BMSRPTSELF SET JSON = %s WHERE INDEX_KEY = %s and PAS = %s
```

`exec.sql` 的 DDL：`CREATE TABLE BMSRPTSELF`，之後
`ALTER TABLE BMSRPTSELF ADD CASETYPE TEXT(2)`、`ADD FACTORY_CODE TEXT(20)`。

| 欄位 | 研判 |
|---|---|
| `INDEX_KEY` | 案件主鍵 |
| `PAS` | 主管機關（與其他表的 `BMPAS` 同義，欄名不同，**不得統一**） |
| `JSON` | 自主檢查表作答內容（**JSON schema 待查**） |
| `CASETYPE` | 案件類別，`TEXT(2)` |
| `FACTORY_CODE` | `TEXT(20)`（**用途待查**） |
| `DATAID` | 資料識別碼 |
| `CR_DATE`／`UP_DATE`／`OP_USER` | 建檔／更新／操作者 |

相關檔案：`cpami/Arch2016C/sampleSelfTest.exe`、`sampleSelfTest.doc`、
`fsrp/臺中市開放空間預審自主查核表.xls`、`fsrp/新北市建造執照掛號自主檢查表.xls`、
`fsrp/高雄市建造執照掛號自主檢查表.xls`。

## BMELVTR — 昇降／機械停車設備

欄位集合與 `schema/case_extension_schema.json` 內的定義**完全相同**（25 欄），已建模。

但**從 data.txt 讀進來的那份仍走 `passthroughTables`**，不搬進 `extraTables`：同一份資料
不能有兩個家，否則匯出不是重複寫入就是漏寫。詳見 `CLAUDE.md` §7。

## 罕用字對照（`CODE_TYPE = 'UNC'`）

`bldcode.mdb` 的 `Bldcode` 表有 15 列 `UNC`（1 列說明 ＋ 14 筆，其中 `U+E020` 重複），
記錄「Big5 造字 ↔ 真正的 Unicode 字」。說明列自述：
`CODE_SEQ為字碼流水號, CODE_DESC為中文造字, MARK為UNICODE編碼`。

| 造字 | Big5 | 真實字 | | 造字 | Big5 | 真實字 |
|---|---|---|---|---|---|---|
| U+E020 | `FA60` | 嵵 | | U+E05A | `FABC` | 菓 |
| U+E025 | `FA65` | 磘 | | U+E060 | `FAC2` | 脚 |
| U+E036 | `FA76` | 廍 | | U+E065 | `FAC7` | 舘 |
| U+E03D | `FA7D` | 双 | | U+E12C | `FBF1` | 脇 |
| U+E046 | `FAA8` | 烟 | | U+E1CF | `FCF7` | 厦 |
| U+E049 | `FAAB` | 猪 | | U+E206 | `FD6F` | 芉 |
| U+E058 | `FABA` | 鷄 | | | | |

已實作於 `cpami_core.py` 的 `UNC_EUDC_TO_UNICODE`：解碼時換成真實字（畫面看得懂），
編碼時換回造字位元組（位元組級 roundtrip 不變）。之所以能雙向轉換，是因為對照嚴格
一對一，且這 14 個真實字本身都無法用 CP950 編碼——文字裡出現「廍」就只可能來自
造字 `0xFA76`。改動對照表前必須重新驗證這兩個前提（`tests/core_unit_test.py` 有守）。

**不在此表內的造字**依然保留為私人使用區字元，畫面顯示為空白方框，匯出原樣寫回，
並在載入時以警告點名。實務上確實會遇到（某些案件的 `BMSP01.TEL_NO` 就整格是一個
非官方造字），那屬於各機關自行造的字，不在中央碼表內。

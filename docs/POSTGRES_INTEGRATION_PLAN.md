# PostgreSQL 對接預備作業計畫

> 目的：讓 CPAMI 書表資料編輯器之後能順利併入使用者以 PostgreSQL 為資料庫的內部系統。
> 本檔是**規劃與契約**；逐步可執行的工作指令在 `docs/CODEX_PROMPTS.md`（Prompt 1～4 對應本計畫）。
> 原則依據：根目錄 `CLAUDE.md`。撰於 2026-07-14。

## 1. 現況盤點（與資料庫對接直接相關的事實）

| 事實 | 對接的意涵 |
|---|---|
| 一份 `data.txt` = 一個案件：13 表、596 欄、固定欄序，值全部是字串 | 資料庫要保真字串語意（前導零、空字串 vs 0），不能貿然轉型 |
| 伺服器啟動時以根目錄「真實案件」`data.txt` 當格式模板（`TEMPLATE`），沒有它就無法啟動 | 格式結構（schema）與案件內容（data）目前綁死，必須先拆開 |
| 解析／驗證／序列化都在 `server.py` 的純函式（`parse_data_txt_bytes` 等），但和 HTTP handler 同檔 | 抽成獨立模組後，內部系統可直接 import 同一套格式引擎 |
| 匯出有位元組級 roundtrip 測試保證 | 這是對接後也必須維持的最高驗收標準 |
| `web/codebook.json`：43 種 CODE_TYPE、22,383 筆舊代碼＋1,626 筆官方地段 | 內部系統要查代碼名稱時，這份就是來源，可直接落庫 |
| `ALLRPT` 代碼類型收錄全部書表目錄（A／B／C／D／E 系列共 109 筆） | 書表組擴充與 DB 的 `form_set` 欄位都以它為準 |
| A 系列 22 份書表用 13 表中的 11 表；B 系列已開放 `BM_TEC`、`BMSSC` 與 13 表外擴充資料 | DB payload 必須同時容納完整 13 表與 versioned `extraTables` |
| 部分書表資料不在 data.txt 內（`BMSNEBER`、`BMSROAD`、`BMSP01_11_2_2`、`BMSLANOWNER1` 等舊程式暫存表） | DB 模型要預留「擴充資料」空間，但實際格式待研究決策 |
| 根目錄 `data.txt` 含真實個資，目前 untracked 但**尚未列入 .gitignore** | 對接前必須先處理（P0） |

## 2. 對接總策略

**編輯器本體維持離線單機可用（stdlib-only、無 DB 依賴）；與內部系統之間用「案件文件」作交換單位。**

三種接法都要保持可行，預備作業只做三者共用的部分（契約＋格式引擎＋工具），不提前選邊：

1. **檔案交換**：內部系統與編輯器互傳 data.txt 或案件 JSON。零耦合，最先可用。
2. **工具串接**：內部系統呼叫本專案 `tools/pg_import.py`／`pg_export.py`，或直接 import `cpami_core.py` 讀寫 PostgreSQL。
3. **API 串接**：內部系統後端實作（或反向代理到）編輯器的 `/api/*` 合約，前端 `caseStore` 改指向 cases API，編輯器變成內部系統的一個頁面。

共用的三個契約：

- **格式 schema**（`cpami-form-editor/schema/data_txt_schema.json`）：13 表、596 欄、欄序、表格屬性的唯一機器可讀定義，進版控、帶版本號。
- **案件 JSON 封套**（§4）：前端、伺服器、資料庫之間唯一的案件表示法。
- **格式引擎**（`cpami_core.py`）：解析／驗證／序列化的唯一實作，HTTP 與 DB 兩邊共用。

## 3. 資料庫模型

### 3.1 模型認知

- 一個「工程案」（project）在生命週期會產生多份文件：建照申請（A）、開工申報（B）、使照申請（C）……舊系統以同一份 13 表結構承載，各階段填的表不同。
- 因此以**文件（case_document）為儲存單位**：一列 = 一份完整 13 表 payload（JSONB），`form_set` 標記它屬於哪個書表組作業；`project` 只是把同一工程的文件串起來的殼。
- **JSONB 是正本**（保真、可位元組級還原 data.txt）；關聯式查詢需求用「投影 view」從 JSONB 展開，需要效能時再物化。不要反過來以正規化表為正本——596 個字串欄位的舊語意（空字串、前導零、欄序）在正規化過程極易失真。

### 3.2 DDL 草案（P4 落成 `db/schema.sql`，此處為設計基準）

```sql
-- 資料庫本身使用 UTF8 編碼；CP950 僅存在於匯入／匯出邊界。
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid

CREATE TABLE cpami_projects (
    project_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text NOT NULL,                 -- 工程名稱（人工可改）
    city_code   text NOT NULL DEFAULT '',      -- BMSBASE.BMPAS
    license     text NOT NULL DEFAULT '',      -- 執照字號（核准後補）
    note        text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cpami_case_documents (
    case_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     uuid REFERENCES cpami_projects(project_id),
    form_set       text NOT NULL DEFAULT 'A',  -- ALLRPT 系列字母 A/B/C/D…
    schema_version text NOT NULL,              -- 對應 data_txt_schema.json
    index_key      text NOT NULL,              -- BMSBASE.INDEX_KEY（業務鍵，非唯一保證）
    apply_type     text NOT NULL DEFAULT '',   -- BMSBASE.APPLY_TYPE
    building_name  text NOT NULL DEFAULT '',   -- BMSBASE.BUILDING_NAME
    status         text NOT NULL DEFAULT 'draft',  -- draft / exported / submitted / approved
    payload        jsonb NOT NULL,             -- {"tables": {...13 表...}, "extraTables": {...}}，值全為字串
    source_file    text NOT NULL DEFAULT '',   -- 來源 data.txt 檔名（追溯用）
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_documents_index_key ON cpami_case_documents (index_key);
CREATE INDEX idx_case_documents_project   ON cpami_case_documents (project_id, form_set);
CREATE INDEX idx_case_documents_payload   ON cpami_case_documents USING gin (payload jsonb_path_ops);

-- 代碼庫：codebook.json 落庫（含 ALLRPT 書表目錄）
CREATE TABLE cpami_codes (
    code_type text NOT NULL,   -- 43 種 CODE_TYPE：PAS/ZON/SEC/KIN/STU/USECOD/STC/ALLRPT...
    code      text NOT NULL,
    sub       text NOT NULL DEFAULT '',
    parent    text NOT NULL DEFAULT '',
    label     text NOT NULL DEFAULT '',
    mark      text NOT NULL DEFAULT '',
    source    text NOT NULL DEFAULT '',  -- bldcode.mdb / taichung-opendata
    PRIMARY KEY (code_type, code, sub, parent)
);

-- 民國日期轉西元（民國 yyyMMdd 7 碼）
CREATE OR REPLACE FUNCTION cpami_roc_to_date(t text) RETURNS date
IMMUTABLE LANGUAGE sql AS $$
    SELECT CASE WHEN t ~ '^\d{7}$' THEN
        make_date(substr(t,1,3)::int + 1911, substr(t,4,2)::int, substr(t,6,2)::int)
    END
$$;
```

投影 view 範例（每個 13 表各建一個，P4 產生；業務欄一律先以 text 呈現，數字另附 `_num` 欄）：

```sql
CREATE OR REPLACE VIEW cpami_v_bmslan AS
SELECT d.case_id, d.index_key, d.form_set,
       r->>'person_seq'                    AS person_seq,
       r->>'SPOKESMAN'                     AS spokesman,
       r->>'DIST'                          AS dist,
       r->>'SECTION'                       AS section,
       r->>'ROAD_NO1'                      AS road_no1,
       r->>'ROAD_NO2'                      AS road_no2,
       r->>'TOT_AREA'                      AS tot_area,
       NULLIF(r->>'TOT_AREA','')::numeric  AS tot_area_num,
       r->>'USE_AREA'                      AS use_area,
       NULLIF(r->>'USE_AREA','')::numeric  AS use_area_num
FROM cpami_case_documents d
CROSS JOIN LATERAL jsonb_array_elements(d.payload->'tables'->'BMSLAN') AS r;
```

### 3.3 型別對應規則（正本一律字串，轉型只在 view 層）

| data.txt 語意 | payload JSONB | view 層 |
|---|---|---|
| 一般文字 | `"值"`（空值 `""`，永不為 null） | text |
| 數字欄（`NUMERIC_FIELDS`，如面積、造價） | 原字串 | `NULLIF(x,'')::numeric` 另附 `_num` 欄 |
| 民國日期（`*_DATE`、`owner_birth` 等） | 原字串 7 碼 | `cpami_roc_to_date(x)` 另附 `_date` 欄 |
| Y／N 旗標 | `"Y"`/`"N"`/`""` | text（三態，不轉 boolean） |
| 前導零欄（`LAST_MODIFY` 等） | 原字串 | text，禁止轉數字 |
| 代碼欄 | 原代碼字串 | join `cpami_codes` 取名稱 |

### 3.4 鍵的設計

- `INDEX_KEY` 是民國時間戳 13 碼，跨來源**不保證唯一**（不同電腦同秒可撞），只能當業務索引，不能當主鍵 → 用 `case_id uuid` 代理鍵。
- 不加 `UNIQUE(index_key)`；同一案件可能有多版草稿。匯入工具以 `(index_key, form_set, status='draft')` 做 upsert 判斷，規則寫在工具說明。
- 子表列的識別：`(case_id, 表名, person_seq)`；`person_seq` 在匯出時由格式引擎重排，DB 不另設序號。

## 4. 案件 JSON 封套（唯一的案件交換表示法）

```json
{
  "schemaVersion": "2026-07-14.1",
  "formSet": "B",
  "tables": {
    "BMSBASE":  [ { "INDEX_KEY": "1150101120000", "BMPAS": "I80", "...": "..." } ],
    "BM_TEC":   [],
    "BMSLAN":   [ { "...": "..." } ],
    "...":      []
  },
  "extraTables": {
    "BMSROAD":  [ { "INDEX_KEY": "1150101120000", "person_seq": "1", "ROAD_SEC": "範例路", "...": "..." } ],
    "BMSCHK":   [],
    "BMSSCRP":  [],
    "RPTPHOTO": []
  }
}
```

規則：

1. `tables` 必含 13 表鍵；值為記錄陣列，記錄的欄位集合＝schema 該表欄位（缺欄視為 `""`）。
2. 所有值都是字串；`null` 不合法。
3. `schemaVersion` 必須等於伺服器目前 schema 版本，不符即拒收（HTTP 400）。
4. `formSet` 是文件標記（預設 `"A"`），不影響 13 表內容的完整性。
5. 相容性：`/api/validate`、`/api/export` 同時接受舊格式 `{"tables": ...}`（視為 `formSet:"A"`、版本＝目前版本）。
6. `cpami_case_documents.payload` 存 `{"tables": ..., "extraTables": ...}`；`schemaVersion`、`formSet` 升為欄位。
7. schema `2026-07-14.1` 起，payload 同時保存 `tables` 與 `extraTables`。`extraTables` 的四個群組由 `schema/case_extension_schema.json` 定義；舊 data.txt 匯入時四組皆為空陣列。
8. data.txt 匯出只序列化 `tables`，但仍必須完整輸出原 13 表、596 欄；未使用的子表會具體化為一筆完整欄序的空白記錄，讓稀疏案件也能重新匯入。`extraTables` 不得硬塞進舊格式。完整資料交換改用案件 JSON 或資料庫 payload。

## 5. 預備工項（對應 `docs/CODEX_PROMPTS.md`）

| 編號 | 工項 | 產出 | 對接後省下的麻煩 |
|---|---|---|---|
| P0（併入 Prompt 1） | 版控衛生：`.gitignore` 加 `/data.txt`、`/cpami/`；建立全虛構測試 fixture | `.gitignore`、`tests/fixtures/sample_data.txt` | 個資不會誤入 git；CI／他機可跑測試 |
| P1 | schema 與內容拆離：抽出 `schema/data_txt_schema.json`，伺服器啟動不再依賴真實 data.txt | schema JSON、`tools/extract_schema.py`、server 改造 | DB 的欄位定義有了版本化依據；內部系統可獨立取得格式定義 |
| P2 | 格式引擎抽離＋封套：`cpami_core.py`、案件封套實作、核心單元測試 | `cpami_core.py`、`tests/core_unit_test.py` | 內部系統直接 import 同一套解析／驗證／序列化，不用重寫 |
| P3 | 前端資料層收口：`caseStore` 區段統一進出、`state.formSet`＋`FORM_SETS` 骨架（UI 不變） | app.js 重構 | 之後把「下載檔案」換成「存 DB API」只動一個地方；書表組擴充有掛載點 |
| P4 | DB 產物：DDL、匯入／匯出／代碼落庫工具（皆可 `--dry-run`，編輯器本體不沾 psycopg） | `db/schema.sql`、`db/README.md`、`tools/pg_import.py`、`tools/pg_export.py`、`tools/pg_load_codes.py`、`tests/pg_tools_test.py` | 內部系統拿到即用的建庫腳本與雙向轉換工具 |

書表組擴充（Prompt 5～7）不是 DB 預備的一部分，但其研究產出（B／C／D 綁定的表、缺口清單）會回饋 §3 模型——尤其「不在 13 表內的暫存表」若確定需要，擴充方式是往 `payload` 加頂層鍵（如 `"extraTables"`）＋ schema 版本升版，不是加 PG 欄位。

## 6. 內部系統對接時的最小工作清單（預備完成後）

1. 在內部系統的 PostgreSQL 執行 `db/schema.sql`（資料庫需為 UTF8）。
2. `python -X utf8 tools/pg_load_codes.py --dsn ...` 匯入 codebook（含 ALLRPT）。
3. 既有案件入庫：對每份 data.txt 跑 `python -X utf8 tools/pg_import.py --data-txt ... --dsn ...`。
4. 內部系統讀資料：查 `cpami_v_*` 投影 view；寫資料：組封套 JSON 後經 `cpami_core.validate` 再 UPDATE `payload`。
5. 產出舊系統上傳檔：`tools/pg_export.py --index-key ... --out data.txt`（內部走 `cpami_core.serialize`，保證 roundtrip 品質）。
6. 若要線上編輯：選 §2 的接法 3，在內部系統後端實作 `/api/bootstrap`、`/api/validate`、`/api/export`＋新增 cases CRUD，前端只改 `caseStore`。

預留的 cases API 形狀（**現在不實作**，僅為 caseStore 設計時的參考）：

```text
GET  /api/cases                 → [{caseId, indexKey, formSet, buildingName, status, updatedAt}]
GET  /api/cases/{caseId}        → 案件封套
PUT  /api/cases/{caseId}        → 存草稿（body=案件封套；成功回驗證報告）
POST /api/cases/{caseId}/export → data.txt（同 /api/export 語意）
```

## 7. 風險與注意事項

- **編碼**：PostgreSQL 端一律 UTF-8；「CP950 可編碼性」是應用層驗證（`cpami_core`），存草稿可以容忍違規、匯出必須擋下——與現行編輯器行為一致。
- **個資**：入庫後 `payload` 含身分證字號等個資。內部系統要處理存取控制與備份加密；編輯器現有的一次性權杖只夠單機情境，多人使用時認證交給內部系統（SSO／反向代理），不要在本專案自造帳號系統。
- **INDEX_KEY 撞號**：見 §3.4，任何以 INDEX_KEY 當唯一鍵的捷徑都會在多來源匯入時爆炸。
- **schema 演進**：B 系列已在 `2026-07-14.1` 納入 `BMSROAD/BMSCHK/BMSSCRP/RPTPHOTO`。之後 C／D 若再增加 13 表外資料，需同步修改案件擴充 schema 並升 `schemaVersion`；舊版文件保留原版本號不回填，`pg_import` 拒收不相符版本。
- **roundtrip 不可退讓**：任何入庫→出庫路徑都要能通過與現行相同的位元組級測試；這是驗證整條管線沒有偷改資料的唯一防線。

# Codex 執行提示詞集

每個 Prompt 是一次獨立的 Codex 工作階段，**依編號順序執行、一次一個**。把整個灰色區塊原文貼給 Codex 即可。

- Prompt 1～4：PostgreSQL 對接預備（對應 `docs/POSTGRES_INTEGRATION_PLAN.md` 的 P0～P4）。
- Prompt 5～7：書表組擴充（側邊欄切換 A／B／C／D 整排資料群組）。
- 依賴關係：2 依賴 1；3 依賴 2；4 依賴 2；5 依賴 3；6、7 依賴 5。
- 每個 Prompt 完成後：檢視 diff、自己跑一次驗收指令、以 `feat:`／`refactor:`／`docs:` 前綴 commit，然後在下方進度表打勾並記日期。

| # | 工項 | 完成日 |
|---|---|---|
| ☑ 1 | 版控衛生、虛構 fixture、schema 抽離 | 2026-07-14 |
| ☑ 2 | 格式引擎 cpami_core.py 與案件封套 | 2026-07-14 |
| ☑ 3 | 前端 caseStore 收口與 FORM_SETS 骨架 | 2026-07-14 |
| ☑ 4 | PostgreSQL DDL 與匯入匯出工具 | 2026-07-14 |
| ☑ 5 | 側邊欄書表組切換 UI | 2026-07-14 |
| ☑ 6 | B 系列（施工管理）研究與實作 | 2026-07-14 |
| ☑ 7 | C／D 系列（使用管理、拆除）研究與實作 | 2026-07-14 |

環境備註（每個 Prompt 都適用）：Windows 11、PowerShell；Python 以 `python -X utf8` 執行；Node.js 可用；工作目錄為 repo 根目錄 `BOOKTIRE/`。

---

## Prompt 1 — 版控衛生、虛構 fixture、schema 抽離

```text
你是本專案的實作工程師。動手前先完整閱讀根目錄 CLAUDE.md（本專案唯一原則文件），
特別是 §2 data.txt 格式鐵則、§3 個資紅線、§6 測試。再讀 docs/POSTGRES_INTEGRATION_PLAN.md
§1 與 §5 的 P0、P1。若本 prompt 與 CLAUDE.md 衝突，以 CLAUDE.md 為準。

背景：伺服器 cpami-form-editor/server.py 啟動時把根目錄「真實案件」data.txt 當格式模板
（模組層級 TEMPLATE），tests/server_roundtrip_test.py 也直接讀它。data.txt 含真實個資，
目前 untracked 且未列入 .gitignore。本次目標：格式結構與案件內容拆離、測試改用虛構資料、
杜絕個資入庫風險。

任務（依序）：

1. .gitignore：新增規則忽略根目錄的 /data.txt 與整個 /cpami/（保留檔內既有規則）。
   完成後 git status 不得再列出這兩個路徑；git check-ignore data.txt cpami 都要命中。

2. 新增 cpami-form-editor/tools/extract_schema.py：
   - 讀入一份 data.txt（預設 ../data.txt，可用 --source 指定），重用現有解析邏輯，
     輸出 cpami-form-editor/schema/data_txt_schema.json（UTF-8、縮排 2、鍵序穩定）。
   - 內容：{"schemaVersion": "2026-07-14", "generatedFrom": "<來源檔名，不含路徑>",
     "tableOrder": [...13 表...], "fieldOrder": {表: [欄...]},
     "tableMeta": {表: {"label": ..., "repeatable": true/false}}}。
     label 與 repeatable 沿用 server.py 現有 TABLE_LABELS 與 REPEATABLE_TABLES。
   - 產生的 schema JSON 檔要提交進版控（裡面只有結構，沒有案件資料）。

3. 新增 cpami-form-editor/tools/make_fixture.py：
   - 依 schema JSON 產生 cpami-form-editor/tests/fixtures/sample_data.txt：
     13 表、596 欄、欄序與模板一致、CP950、CRLF，內容全部虛構。
   - 虛構值沿用專案慣例（CLAUDE.md §3）：範例建設股份有限公司、王範例、A123456789、
     臺中市範例區範例路。可參考 web/app.js 的 SAMPLE_PATCHES 取合理的代碼值。
   - INDEX_KEY 用固定假值（例如 1150101120000），輸出必須決定性（重跑產生相同位元組）。
   - fixture 檔提交進版控。

4. 改造 server.py：
   - 結構模板改讀 schema/data_txt_schema.json（找不到 schema 才是啟動錯誤）。
   - 初始案件一律為空白，不得自動讀取 ../data.txt；
     /api/bootstrap 回傳 tables 全空（所有表空陣列）、`initialCase: "blank"`，
     並保留 `sampleLoaded: false` 作相容欄位。
   - /api/bootstrap 回應加入 "schemaVersion"。
   - 匯入／驗證／匯出全部以 schema 為欄序與表序依據。
   - 根目錄 data.txt 是否存在都不得影響 /api/bootstrap；tableOrder／fieldOrder 保持 schema 定義，
     tables 永遠全空。使用者主動匯入後，/api/export 的位元組 roundtrip 仍須不變。

5. 前端 app.js 最小配合：bootstrap() 將 schemaVersion 存入 state；
   `initialCase` 為 `blank` 時建立可直接填寫的空白案件，setStatus 顯示「已建立空白案件，可以開始填寫或主動載入既有資料」。
   除此之外不改任何前端行為。

6. 更新 tests/server_roundtrip_test.py：
   - roundtrip 斷言主體改為對 fixture：把 fixture 位元組 POST /api/import-data-txt，
     取回 tables 再 POST /api/export，結果必須與 fixture 逐位元組相同。
   - 對根目錄真實 data.txt 的 roundtrip 改為「檔案存在才執行」，不存在時印出略過訊息。
   - 新增斷言：bootstrap 含 schemaVersion 且等於 schema JSON 的值、`initialCase` 為 `blank`、
     所有 tables 為空；13 表、596 欄的斷言保留。

7. 更新 cpami-form-editor/README.md 啟動段：說明一律以空白案件啟動、既有檔案須主動載入，
   以及 schema/data_txt_schema.json 的角色與重新產生方式。

硬性限制：
- 不得把根目錄 data.txt 的任何真實值（姓名、身分證、地址、電話、地號、執照號）
  寫進任何提交的檔案；fixture 完成後用人工比對確認。
- 不要重構 server.py 的整體架構（解析器搬家是 Prompt 2 的事），本次只動模板來源。
- 不要動 UI 版面與互動。

驗收（全部通過才算完成）：
- git check-ignore data.txt 與 git check-ignore cpami 均命中。
- 在 cpami-form-editor/ 執行：node --check .\web\app.js、node .\tests\frontend_smoke_test.js 通過。
- 啟動 python -X utf8 .\server.py 後執行 python -X utf8 .\tests\server_roundtrip_test.py 通過
  （含 fixture roundtrip 與真檔 roundtrip 兩者）。
- 手動驗證並在回報中記錄：把根目錄 data.txt 暫時改名後啟動伺服器，能開站、能建新空白案件、
  能匯出；驗證完把檔名改回來。
- python -X utf8 .\tools\make_fixture.py 重跑一次，git diff 顯示 fixture 無變化（決定性）。

完成後回報：改動檔案清單、各驗收項結果、fixture 中使用的虛構值摘要。
並更新 docs/CODEX_PROMPTS.md 進度表（打勾＋日期）。
```

---

## Prompt 2 — 格式引擎 cpami_core.py 與案件封套

```text
你是本專案的實作工程師。動手前先完整閱讀根目錄 CLAUDE.md，特別是 §1 分層鐵則、§2 格式鐵則、
§6 測試；再讀 docs/POSTGRES_INTEGRATION_PLAN.md §2（三個契約）與 §4（案件 JSON 封套）。
前置：Prompt 1 已完成（schema JSON 與 fixture 已存在）。

背景：解析／驗證／序列化目前都寫在 server.py。內部系統之後要直接重用這套格式引擎
（不經 HTTP），所以抽成獨立模組，並讓 API 接受帶版本的「案件封套」。

任務（依序）：

1. 新增 cpami-form-editor/cpami_core.py（只用標準庫）：
   - 從 server.py 搬入：DataTxtError、FIELD_RE 等正規式、TABLE_LABELS、REPEATABLE_TABLES、
     SYNC_PAIRS、NUMERIC_FIELDS、parse_data_txt_bytes、prepare_payload、validate_tables、
     serialize_tables、roc_now。
   - 去除全域 TEMPLATE：需要模板的函式一律改成以 schema 物件為參數
     （新增 load_schema(path) 讀 schema/data_txt_schema.json）。
   - 新增封套處理函式：parse_envelope(payload_dict, schema) -> tables
     規則照 POSTGRES_INTEGRATION_PLAN.md §4——同時接受
     {"tables": ...}（舊格式）與 {"schemaVersion", "formSet", "tables"}（封套）；
     封套的 schemaVersion 與 schema 不符時拋 DataTxtError（訊息含兩個版本號）；
     formSet 缺省為 "A"。
   - 模組頂部 docstring 寫明：這是內部系統與伺服器共用的唯一格式引擎。

2. server.py 改為薄殼：只保留 HTTP、授權（authorize_request 一字不動）、路由，
   格式邏輯全部呼叫 cpami_core。/api/validate 與 /api/export 改走 parse_envelope
   （因此新舊兩種請求格式都能用）。對外行為除了「多接受封套格式」外完全不變。

3. 前端 app.js：validateData 與 exportDataTxt 的請求 body 改送完整封套
   {"schemaVersion": state.schemaVersion, "formSet": "A", "tables": state.tables}。
   其他不動。

4. 新增 tests/core_unit_test.py（不啟動 HTTP，直接 import cpami_core）：
   - fixture 解析→序列化 roundtrip 位元組一致。
   - 驗證錯誤案例各至少一例：INDEX_KEY 不一致、person_seq 重複、數字欄含非數字、
     值含雙引號或換行、CP950 不可編碼字元（例如「𠀋」）。
   - 封套案例：舊格式可解析、封套可解析、版本不符拋錯、formSet 預設 A。
   - 全部用虛構資料。

5. README 測試段補上新測試的執行方式。

硬性限制：
- cpami_core.py 不得 import http、socket 或任何第三方套件。
- 搬移函式時邏輯逐行保留，不做順手重寫；行為差異只允許「TEMPLATE 全域改參數」一項。
- authorize_request、權杖 cookie 邏輯不得改動。

驗收：
- node --check .\web\app.js、node .\tests\frontend_smoke_test.js 通過。
- python -X utf8 .\tests\core_unit_test.py 通過。
- 啟動伺服器後 python -X utf8 .\tests\server_roundtrip_test.py 通過（fixture 與真檔均為
  位元組級一致；真檔不存在則略過該段）。
- 用 curl 或 Python 對 /api/validate 分別送舊格式與封套格式各一次，都回 200；
  送錯誤 schemaVersion 回 400 且訊息含版本號（在回報中附實測結果）。

完成後回報：改動檔案、測試結果、封套實測輸出。更新 docs/CODEX_PROMPTS.md 進度表。
```

---

## Prompt 3 — 前端 caseStore 收口與 FORM_SETS 骨架

```text
你是本專案的實作工程師。動手前先完整閱讀根目錄 CLAUDE.md，特別是 §4 UI/UX 原則、§5 程式風格、
§6 測試；再讀 docs/POSTGRES_INTEGRATION_PLAN.md §5 的 P3。前置：Prompt 2 已完成。

背景：app.js 目前直接四散讀寫 state.tables 與 fetch。之後要（a）把「下載檔案」換成
「存資料庫 API」時只想改一個地方；（b）新增 B／C／D 書表組時要能整排切換側邊欄資料群組。
本次只做內部結構，UI 與行為完全不變。

任務（依序）：

1. 在 app.js 的設定表區段新增 FORM_SETS 常數：
   FORM_SETS = {
     A: { label: "建照申請", tables: ["BMSBASE","BMSLAN","BMSLANOWNER","BMSMEMO","BMSP01",
          "BMSP02","BMSP03","BMSP04","BMSPARK","BMSSTAIR","BMSWORK"] },
   }
   並在 state 加 formSet: "A"。renderNav 改為依 FORM_SETS[state.formSet].tables 的順序列出
   群組（目前結果與現狀相同）。TABLE_CONFIG 維持「全部資料群組的欄位字典」角色不變。

2. 新增「caseStore」區段（單一 app.js 內的獨立區段，加區段註解標題），把與伺服器互動
   及案件生命週期集中成具名函式，全檔一律經由它們：
   - caseBootstrap()：載入 /api/bootstrap 與 codebook（原 bootstrap() 的資料部分）。
   - caseImportDataTxt(file)、caseValidate()、caseExport()：包裝現有三個 API 呼叫，
     封套組裝只出現在這一區。
   - caseNewBlank()：原 newBlankCase 的資料部分（清表、建空白 BMSBASE）。
   - activeTables()：回傳 state.tables；全檔原本直接寫 state.tables[...] 的地方
     改經 activeTables()（日後若需要依書表組隔離資料，只改這一個函式）。
   UI 渲染與事件處理維持在原本的函式，只是資料操作改呼叫 caseStore。

3. tests/frontend_smoke_test.js：__test 匯出清單加入 FORM_SETS、activeTables，
   新增斷言：FORM_SETS.A.tables 與 TABLE_CONFIG 鍵集合一致且順序相同；
   state.formSet 預設 "A"。

硬性限制：
- 純重構：任何使用者可見行為、DOM 結構、localStorage 鍵都不得改變。
- 不引入 ES module、不拆檔、不加建置步驟（CLAUDE.md §5）。
- 分小步進行，每步跑 node --check。

驗收：
- node --check .\web\app.js、node .\tests\frontend_smoke_test.js 通過。
- 啟動伺服器後 python -X utf8 .\tests\server_roundtrip_test.py 通過。
- 手動走一遍並在回報中逐項記錄：載入 data.txt→編輯欄位→批次輸入→清空本頁→
  檢查資料→匯出 data.txt，行為與改造前一致。
- git grep -n "state\.tables\[" web/app.js 的殘留處數量為 0（全部經 activeTables()），
  state.tables 的直接讀取只允許出現在 caseStore 區段內。

完成後回報：改動摘要、驗收結果。更新 docs/CODEX_PROMPTS.md 進度表。
```

---

## Prompt 4 — PostgreSQL DDL 與匯入匯出工具

```text
你是本專案的實作工程師。動手前先完整閱讀根目錄 CLAUDE.md（特別是 §1 分層鐵則：編輯器執行期
禁止 DB 依賴）；再精讀 docs/POSTGRES_INTEGRATION_PLAN.md 全文——本 prompt 就是把該計畫
§3、§5 P4、§6 落成檔案。前置：Prompt 2 已完成。

任務（依序）：

1. 新增 db/schema.sql（冪等：IF NOT EXISTS / CREATE OR REPLACE）：
   - 照計畫 §3.2 建 cpami_projects、cpami_case_documents、cpami_codes、cpami_roc_to_date
     與三個索引。
   - 檔頭註解寫明：資料庫需 UTF8；payload 值全為字串；正本是 JSONB、view 只是投影。

2. 新增 cpami-form-editor/tools/gen_db_views.py：
   - 讀 schema/data_txt_schema.json 與 cpami_core 的 NUMERIC_FIELDS，
     為 13 表各產生一個 cpami_v_<表名小寫> 投影 view 的 SQL：
     每欄一個 text 欄位（欄名轉小寫；與 SQL 保留字衝突時加引號）；
     NUMERIC_FIELDS 命中的欄位另附 <欄>_num（NULLIF(...,'')::numeric）；
     欄名以 _DATE 結尾或為 owner_birth／BIRTH_DATE 的另附 <欄>_date（cpami_roc_to_date）。
     view 前置欄固定為 case_id、index_key、form_set。
   - 輸出寫入 db/views.sql（提交進版控），並在 db/schema.sql 尾端註明要接著執行 views.sql。

3. 新增 tools/pg_import.py（位於 cpami-form-editor/tools/）：
   - 參數：--dsn（或環境變數 CPAMI_PG_DSN）、--data-txt 路徑 或 --case-json 路徑（二擇一）、
     --form-set（預設 A）、--status（預設 draft）、--dry-run。
   - 流程：cpami_core 解析＋驗證（驗證錯誤→列印後中止，除非 --allow-invalid 存草稿）→
     組 payload → upsert cpami_case_documents（依 index_key + form_set + status='draft' 更新，
     否則插入新列）→ 同步冗餘欄（apply_type、building_name、schema_version、source_file）。
   - psycopg 採延遲 import：未安裝時報清楚的中文錯誤與安裝指引；--dry-run 不需要 psycopg，
     改為列印將執行的 SQL 與參數摘要（個資值遮蔽顯示，例如姓名只顯示首字）。

4. 新增 tools/pg_export.py：--dsn、--index-key（同鍵多列時要 --case-id 指定）、--out 路徑；
   從 payload 取 tables，經 cpami_core.serialize_tables 寫出 CP950 data.txt。

5. 新增 tools/pg_load_codes.py：讀 web/codebook.json，將 codeTypes 全部（含 ALLRPT）與
   officialSections（code_type 用 SEC、source 用 taichung-opendata）upsert 進 cpami_codes；
   支援 --dry-run（列印筆數統計而非全量 SQL）。

6. 新增 tests/pg_tools_test.py：
   - 不需資料庫的部分必跑：gen_db_views 產出的 SQL 含 13 個 view、欄數正確、
     TOT_AREA 有 _num 欄；pg_import --dry-run 對 fixture 成功且輸出含遮蔽後的 upsert 摘要；
     pg_load_codes --dry-run 統計數正確。
   - 設有環境變數 CPAMI_PG_DSN 時加跑整合段：建 schema→import fixture→export→
     與 fixture 位元組一致→load_codes 後 SELECT count 核對。無 DSN 時印出略過訊息。

7. 新增 db/README.md：照計畫 §6 寫「內部系統對接最小工作清單」，含每個工具的完整指令範例。

硬性限制：
- server.py、web/ 完全不動；psycopg 只允許出現在 tools/pg_*.py 的延遲 import 中。
- SQL 識別字全小寫蛇形；不建任何以 INDEX_KEY 為 UNIQUE 的約束（計畫 §3.4）。
- 工具訊息用繁體中文。

驗收：
- python -X utf8 .\tests\core_unit_test.py 與 pg_tools_test.py（無 DSN 模式）通過。
- node 兩個測試與 server roundtrip 測試照舊通過（證明編輯器本體未受影響）。
- 回報附上：pg_import --dry-run 對 fixture 的輸出、views.sql 其中一個 view 的節錄。

完成後回報並更新 docs/CODEX_PROMPTS.md 進度表。
```

---

## Prompt 5 — 側邊欄書表組切換 UI

```text
你是本專案的實作工程師。動手前先完整閱讀根目錄 CLAUDE.md，逐條對照 §4 UI/UX 原則
（本 prompt 是純 UI 工作，§4 全部適用）；§1 的「書表目錄唯一來源是 ALLRPT」也直接相關。
前置：Prompt 3 已完成（FORM_SETS 與 state.formSet 已存在）。

背景：舊系統把一個案件的書表分三欄顯示：A 系列（建照申請，本編輯器已完成）、
B 系列（施工管理／開竣工／變更起承監造）、C 系列（使用執照）＋ D 系列（拆除執照）。
現在要在側邊欄加「書表組」切換，一次整排替換資料群組（手風琴）清單。
B／C／D 的資料群組尚未實作（Prompt 6、7 的事），本次先給可用的切換架構與占位頁。

任務（依序）：

1. 擴充 FORM_SETS 為四組（tables 之後由 Prompt 6/7 填入，先給空陣列）：
   A: 建照申請、B: 施工管理、C: 使用管理、D: 拆除與其他。
   書表清單一律於執行期從 state.codebook.codeTypes.ALLRPT 依 code 分組取得
   （每筆有 label 與 mark），不得手抄清單。分組規則（已對目前 codebook 驗證）：
   - A 組 = code "A"（22 筆）。
   - B 組 = code "B"（14 筆，含 B13-2-2 變更起造人名冊(二)）＋ code "G"
     （B14-1～B14-5 施工勘驗系列 5 筆；舊系統畫面只列 B14-1，目錄仍以 ALLRPT 全量為準）。
   - C 組 = code "C"（13 筆）。
   - D 組 = code "D"（拆除執照 3 筆）＋ code "F"（建築物結構與設計專業技師簽證報告 1 筆，
     其 mark 為 BM_TEC，對應 data.txt 的 BM_TEC 表）＋ code "H"（農舍管制註記清冊、
     農舍管制註記清冊（異動書）2 筆）。
   - E（室內裝修）與縣市附表系列（I30、I40、I80 等）本次一律不顯示。

2. 側邊欄頂部新增書表組切換元件：
   - 四顆按鈕的分段切換（segmented control），顯示中文組名＋該組書表數
     （例如「A 建照申請 22」）。
   - 樣式只用 styles.css 既有 CSS 變數（--navy／--amber 等），不新增裸色碼；
     選中態要同時有色彩與 aria-pressed，不能只靠顏色。
   - 響應式：≤920px 時與現有側欄一樣轉為橫向可捲動（CLAUDE.md §4.11）。
   - 鍵盤可操作、有 aria-label。

3. 切換行為：
   - 切到 A：現有 11 個資料群組清單與工作區，行為與現在完全相同。
   - 切到 B／C／D：側欄群組清單清空、工作區顯示占位頁——組名標題、
     「此書表組尚未開放編輯」說明、該組書表目錄表格（mark＋label，取自 ALLRPT）、
     以及「資料仍完整保留於 data.txt，匯出不受影響」的提示。占位頁不得提供任何編輯操作。
   - 切換不得改動 state.tables 的任何資料；切回 A 時原本選取的群組、記錄與
     欄位搜尋字串要維持。
   - 重新整理後預設回 A 組（state.formSet 不落地 localStorage）。

4. 狀態列與匯出：不論目前在哪個書表組，載入／驗證／匯出行為都作用於完整案件
   （13 表全量），維持現狀。

5. tests/frontend_smoke_test.js 新增斷言：FORM_SETS 有 A/B/C/D 四組；
   index.html 含書表組切換元件的容器；ALLRPT 分組函式的輸出，與直接以 code 字母過濾
   codebook 所得的筆數一致（目前 codebook 應為 A 22、B 14＋G 5、C 13、D 3＋F 1＋H 2；
   斷言以 codebook 實際內容計算，不寫死魔法數，日後 codebook 再生也不會誤報）。

硬性限制：
- A 組的所有既有行為零回歸（這是驗收重點）。
- 不改 server.py。
- 文案繁體中文全形標點；不出現「TODO」「coming soon」等英文占位詞。

驗收：
- node --check、frontend smoke test、（啟動伺服器後）server roundtrip test 全通過。
- 手動流程並回報：載入真實 data.txt → 切到 B 看占位頁 → 切回 A 確認選取狀態保留 →
  編輯欄位 → 匯出，位元組與改動前匯出一致。
- 視覺檢查：桌面與 ≤920px 兩種寬度下切換元件都可用（回報附說明或截圖）。

完成後回報並更新 docs/CODEX_PROMPTS.md 進度表；
同步在 cpami-form-editor/README.md「已完成的功能」加一條書表組切換的說明。
```

---

## Prompt 6 — B 系列（施工管理）研究與實作

```text
你是本專案的實作工程師。動手前先完整閱讀根目錄 CLAUDE.md（§2 格式鐵則、§4 UI/UX、
§7 書表組擴充規則：「實作前必須先產出對應表研究文件；不在 13 表內的資料先列缺口、
經使用者決策後才能新增儲存格式」）。並精讀 CPAMI_指定書表_實用數據對應表.md 全文，
你要產出的研究文件就是它的 B 系列版本。前置：Prompt 5 已完成。

本 prompt 分三階段，階段之間有停止條件，不要一口氣做完。

【階段一：研究（只產出文件，不改程式）】

1. 從 web/codebook.json 的 codeTypes.ALLRPT 取出 B 組書表清單（已對目前 codebook 驗證）：
   code "B" 14 筆——B11-1 開工申報書、B11-2 開工展期、B11-3 承造人名冊、B11-4 監造人名冊、
   B12-1 變更起承監審查表、B13-1～B13-6（含 B13-2-2）變更起造／承造／監造申報書與名冊、
   B21-1 竣工展期、B21-2 開竣工查報表；另加 code "G" 5 筆——B14-1 勘驗申報書、
   B14-2 必需勘驗部份申報表、B14-3 監造報告表、B14-4 施工日誌、B14-5 督察紀錄表。

2. 分析每份書表的資料綁定：
   - 主要依據 cpami/Arch2016C/fsrp/ 下的 frxB*.fr3（含 frxB13_2_2.fr3、
     frxB14_1／frxB14_3／frxB14_4／frxB14_5.fr3）與 Link_frxB12_1.fr3
     （FastReport 模板，通常為 XML 文字；若遇二進位再用字串抽取）。
     注意：B14-2 在 fsrp 中沒有對應模板檔，研究文件要記錄這個缺漏。
   - 交叉比對 cpami/Arch2016C/Build.mdb 的資料表結構（唯讀，禁止改動 cpami/ 內任何檔案）。
   - 特別要確認：data.txt 13 表中的 BMSSC（開竣工相容資料）與 BM_TEC（專業技師）
     被哪些 B 書表使用、用到哪些欄位；BMSP03（監造）、BMSP04（承造）在 B 書表的重用情形。
   - fsrp 另有 frxBM_TEC.fr3（F 組「建築物結構與設計專業技師簽證報告」，ALLRPT 的 mark
     即為 BM_TEC）：它的顯示歸組屬 Prompt 7，但既然本次要研究 BM_TEC 表欄位，
     一併分析其綁定並寫進研究文件。

3. 產出根目錄 CPAMI_B系列書表_數據對應表.md，格式比照 CPAMI_指定書表_實用數據對應表.md：
   結論（B 系列實際使用哪些表）、每份書表與資料表對應表格、報表計算欄位回推、
   各表實用欄位清單（欄名、中文意義、格式）、已確認代碼、
   以及【缺口清單】：B 書表需要但不在 data.txt 13 表內的資料表與欄位，
   每項標注（a）它在舊系統存在哪裡（b）建議的處理方式。

【停止條件】完成階段一後，若缺口清單非空，先回報並停止，等使用者決策
（依 POSTGRES_INTEGRATION_PLAN.md §5：擴充方向是案件 payload 加頂層鍵＋schema 升版，
但要不要做、做哪些，由使用者決定）。缺口清單為空或使用者已決策後才進入階段二。

【階段二：實作 13 表範圍內的 B 組編輯】

4. 依研究結果在 app.js 的 TABLE_CONFIG 新增 B 組會用到、目前尚未顯示的資料群組
   （預期至少 BMSSC 與 BM_TEC，以研究結果為準）：
   - 欄位定義用既有 DSL（F/N/D/C/Y/M/S）；中文欄名、hint、notice 的密度比照既有群組。
   - 代碼欄查 FIELD_CODEBOOK 能對上的 CODE_TYPE（BM_TEC 的 TEC_ITEM/TEC_TYPE 已有
     CODE_OPTIONS 備援值可參考；codebook 的 BMTEC/TEC 等類型要實際核對）。
   - 重複資料表補 BULK_FIELDS 定義（挑最常批次輸入的欄位）。
   - forms 欄位填該群組被哪些 B 書表使用（依研究文件）。

5. FORM_SETS.B.tables 填入 B 組群組清單（可包含與 A 共用的群組，如 BMSP03/BMSP04；
   同一群組在兩組出現時就是同一份資料的同一個編輯頁，只是導覽入口不同）。
   佔位頁邏輯改為：tables 非空的組直接顯示群組清單與編輯區。

6. 驗證規則：研究中確認的 B 表數字欄加入 NUMERIC_FIELDS 時，先以 warning 等級處理
   （validate_tables 的 warnings），不要直接作 errors——避免既有真實檔案突然不能匯出；
   在研究文件記錄哪些欄位建議日後升級為 error。

7. 測試與文件：
   - frontend smoke test：B 組 tables 非空、新群組欄位數斷言。
   - core_unit_test：fixture 加入 BMSSC/BM_TEC 各至少一筆虛構記錄後 roundtrip 仍位元組一致
     （fixture 由 make_fixture.py 重新產生）。
   - README「已完成的功能」與 CLAUDE.md §7 的書表組現況同步。

硬性限制：
- cpami/ 目錄唯讀；分析用的暫存腳本放 scratch 或用完即刪，不提交。
- 位元組級 roundtrip 不可退讓；13 表、596 欄結構不得增減（缺口資料未經決策不得實作）。
- 新增 UI 全面遵守 CLAUDE.md §4（選項門檻 5、_OLD 收合、批次表格慣例……）。

驗收：
- 三套測試（node --check、smoke、roundtrip）＋core_unit_test 全通過。
- 手動：切到 B 組編輯 BMSSC 欄位→匯出→重新載入，值保留；A 組零回歸。
- 研究文件完整且缺口清單有明確結論。

完成後回報（階段一結束時先回報一次），並更新 docs/CODEX_PROMPTS.md 進度表。
```

---

## Prompt 7 — C／D 系列（使用管理、拆除）研究與實作

```text
你是本專案的實作工程師。動手前先完整閱讀根目錄 CLAUDE.md 與
CPAMI_B系列書表_數據對應表.md（Prompt 6 的產出），本次以完全相同的方法論處理 C／D 系列。
前置：Prompt 6 已完成。

任務：

1.【研究】比照 Prompt 6 階段一，產出根目錄 CPAMI_CD系列書表_數據對應表.md：
   - C 系列（C11-1 使用執照申請表、C11-2／C11-2-2 起造人名冊(三)(四)、C12-1 使照審查表、
     C21-x 變更使用執照系列、C22-x 變更使用審查／勘驗／委託／昇降設備；以 ALLRPT 為準）。
   - D 系列（D11-1 拆除執照申請書、D11-2 申請人名冊、D13-1 拆除執照審查表）。
   - 特殊書表（已確認存在於 ALLRPT）：code "F"「建築物結構與設計專業技師簽證報告」
     （mark 為 BM_TEC，模板 frxBM_TEC.fr3，Prompt 6 已分析過綁定）與 code "H"
     「農舍管制註記清冊」「農舍管制註記清冊（異動書）」——分析其資料來源，
     並確認 Prompt 5 把它們併入 D 組顯示的安排是否要調整。
   - 分析來源同樣以 fsrp/frxC*.fr3、frxD*.fr3、Link_frxC12_1.fr3、Link_frxD13_1.fr3
     與 Build.mdb 為準；C21-3 檢討項目簽證表注意 codebook 已有 C21_3 代碼類型可用。
   - 同樣要有【缺口清單】；非空先回報停止，等使用者決策。

2.【實作】依研究結果與使用者決策：
   - TABLE_CONFIG 補齊 C／D 組需要且在 13 表內的群組設定（大量群組預期與 A 共用，
     如 BMSBASE、BMSP01；共用即同一份資料，只是多一個導覽入口）。
   - FORM_SETS.C.tables、FORM_SETS.D.tables 填入清單；特殊書表依研究結論歸組。
   - 驗證規則新增一律先 warning（同 Prompt 6 第 6 點）。

3.【測試與文件】比照 Prompt 6 第 7 點：smoke test、fixture 擴充後 roundtrip、
   README 與 CLAUDE.md §7 現況同步。

硬性限制與驗收標準與 Prompt 6 完全相同（cpami/ 唯讀、roundtrip 不可退讓、
13 表結構不得增減、A／B 組零回歸、CLAUDE.md §4 全面適用）。

完成後回報（研究階段結束時先回報一次），並更新 docs/CODEX_PROMPTS.md 進度表。
全部完成後，把四組書表組的實作現況整理回 CLAUDE.md §7 與 README。
```

# CLAUDE.md — CPAMI 書表資料編輯器：專案唯一原則文件

本檔是**本專案唯一的原則文件**。`AGENTS.md` 只是指向本檔的指標，不得另行累積規則。
任何 AI 代理（Claude、Codex 或其他）與人工協作者，開始分析或改動之前必須先讀完本檔。

## 1. 專案定位與架構

以瀏覽器編輯內政部營建署（CPAMI）建照電子申請舊系統的 `data.txt`（CP950／Big5、13 表、596 欄、固定欄序）。一份 `data.txt` 就是**一個案件**；A（建照申請）、B（施工管理）、C（使用管理）、D（拆除）等「書表組」是同一案件資料的不同檢視，不是不同案件。

| 路徑 | 角色 |
|---|---|
| `cpami-form-editor/web/`（index.html、app.js、styles.css、codebook.json） | 前端。vanilla JS，無框架、無 npm 依賴、無建置步驟 |
| `cpami-form-editor/server.py` | 本機伺服器。只用 Python 標準庫，須可在離線 Windows 工作站執行 |
| `cpami-form-editor/tests/` | node 煙霧測試＋伺服器 roundtrip 測試 |
| `cpami-form-editor/schema/` | `data_txt_schema.json` 定義 13 表；`case_extension_schema.json` 定義完整案件 JSON 的 13 表外資料 |
| `cpami-form-editor/tools/export_codebook.ps1` | 從舊系統 MDB 重新產生 codebook.json（32 位元 PowerShell） |
| `cpami/Arch2016C/` | 舊系統原程式（fr3 報表模板、bldcode.mdb、Build.mdb）。**唯讀參考，禁止修改，不入版控** |
| 根目錄 `data.txt` | 目前工作案件。**含真實個資，絕不入版控** |
| `CPAMI_data_txt_欄位與代碼對應表.md`、`CPAMI_指定書表_實用數據對應表.md` | 欄位與代碼語意的依據文件（ground truth） |
| `docs/` | 規劃文件與 Codex 工作指令 |

分層鐵則：

- **格式知識只住在伺服器端**（`server.py`，未來抽為 `cpami_core.py`）：CP950 解析、驗證、序列化。前端永遠只碰 JSON 與 UTF-8，不做任何編碼工作。
- **代碼唯一來源是 `web/codebook.json`**（22,383 筆舊系統代碼＋1,626 筆臺中市官方地段，43 種 CODE_TYPE）。只能用 `export_codebook.ps1` 重新產生，不得手改內容；`app.js` 的 `CODE_OPTIONS` 僅作缺漏備援。
- **書表目錄的唯一來源是 codebook 的 `ALLRPT`**（109 筆）。code 欄的分組：`A` 建照申請 22、`B` 施工管理 14（含 B13-2-2）、`C` 使用管理 13、`D` 拆除執照 3、`E` 室內裝修 9、`F` 技師簽證報告 1（mark 為 BM_TEC）、`G` B14 施工勘驗系列 5、`H` 農舍管制註記清冊 2，其餘為縣市附表（I30、I40、I80 等）。新增書表組時從這裡取清單，不要手抄畫面截圖。
- 編輯器執行期禁止引入任何資料庫依賴；PostgreSQL 相關只允許存在 `db/` 與 `tools/`（見 `docs/POSTGRES_INTEGRATION_PLAN.md`）。

## 2. data.txt 格式鐵則（違反即擋，不可協商）

1. 13 表全保留、順序與模板一致；每表欄位集合與順序固定，合計 596 欄。
2. 語法：`@TableName 表名`／`@RecordBegin`／`@d 欄名 "值"`／`@RecordEnd`；CRLF 換行，檔尾保留 CRLF。
3. 編碼 CP950／Big5、無 BOM。無法表示的字元必須報錯，不可默默變 `?`。
4. 值內禁止半形雙引號與實體換行（舊格式無跳脫規則）。
5. 空值是 `""`；不可擅改為 `"0"`。所有值一律是字串——前導零（如 `LAST_MODIFY` 的 `00001`）與「空白 vs 0」的差異都必須保真。
6. `INDEX_KEY` 全 13 表一致；子表 `person_seq`／`PERSON_SEQ`／`Person_seq` 為正整數且同表不重複。
7. 數字欄純數字（不含單位、千分位）；日期多為民國 `yyyMMdd` 7 碼。
8. **位元組級 roundtrip 是最高驗收標準**：載入一份合法 data.txt 不經修改直接匯出，必須逐位元組相同（`tests/server_roundtrip_test.py` 驗證）。
9. 欄名（含 `person_seq`、`eMail` 等大小寫不一致者）是舊系統契約，禁止「訂正」拼寫或大小寫。
10. 前端未顯示的系統／相容欄位（含 `BM_TEC`、`BMSSC`）在載入、編輯、匯出全程保留原值。
11. 匯出時即使某個子表沒有使用者資料，也要輸出一筆完整欄序的空白記錄；不可只寫表名，已通過主檔驗證的稀疏案件也必須能重新匯入並核對 596 欄。

欄位語意、代碼對應、報表計算欄位回推，一律以根目錄兩份對應表文件為準；文件沒寫的，回 `cpami/Arch2016C/fsrp/frx*.fr3` 與 MDB 查證，不要猜。

## 3. 個資與安全紅線

- 根目錄 `data.txt` 是真實案件（身分證字號、地址、電話）：不得提交進 git、不得貼進雲端服務、不得出現在測試碼與文件範例中。
- 測試與範例一律用虛構資料，沿用既有慣例：「範例建設股份有限公司」「王範例」「A123456789」「臺中市範例區範例路」。
- `cpami/` 是第三方程式與真實案件輸出：唯讀、不入版控。
- 對外連線的一次性權杖機制（`authorize_request`）不得移除或弱化；本服務無 HTTPS，文件必須持續提醒以 VPN／可信區網使用。

## 4. UI/UX 設計原則（新增任何頁面、資料群組、書表組一律遵循）

1. **中文優先**：主畫面顯示中文欄位名稱；原始欄名（`.raw-field`／`.nav-raw`）預設隱藏，由「顯示原始欄名」切換，狀態存 localStorage `cpami-show-raw-fields`。
2. **選項門檻 5 筆**（`OPTION_MODAL_THRESHOLD`）：依當下連動條件計算實際選項數，≤5 用原生 `<select>`（含全部 Y／N 欄），>5 用固定高度（`min(430px, 52vh)`）搜尋視窗——搜尋框固定在清單上方、空格分隔多關鍵字 AND 過濾、`↑`/`↓`/`Enter` 鍵盤操作、「最近使用」最多 5 筆（localStorage `cpami-picker-recent`）。
3. **選項排序**：顯示名稱為主鍵；名稱開頭是中文數字（含壹、貳、拾、佰等大寫）依數值排序，其餘依繁體中文筆畫（`Intl.Collator("zh-Hant-u-co-stroke")`），同名再比代碼。
4. **連動查碼**：縣市 `BMPAS` → 行政區 `DIST` → 地段 `SECTION` 逐層過濾；代碼選定後自動帶出配對的 `*_DESC`／`*_T`，但**只填空白、不覆蓋既有值**。
5. **收合節奏**：欄位分區用 `<details class="field-section">`；`_OLD`（原核准）區段預設收合；「填寫提醒」「填寫說明」預設收起；提供「全部收合／展開」；開合狀態記在 `state.sectionOpen`。
6. **Modal 慣例**：`<dialog>` ＋ `.dialog-head`（eyebrow＋標題＋右上 × 關閉）＋ `.dialog-actions`；點擊背景可關閉；危險操作（清空、刪除多列）先出警告 modal 並寫明影響範圍。
7. **版面穩定**：`html { overflow-y: scroll; scrollbar-gutter: stable }`；modal 清單預留捲軸空間；內容寬度不得跳動。
8. **批次表格**：全選↔取消全選同一顆按鈕、新增 1／10 列、複製／刪除勾選列、支援 Excel／TSV／CSV 矩形貼上、首列若為原始欄名或中文欄名自動視為標題、欄寬依欄位類型緊湊化（`bulkColumnClass`）、關閉時自動保留修改並重排 `person_seq`／`SPOKESMAN`。
9. **狀態回饋**：statusbar 三態（ok／warn／error）＋來源名稱；toast 約 4 秒自動消失；任何修改立即 `setStatus("...尚未匯出", "warn")`。
10. **色彩 tokens**：一律使用 `styles.css` 的 CSS 變數——`--navy` 頂欄、`--amber` 主要動作、`--paper`／`--canvas` 背景、`--green`／`--red` 狀態、danger 按鈕紅字淡紅底。不要引入新的裸色碼。
11. **響應式**：桌面側欄固定 224px；≤920px 側欄轉為橫向捲動列（項目 min-width 165px）。新側邊欄元件必須同時處理這兩種型態。
12. **資料保全**：新增／複製記錄時清空 `識別碼`、`CR_DATE`、`UP_DATE`、`OP_USER`；`person_seq` 依列序重編；`SPOKESMAN` 首列 `Y` 其餘 `N`；「清空本頁」只清目前群組且保留案件 `INDEX_KEY`。
13. **無障礙**：互動元件要有 `aria-label`／`aria-pressed`；動態清單用 `role="listbox"`／`role="option"`；toast 區 `aria-live="polite"`。

## 5. 程式風格

- `app.js` 單一檔案，區段順序：欄位 DSL（`F`/`N`/`D`/`C`/`Y`/`M`/`S`）→ `TABLE_CONFIG` 等設定表 → `state` → 工具函式 → `render*` → 事件註冊 → `bootstrap()`。新功能沿用同一 DSL 與區段結構，不引入模組打包。
- 所有插入 DOM 的動態字串必經 `escapeHtml`。
- UI 文案：繁體中文、全形標點；面積用「㎡」、長度用「m」；按鈕文字精簡（「新增 10 列」「一鍵帶入本次地號」風格）。
- Python：`from __future__ import annotations`、型別註記、只用標準庫；格式錯誤一律拋 `DataTxtError` 帶中文行號訊息。
- 註解只寫「程式看不出來的限制」（如 BUILDING_NO 在不同表的語意差異），不寫流水帳。
- Commit 訊息沿用 `feat:`／`fix:`／`refactor:`／`docs:` 前綴。

## 6. 測試與驗收

在 `cpami-form-editor/` 目錄執行：

- `node --check .\web\app.js` — 語法檢查，改 app.js 必跑。
- `node .\tests\frontend_smoke_test.js` — 前端煙霧測試（vm 載入 app.js 頂部區段），改前端必跑。
- 先啟動 `python -X utf8 .\server.py`，再跑 `python -X utf8 .\tests\server_roundtrip_test.py` — 含位元組級 roundtrip，改伺服器或匯出邏輯必跑。
- `tests/network_access_test.py` — 權杖／回環驗證，改連線與授權邏輯時跑。

規則：改了行為就同步改測試斷言；測試不得依賴真實個資（過渡期間 roundtrip 測試仍讀根目錄 data.txt，遷移到虛構 fixture 是 `docs/CODEX_PROMPTS.md` Prompt 1 的工作）。

## 7. 發展路線與規劃文件索引

- **PostgreSQL 對接預備**：`docs/POSTGRES_INTEGRATION_PLAN.md`——資料模型、案件 JSON 封套、DDL 草案、預備工項。編輯器本體保持可離線單機使用；對接走「案件文件」交換層。
- **Codex 工作指令集**：`docs/CODEX_PROMPTS.md`——依編號逐一執行，每個 Prompt 自帶驗收標準。
- **書表組擴充（A → B → C／D）**：以側邊欄「書表組」切換整排資料群組清單；A 組（現有 11 群組）行為不得回歸。B／C／D 組實作前必須先產出對應表研究文件（比照 `CPAMI_指定書表_實用數據對應表.md` 的格式），且不在 data.txt 13 表內的資料一律先列缺口、經使用者決策後才能新增儲存格式。
- **目前書表組現況**：A 組 11 群組維持既有操作；B 組已開放共用資料、`BMSSC`、`BM_TEC`，以及案件封套 `extraTables` 的 `BMSROAD/BMSCHK/BMSSCRP/RPTPHOTO`。完整案件 JSON 保存 13 表外資料；data.txt 匯出仍只能且必須完整輸出原 13 表、596 欄。C／D 組尚待 Prompt 7 研究。

## 8. 文件維護規則

- 原則變更只改本檔；`AGENTS.md` 永遠只是指標。
- 功能現況記在 `cpami-form-editor/README.md`（「已完成的功能」段落），完成新功能要同步。
- 完成 `docs/CODEX_PROMPTS.md` 的工項後，在該檔勾銷對應項目並記錄日期。
- 欄位／代碼的新查證結果寫回根目錄兩份對應表文件，不要散落在程式註解。

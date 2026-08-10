# CLAUDE.md — CPAMI 書表資料編輯器：專案唯一原則文件

本檔是**本專案唯一的原則文件**。`AGENTS.md` 只是指向本檔的指標，不得另行累積規則。
任何 AI 代理（Claude、Codex 或其他）與人工協作者，開始分析或改動之前必須先讀完本檔。

## 1. 專案定位與架構

以瀏覽器編輯內政部營建署（CPAMI）建照電子申請舊系統的 `data.txt`（CP950／Big5、固定欄序；表的集合依案件內容而定，新建案件用的模板是 13 表 596 欄，詳見 §2 第 1 條）。一份 `data.txt` 就是**一個案件**；A（建照申請）、B（施工管理）、C（使用管理）、D（拆除）等「書表組」是同一案件資料的不同檢視，不是不同案件。

本專案已以 **MIT 授權公開**（<https://github.com/Archwiz-boss/BOOKTIRE>）。對外文件見
`README.md`（使用者）、`docs/使用手冊.md`（白話操作）、`docs/開發指南.md`（二次開發）、
`AGENTS.md`（AI 代理進場）、`NOTICE.md`（第三方資料來源）。

| 路徑 | 角色 |
|---|---|
| `cpami-form-editor/web/`（index.html、app.js、styles.css、codebook.json） | 前端。vanilla JS，無框架、無 npm 依賴、無建置步驟 |
| `cpami-form-editor/cpami_core.py` | 格式引擎：CP950 解析、驗證、序列化。唯一真實來源 |
| `cpami-form-editor/web_api.py` | 各 API 操作的實作。**不得引入任何 HTTP／伺服器／瀏覽器相依**，因為桌面版與 Pyodide 試用版共用它 |
| `cpami-form-editor/server.py` | 本機伺服器，只做傳輸／授權／靜態檔。只用 Python 標準庫，須可在離線 Windows 工作站執行 |
| `cpami-form-editor/launcher.py` | 雙擊啟動器（exe 入口）：預設只綁 127.0.0.1、自動找可用埠、自動開瀏覽器 |
| `cpami-form-editor/app_paths.py` | 原始碼執行與 PyInstaller 凍結後的資源／可寫入路徑差異 |
| `cpami-form-editor/tests/` | node 煙霧測試＋伺服器 roundtrip＋Pyodide 試用版測試 |
| `cpami-form-editor/schema/` | `data_txt_schema.json` 定義欄序契約與新建案件的 13 表模板；`case_extension_schema.json` 定義完整案件 JSON 在 data.txt 各表之外的資料 |
| `cpami-form-editor/tools/export_codebook.ps1` | 從舊系統 MDB 重新產生 codebook.json（32 位元 PowerShell） |
| `cpami-form-editor/tools/diagnose_data_txt.py` | 診斷 `data.txt`／ZIP 為何載不進來：編碼判定、造字清點、控制字元、行號與病因。輸出含個資，只在本機看 |
| `web-demo/` | 線上試用版的載入畫面與 fetch 轉接層（Pyodide） |
| `tools/build_exe.ps1`、`tools/build_demo.py` | 打包 Windows exe；組裝 GitHub Pages 靜態站 |
| `cpami/Arch2016C/` | 舊系統原程式（fr3 報表模板、bldcode.mdb、Build.mdb）。**唯讀參考，禁止修改，不入版控** |
| 根目錄 `data.txt` | 目前工作案件。**含真實個資，絕不入版控** |
| `CPAMI_data_txt_欄位與代碼對應表.md`、`CPAMI_指定書表_實用數據對應表.md` | 欄位與代碼語意的依據文件（ground truth） |
| `CPAMI_二維封包擴充表_數據對應表.md` | 二維封包多帶的表（`BDMLIST`、`BDMSIGN` 等）：匯出機制、未建模表的鍵值與欄位研判、待查缺口 |
| `docs/` | 對外文件、規劃文件與 Codex 工作指令 |

> `cpami/` 與根目錄 `data.txt` **不在公開版控庫內**；clone 下來不會有。
> 需要查證 `.fr3` 或 MDB 而手上沒有時，直接說明缺件，不要推測。

分層鐵則：

- **格式知識只住在 `cpami_core.py`**：CP950 解析、驗證、序列化。前端永遠只碰 JSON 與 UTF-8，不做任何編碼工作。
- **`web_api.py` 是桌面版與線上試用版的共用實作**：格式規則只有一份，`server.py` 與 `web-demo/demo-adapter.js` 都只是它的外殼。往 `web_api.py` 加傳輸層相依會直接讓試用版失效。
- **代碼唯一來源是 `web/codebook.json`**（22,383 筆舊系統代碼＋1,626 筆臺中市官方地段，43 種 CODE_TYPE，另含從 `Build.mdb` 唯讀萃取的臺中規定備註、新版適用法令與常用文字）。只能用 `export_codebook.ps1` 重新產生，不得手改內容；`app.js` 的 `CODE_OPTIONS` 僅作缺漏備援。
- **書表目錄的唯一來源是 codebook 的 `ALLRPT`**（109 筆）。code 欄的分組：`A` 建照申請 22、`B` 施工管理 14（含 B13-2-2）、`C` 使用管理 13、`D` 拆除執照 3、`E` 室內裝修 9、`F` 技師簽證報告 1（mark 為 BM_TEC）、`G` B14 施工勘驗系列 5、`H` 農舍管制註記清冊 2，其餘為縣市附表（I30、I40、I80 等）。新增書表組時從這裡取清單，不要手抄畫面截圖。
- 一般模式 `server.py` 禁止引入資料庫依賴；只有使用獨立 `sqlite_server.py`／`Start_CPAMI_Editor_SQLite.bat` 時，才允許以 Python 標準庫 SQLite 保存共用範本。SQLite 不得保存完整案件，執行期檔案只放在已忽略版控的 `runtime/`。PostgreSQL 案件整合仍只放在 `db/` 與 `tools/`（見 `docs/POSTGRES_INTEGRATION_PLAN.md`）。

## 2. data.txt 格式鐵則（違反即擋，不可協商）

1. **表的集合與順序以原檔為準，不以模板為準。** 模板的 13 表 596 欄是從單一份範例檔
   萃取的，真實舊系統會依案件內容增減表：沒填監造人就不輸出 `BMSP03`，二維條碼封包
   還會多帶 `BDMLIST`（圖說清單）、`BDMSIGN`（電子簽章）、`BMSRPTSELF`、`BMELVTR`。
   載入時記下原檔版面（`documentLayout`），匯出時原順序寫回——**不補原檔沒有的表，
   也不丟原檔多出的表**（`passthroughTables` 唯讀保留）。匯出的檔案還要能匯回舊系統，
   多一張少一張都可能被退。**新建空白案件沒有原檔版面，才用模板的 13 表 596 欄。**
   模板與原檔都有的表，欄位集合與順序必須完全一致——那才是真正的契約，不符即擋。
2. 語法：`@TableName 表名`／`@RecordBegin`／`@d 欄名 "值"`／`@RecordEnd`；CRLF 換行，檔尾保留 CRLF。
3. 編碼 CP950／Big5、無 BOM。無法表示的字元必須報錯，不可默默變 `?`。
   基準是 **Windows 版 CP950**，不是 Python 內建的 `cp950` codec——後者拒絕 Big5 造字區
   （罕用字姓名、地段用字），會讓真實案件整份載不進來。`cpami_core.py` 的
   `decode_cp950`／`encode_cp950` 補上這段對照（已與 `MultiByteToWideChar` 逐格核對），
   一律用它們，不要再直接寫 `raw.decode("cp950")`。造字在畫面上是空白方框屬正常，
   位元組必須原樣保留。唯一無法逐位元組還原的是 Big5 的 10 組重複碼
   （`BIG5_DUPLICATE_SEQUENCES`，如 `0xA2CC` 的「十」）——CP950 只編得回一種寫法，
   舊系統自己讀寫也是如此，因此照舊正規化，但載入時要用警告點名。
4. 值內禁止半形雙引號（舊格式無跳脫規則，寫出去會讓欄位邊界無法判讀）。
   **換行不在禁止之列**：`A12_TITTLE` 這類 Access LongText／memo 欄位，舊系統本來就會
   寫出多行值。解析器遇到結尾少了雙引號的 `@d`／`@m` 會續讀下一行直到收尾，換行原樣
   留在值內、匯出時原樣寫回，位元組級 roundtrip 不受影響；載入時以警告點名。
   另外，切行只能認 `\r\n`／`\r`／`\n`（`_logical_lines`）——**禁止用 `str.splitlines()`**，
   它還會在 `\x0b`、`\x0c`、`\x1c`–`\x1e` 斷行，而那些字元是 memo 欄位的資料。
5. 空值是 `""`；不可擅改為 `"0"`。所有值一律是字串——前導零（如 `LAST_MODIFY` 的 `00001`）與「空白 vs 0」的差異都必須保真。
6. `INDEX_KEY` 全表一致；子表 `person_seq`／`PERSON_SEQ`／`Person_seq` 為正整數且同表不重複。
7. 數字欄純數字（不含單位、千分位）；日期多為民國 `yyyMMdd` 7 碼。
8. **位元組級 roundtrip 是最高驗收標準**：載入一份合法 data.txt 不經修改直接匯出，必須逐位元組相同（`tests/server_roundtrip_test.py` 驗證）。
9. 欄名（含 `person_seq`、`eMail` 等大小寫不一致者）是舊系統契約，禁止「訂正」拼寫或大小寫。
10. 前端未顯示的系統／相容欄位（含 `BM_TEC`、`BMSSC`）在載入、編輯、匯出全程保留原值。
11. 匯出時即使某個子表沒有使用者資料，也要輸出一筆完整欄序的空白記錄；不可只寫表名，已通過主檔驗證的稀疏案件也必須能重新匯入並核對 596 欄。**此條只適用於原檔（或新建案件）本來就有的表**——原檔沒有的表不得為了湊滿 13 表而補出來，見第 1 條。
12. 從 ZIP 載入後若 `data.txt` 未改動，匯出必須逐位元組回傳原 ZIP；有改動才替換 `data.txt`。舊二維的小型封裝必須維持一般 ZIP 2.0，不得將其他小檔強制標成 ZIP64，否則舊系統會以錯誤 517 拒絕匯入。

欄位語意、代碼對應、報表計算欄位回推，一律以根目錄兩份對應表文件為準；文件沒寫的，回 `cpami/Arch2016C/fsrp/frx*.fr3` 與 MDB 查證，不要猜。

## 3. 個資與安全紅線

- 根目錄 `data.txt` 是真實案件（身分證字號、地址、電話）：不得提交進 git、不得貼進雲端服務、不得出現在測試碼與文件範例中。
- 測試與範例一律用虛構資料，沿用既有慣例：「範例建設股份有限公司」「王範例」「A123456789」「臺中市範例區範例路」。
- `cpami/` 是第三方程式與真實案件輸出：唯讀、不入版控。
- `authorize_request` 僅允許回環位址、RFC 1918 私有 IPv4、IPv6 ULA／link-local 免權杖；其他來源的一次性權杖與 HttpOnly／SameSite Cookie 機制不得移除或弱化。本服務無 HTTPS，文件必須持續提醒以 VPN／可信內網使用。

## 4. UI/UX 設計原則（新增任何頁面、資料群組、書表組一律遵循）

1. **中文優先**：主畫面顯示中文欄位名稱；原始欄名（`.raw-field`／`.nav-raw`）預設隱藏，由「顯示原始欄名」切換，狀態存 localStorage `cpami-show-raw-fields`。
2. **選項門檻 5 筆**（`OPTION_MODAL_THRESHOLD`）：依當下連動條件計算實際選項數，≤5 用原生 `<select>`（含全部 Y／N 欄），>5 用固定高度（`min(430px, 52vh)`）搜尋視窗——搜尋框固定在清單上方、空格分隔多關鍵字 AND 過濾、`↑`/`↓`/`Enter` 鍵盤操作、「最近使用」最多 5 筆（localStorage `cpami-picker-recent`）。
3. **選項排序**：顯示名稱為主鍵；名稱開頭是中文數字（含壹、貳、拾、佰等大寫）依數值排序，其餘依繁體中文筆畫（`Intl.Collator("zh-Hant-u-co-stroke")`），同名再比代碼。
4. **連動查碼**：縣市 `BMPAS` → 行政區 `DIST` → 地段 `SECTION` 逐層過濾；代碼選定後自動帶出配對的 `*_DESC`／`*_T`，但**只填空白、不覆蓋既有值**。
5. **收合節奏**：欄位分區用 `<details class="field-section">`；`_OLD`（原核准）區段預設收合；「填寫提醒」「填寫說明」預設收起；提供「全部收合／展開」；開合狀態記在 `state.sectionOpen`。
6. **Modal 慣例**：`<dialog>` ＋ `.dialog-head`（eyebrow＋標題＋右上 × 關閉）＋ `.dialog-actions`；點擊背景可關閉；危險操作（清空、刪除多列）先出警告 modal 並寫明影響範圍。
7. **版面穩定**：`html { overflow-y: scroll; scrollbar-gutter: stable }`；modal 清單預留捲軸空間；內容寬度不得跳動。
8. **批次表格**：全選↔取消全選同一顆按鈕、新增 1／10 列、複製／刪除勾選列、支援 Excel／TSV／CSV 矩形貼上、首列若為原始欄名或中文欄名自動視為標題、欄寬依欄位類型緊湊化（`bulkColumnClass`）、關閉時自動保留修改並重排 `person_seq`／`SPOKESMAN`。有本次／原核准配對的表格須沿用 `COPY_CURRENT_TO_OLD` 切換兩側與整批帶入；逐列及逐欄差異都以紅點標示，空白與 `0` 不得視為相同。
9. **狀態回饋**：statusbar 三態（ok／warn／error）＋來源名稱；toast 約 4 秒自動消失；任何修改立即 `setStatus("...尚未匯出", "warn")`。
10. **色彩 tokens**：一律使用 `styles.css` 的 CSS 變數——`--navy` 頂欄、`--amber` 主要動作、`--paper`／`--canvas` 背景、`--green`／`--red` 狀態、danger 按鈕紅字淡紅底。不要引入新的裸色碼。
11. **響應式**：桌面側欄固定 224px；≤920px 側欄轉為橫向捲動列（項目 min-width 165px）。新側邊欄元件必須同時處理這兩種型態。
12. **資料保全**：新增／複製記錄時清空 `識別碼`、`CR_DATE`、`UP_DATE`、`OP_USER`；`person_seq` 依列序重編；`SPOKESMAN` 首列 `Y` 其餘 `N`；「清空本頁」只清目前群組且保留案件 `INDEX_KEY`。
13. **無障礙**：互動元件要有 `aria-label`／`aria-pressed`；動態清單用 `role="listbox"`／`role="option"`；toast 區 `aria-live="polite"`。
14. **範本與全案清空**：共用範本只能保存後端 allowlist 內的非空白人員／單位、案件備註或書表長文字欄位；預設套用只填空白值，案件備註則新增一列或使用既有空白列，覆蓋既有值必須由使用者明確勾選。全案清空須用警告 Modal，清空後才套用非空白預設範本；任何 data.txt、ZIP 或完整案件 JSON 匯入都直接覆寫案件，不得混入預設值。

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
- `python -X utf8 .\tests\sqlite_template_test.py` — SQLite 範本 allowlist、預設唯一性、生命週期與 HTTP API；改範本功能必跑。
- 先啟動 `python -X utf8 .\server.py`，再跑 `python -X utf8 .\tests\server_roundtrip_test.py` — 含位元組級 roundtrip，改伺服器或匯出邏輯必跑。
- `tests/network_access_test.py` — 權杖／回環驗證，改連線與授權邏輯時跑。
- `node ./tests/demo_pyodide_test.mjs` — 線上試用版在 Pyodide 裡的位元組級 roundtrip；改 `cpami_core.py`、`web_api.py` 或 `web-demo/demo-adapter.js` 時跑（需先 `npm install`，pyodide 是唯一的測試相依）。

規則：改了行為就同步改測試斷言；測試主體只使用版控內的虛構 fixture，不得依賴真實個資。根目錄真實 `data.txt` 的 roundtrip 只在檔案存在時作本機附加驗證。

## 7. 發展路線與規劃文件索引

- **PostgreSQL 對接預備**：`docs/POSTGRES_INTEGRATION_PLAN.md`——資料模型、案件 JSON 封套、DDL 草案、預備工項。編輯器本體保持可離線單機使用；對接走「案件文件」交換層。
- **Codex 工作指令集**：`docs/CODEX_PROMPTS.md`——依編號逐一執行，每個 Prompt 自帶驗收標準。
- **書表組擴充（A → B → C／D）**：以側邊欄「書表組」切換整排資料群組清單；A 組（現有 11 群組）行為不得回歸。B／C／D 組實作前必須先產出對應表研究文件（比照 `CPAMI_指定書表_實用數據對應表.md` 的格式），且不在 data.txt 13 表內的資料一律先列缺口、經使用者決策後才能新增儲存格式。
- **目前書表組現況**：A／B／C／D 四組皆已開放；C 組新增 `C21_3`、`BMELVTR`，D 組共用拆除、`BM_TEC` 與農舍管制資料。案件封套 `extraTables` 現有 `BMSROAD/BMSCHK/BMSSCRP/RPTPHOTO/C21_3/BMELVTR`，這是**編輯器自己的擴充資料**，只存在完整案件 JSON。
- **原檔 data.txt 內的表一律留在 data.txt 這一側**：即使某張表（如 `BMELVTR`）在擴充結構裡也有定義，從 data.txt 讀進來的那份仍走 `passthroughTables` 唯讀保留、原位寫回。同一份資料不能有兩個家，否則匯出不是重複寫入就是漏寫。
- **尚未建模的表**：`BDMLIST`（圖檔清單，26 欄）、`BDMSIGN`（圖章／電子簽章，13 欄）、`BMSRPTSELF`（自主檢查表作答 JSON，9 欄）目前唯讀保留、畫面不顯示。研究文件見 `CPAMI_二維封包擴充表_數據對應表.md`（含匯出機制、鍵值、欄位研判與待查缺口）；要開放編輯必須先補齊該檔的待查項目，經使用者決策後才動。
- **罕用字（造字）**：`bldcode` 的 `CODE_TYPE='UNC'` 記錄「Big5 造字 ↔ 真實 Unicode」14 筆，已實作於 `cpami_core.py` 的 `UNC_EUDC_TO_UNICODE`——解碼換成真實字、編碼換回造字位元組。不在此表內的造字保留為私人使用區字元並以警告點名。

## 8. 文件維護規則

- 原則變更只改本檔；`AGENTS.md` 是給 AI 代理的進場指引，只做導引與摘要，不累積新規則。
- 對外文件分工：`README.md` 給使用者（白話、少技術用語）、`docs/使用手冊.md` 給操作者、`docs/開發指南.md` 給二次開發者、`NOTICE.md` 記第三方資料來源。改動影響到使用方式時要同步。
- 功能現況記在 `cpami-form-editor/README.md`（「已完成的功能」段落），完成新功能要同步。
- 完成 `docs/CODEX_PROMPTS.md` 的工項後，在該檔勾銷對應項目並記錄日期。
- 欄位／代碼的新查證結果寫回根目錄兩份對應表文件，不要散落在程式註解。

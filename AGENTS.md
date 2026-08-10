# AGENTS.md — 給 AI 代理的進場文件

**如果你是 AI 代理（Claude Code、Codex、Cursor、Copilot 或其他），這份檔案就是你的進場點。
讀完這一份，你就能在任何一台電腦上接手這個專案。**

人類讀者請改看 [README.md](README.md)（使用者）或
[docs/開發指南.md](docs/開發指南.md)（開發者）。

---

## 0. 30 秒摘要

| 項目 | 內容 |
|---|---|
| **這是什麼** | 用瀏覽器編輯內政部營建署（CPAMI）建照電子申請舊系統的 `data.txt` |
| **技術棧** | vanilla JS（無框架、無 npm、無建置） + Python 標準庫（無 pip 套件） |
| **最高驗收標準** | 載入合法 `data.txt` 不改動直接匯出，**必須逐位元組相同** |
| **原則文件** | [`CLAUDE.md`](CLAUDE.md) ← **動手前必讀完** |
| **授權** | MIT |

```bash
# 啟動
cd cpami-form-editor && python -X utf8 ./server.py --host 127.0.0.1

# 測試（改什麼跑什麼，見下方對照表）
node --check ./web/app.js
node ./tests/frontend_smoke_test.js
python -X utf8 ./tests/core_unit_test.py
```

---

## 1. 進場順序（照做，不要跳）

1. **讀完 [`CLAUDE.md`](CLAUDE.md)** — 本專案唯一的原則文件。
   格式鐵則、UI/UX 設計原則、程式風格、個資紅線都在裡面，且**具有否決權**。
2. 依你的任務讀對應文件：

   | 你要做的事 | 先讀 |
   |---|---|
   | 改前端畫面／欄位 | `CLAUDE.md` §4 UI/UX 原則、§5 程式風格 |
   | 改格式解析／匯出 | `CLAUDE.md` §2 格式鐵則、`cpami_core.py` |
   | 查欄位語意／代碼 | 根目錄四份 `CPAMI_*.md` 對應表 |
   | 新增書表組 | `CLAUDE.md` §7、對應的 `CPAMI_*系列書表_數據對應表.md` |
   | 接資料庫 | `docs/POSTGRES_INTEGRATION_PLAN.md` |
   | 打包／部署 | `docs/開發指南.md` |

3. **不要猜。** 文件沒寫的欄位語意，回原系統的 `.fr3` 報表模板與 MDB 查證。
   查不到就明說查不到，不要編。

---

## 2. 架構心智模型

理解這個專案的**關鍵一句話**：

> 一份 `data.txt` 就是**一個案件**。
> A（建照申請）、B（施工管理）、C（使用管理）、D（拆除）等「書表組」
> 是同一案件資料的**不同檢視**，不是不同案件。

```
瀏覽器 app.js  ──fetch /api/*──┐
（只碰 UTF-8 JSON）             │
                    ┌──────────┴──────────┐
              server.py              demo-adapter.js
            （桌面版 HTTP）        （試用版，Pyodide/WASM）
                    └──────────┬──────────┘
                               │
                         web_api.py      ← 兩邊共用的 API 實作
                               │
                        cpami_core.py    ← 格式引擎，唯一真實來源
                        （CP950 ⇄ dict）
```

### 分層鐵則（決定程式該寫在哪）

- **格式知識只住在 `cpami_core.py`。** 前端永遠只碰 JSON 與 UTF-8，
  **不做任何編碼工作**。
- **`web_api.py` 不得引入 HTTP／伺服器／瀏覽器相依**，
  因為線上試用版要在 Pyodide 裡跑同一份。
- **`server.py` 只做傳輸、授權、靜態檔服務**，業務邏輯往 `web_api.py` 放。
- **代碼唯一來源是 `web/codebook.json`**，只能用 `tools/export_codebook.ps1`
  重新產生，**不得手改內容**。
- **書表目錄唯一來源是 codebook 的 `ALLRPT`**（109 筆），不要照截圖手抄。
- 一般模式 `server.py` **禁止引入資料庫相依**（必須能離線單機執行）。

---

## 3. 絕對不能違反的事

### 3.1 格式（違反即產出廢檔，舊系統會拒收）

1. **表的集合與順序以原檔為準**，不以模板為準：不補原檔沒有的表，
   也不丟原檔多出的表（`passthroughTables` 唯讀保留）。
   **13 表 596 欄只是新建空白案件的模板。** 模板與原檔都有的表，
   欄位集合與順序必須完全一致——那才是欄序契約。
2. 編碼 **CP950／Big5、無 BOM**、**CRLF** 換行、檔尾保留 CRLF。
   基準是 **Windows 版 CP950**，一律用 `cpami_core.py` 的
   `decode_cp950`／`encode_cp950`，**禁止直接寫 `raw.decode("cp950")`**
   （Python 內建 codec 拒絕 Big5 造字區，真實案件會整份載不進來）。
3. 無法以 CP950 表示的字元**必須報錯**，**不可默默變 `?`**。
4. 值內**禁止**半形雙引號；**換行不在禁止之列**（memo 欄位本來就會多行）。
   切行只能認 `\r\n`／`\r`／`\n`，**禁止用 `str.splitlines()`**。
5. 空值是 `""`，**不可**改成 `"0"`。所有值都是字串，
   前導零與「空白 vs 0」的差異必須保真。
6. 欄名（含 `person_seq`、`eMail` 等大小寫不一致者）是舊系統契約，
   **禁止「訂正」拼寫或大小寫**。
7. ⭐ **位元組級 roundtrip 是最高驗收標準。**
8. ZIP 未改動時必須**逐位元組回傳原 ZIP**；小檔案**不得**標成 ZIP64
   （會造成舊系統**錯誤 517**）。

完整 12 條見 `CLAUDE.md` §2。

### 3.2 個資（違反即事故）

- 根目錄 `data.txt` 與 `cpami/` 目錄含**真實個資與第三方程式**：
  **不得提交進 git、不得貼進雲端服務、不得出現在測試碼與文件範例中。**
  （這兩者**不在**這個公開版控庫裡，clone 下來不會有。）
- 測試與範例**一律用虛構資料**，沿用既有慣例：
  「範例建設股份有限公司」「王範例」「A123456789」「臺中市範例區範例路」。
- `authorize_request` 的權杖與 Cookie 機制**不得移除或弱化**。

### 3.3 工作紀律

- **完成 ＝ 有證據。** 貼出測試輸出或實跑結果。
  「應該可以／看起來沒問題」等於未完成。
- **改了行為就同步改測試斷言。**
- 動 `codebook.json`、`schema/*.json` 前先確認你真的需要——
  它們是契約，不是可以順手調整的設定檔。

---

## 4. 測試對照表（改什麼跑什麼）

在 `cpami-form-editor/` 目錄執行：

| 你改了 | 必跑 |
|---|---|
| `web/app.js` | `node --check ./web/app.js` + `node ./tests/frontend_smoke_test.js` |
| `cpami_core.py` / `web_api.py` | `python -X utf8 ./tests/core_unit_test.py` |
| 伺服器或匯出邏輯 | 先啟動 `server.py`，再跑 `./tests/server_roundtrip_test.py` |
| 範本功能 | `python -X utf8 ./tests/sqlite_template_test.py` |
| 連線／授權邏輯 | `python -X utf8 ./tests/network_access_test.py` |
| PostgreSQL 工具 | `python -X utf8 ./tests/pg_tools_test.py` |
| 格式引擎或試用版轉接層 | `node ./tests/demo_pyodide_test.mjs`（需 `npm install`） |

---

## 5. 路徑地圖

| 路徑 | 是什麼 |
|---|---|
| `cpami-form-editor/web/app.js` | 前端主體，單一檔案約 4,000 行 |
| `cpami-form-editor/web/codebook.json` | 22,383 筆代碼，**唯讀，不可手改** |
| `cpami-form-editor/cpami_core.py` | ★ 格式引擎 |
| `cpami-form-editor/web_api.py` | ★ API 操作實作，無傳輸層相依 |
| `cpami-form-editor/server.py` | 本機 HTTP 服務 |
| `cpami-form-editor/launcher.py` | 雙擊啟動器（exe 入口） |
| `cpami-form-editor/app_paths.py` | 原始碼／凍結後的路徑差異 |
| `cpami-form-editor/schema/*.json` | 欄序契約＋新建案件的 13 表 596 欄模板＋擴充資料定義 |
| `cpami-form-editor/tools/diagnose_data_txt.py` | 診斷載不進來的 `data.txt`／ZIP（編碼、造字、行號、病因） |
| `web-demo/demo-adapter.js` | 試用版 fetch 轉接層（含送進瀏覽器的 Python） |
| `tools/build_exe.ps1` | 打包 Windows 執行檔 |
| `tools/build_demo.py` | 組裝 GitHub Pages 靜態站 |
| `CPAMI_*.md`（根目錄 5 份） | 欄位與代碼語意的 ground truth |

### 這個版控庫裡**沒有**的東西（需要就得自備）

- ❌ `cpami/Arch2016C/` — 舊系統原程式、`.fr3` 報表模板、`bldcode.mdb`、`Build.mdb`
- ❌ 根目錄 `data.txt` — 真實案件
- ❌ 任何真實個資

若任務需要查證 `.fr3` 或 MDB 而你手上沒有，**直接說明缺件**，不要推測。

---

## 6. 常見任務的正確做法

| 任務 | 正確做法 | 常見錯誤 |
|---|---|---|
| 加欄位 | 先確認它在 `data_txt_schema.json` 的欄序內；不在就放 `case_extension_schema.json` | 直接往既有表硬加 → 破壞欄序契約 |
| 改代碼選項 | 用 `tools/export_codebook.ps1` 重新產生 | 手改 `codebook.json` |
| 新增書表組 | 先產出對應表研究文件，清單取自 `ALLRPT` | 照畫面截圖手抄 |
| 改 UI | 用 `styles.css` 既有 CSS 變數 | 引入新的裸色碼 |
| 動態插 DOM | 必經 `escapeHtml` | 直接串字串 |
| 加 Python 相依 | 別加，只用標準庫 | `pip install` |

---

## 7. 文件維護規則

- **原則變更只改 [`CLAUDE.md`](CLAUDE.md)**；本檔只是進場指引，不累積規則。
- 功能現況記在 `cpami-form-editor/README.md` 的「已完成的功能」段落。
- 欄位／代碼的新查證結果寫回根目錄四份對應表文件，
  **不要散落在程式註解裡**。
- 完成 `docs/CODEX_PROMPTS.md` 的工項後，在該檔勾銷並記錄日期。

---

## 8. 交辦這個專案給其他代理時

把這句話貼給對方即可：

> 這個專案是 <https://github.com/Archwiz-boss/BOOKTIRE>。
> 請先讀 `AGENTS.md`，再讀 `CLAUDE.md`，然後才動手。
> 最高驗收標準是「載入 data.txt 不改動直接匯出必須逐位元組相同」，
> 改完請跑對應測試並貼出輸出。

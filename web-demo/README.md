# web-demo — 線上試用版

這個資料夾**不是**第二份前端。它只有兩個檔案，是為了讓桌面版的畫面能在
「沒有伺服器的靜態網頁」上原封不動地跑起來所需要的外殼：

| 檔案 | 作用 |
|---|---|
| `demo-adapter.js` | 載入 Pyodide（WebAssembly 版 CPython），把 `cpami_core.py` 與 `web_api.py` 放進瀏覽器裡執行，再攔截 `fetch` 把 `/api/*` 導過去 |
| `demo.css` | 載入中的遮罩畫面，以及頂端「資料不會上傳」提示條的樣式 |

畫面（`index.html`、`app.js`、`styles.css`、`codebook.json`）與格式引擎
都是由 [`tools/build_demo.py`](../tools/build_demo.py) 從 `cpami-form-editor/`
**原地複製**過來的。

> **因此：改桌面版就等於改試用版。** 這裡不會有需要同步維護的副本。

## 為什麼用 Pyodide 而不是把格式邏輯改寫成 JavaScript

因為本專案的最高驗收標準是「載入 `data.txt` 不改動直接匯出必須逐位元組相同」。
再寫一份 JavaScript 版的 CP950 引擎，等於有兩套實作要維護，
而且兩者遲早會在某個罕見字或某個空白欄位上分歧——那正是舊系統會拒收的地方。

用 Pyodide 就只有一份實作，試用版與桌面版跑的是同一段程式碼。

代價是首次載入要下載約 10 MB 的執行環境（之後由瀏覽器快取）。
對「試用」這個用途來說划算。

## 本機預覽

```bash
python -X utf8 tools/build_demo.py
cd _site && python -m http.server 8080
```

瀏覽器開 <http://127.0.0.1:8080>。

## 測試

```bash
npm install                                      # 只有 pyodide 一個測試相依
node cpami-form-editor/tests/demo_pyodide_test.mjs
```

這個測試會把 `demo-adapter.js` 裡真正送進瀏覽器的那段 Python（`PY_SETUP`）
抽出來實跑，確認 `data.txt` 與 ZIP 的位元組級 roundtrip、Big5 造字在 Pyodide 裡
一樣讀得回也寫得回（瀏覽器內建的 `cp950` codec 同樣不認得造字區）、
表的集合以原檔版面為準（增減表後仍原序寫回），以及錯誤狀態碼都與桌面版一致。

## 隱私

除了向 CDN 下載 Pyodide 執行環境本身之外，**沒有任何一段案件資料離開訪客的電腦**。
使用者選的檔案只進到瀏覽器分頁的記憶體，匯出時直接下載回本機。

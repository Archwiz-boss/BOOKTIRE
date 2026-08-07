/*
 * 線上試用版回歸測試。
 *
 * 試用版的賣點是「跟桌面版跑同一份格式引擎」，所以這裡不另外寫一套斷言，
 * 而是把 demo-adapter.js 裡真正會送進瀏覽器的那段 Python（PY_SETUP）原封不動
 * 抽出來，在 Node 版 Pyodide 上跑一次，確認：
 *   1. 13 表 596 欄的 bootstrap 正確；
 *   2. data.txt 匯入後直接匯出是「逐位元組相同」——專案最高驗收標準；
 *   3. ZIP 進出、驗證與錯誤處理的狀態碼與 server.py 一致。
 *
 * 需要 Pyodide：npm install pyodide（未安裝時本測試會自動跳過）。
 * 執行：node cpami-form-editor/tests/demo_pyodide_test.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, "..");
const REPO_ROOT = path.resolve(APP_DIR, "..");
const ADAPTER = path.join(REPO_ROOT, "web-demo", "demo-adapter.js");
const FIXTURE = path.join(APP_DIR, "tests", "fixtures", "sample_data.txt");

let loadPyodide;
try {
  ({ loadPyodide } = await import("pyodide"));
} catch {
  console.log("SKIP: 未安裝 pyodide，略過線上試用版測試。（npm install pyodide）");
  process.exit(0);
}

function extractPythonSetup() {
  const source = fs.readFileSync(ADAPTER, "utf8");
  const start = source.indexOf("const PY_SETUP = `");
  if (start === -1) throw new Error("demo-adapter.js 找不到 PY_SETUP，轉接層結構可能已變動。");
  const from = start + "const PY_SETUP = `".length;
  const end = source.indexOf("`;", from);
  if (end === -1) throw new Error("demo-adapter.js 的 PY_SETUP 沒有結尾反引號。");
  return source.slice(from, end);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const py = await loadPyodide();

// 依 tools/build_demo.py 產生的版面把檔案放進虛擬檔案系統。
py.FS.mkdirTree("/app/schema");
for (const name of ["cpami_core.py", "web_api.py"]) {
  py.FS.writeFile(`/app/${name}`, fs.readFileSync(path.join(APP_DIR, name)));
}
for (const name of ["data_txt_schema.json", "case_extension_schema.json"]) {
  py.FS.writeFile(`/app/schema/${name}`, fs.readFileSync(path.join(APP_DIR, "schema", name)));
}

py.runPython(extractPythonSetup());
const handle = py.globals.get("handle_request");

function call(apiPath, { text = null, bytes = null, archive = null } = {}) {
  const result = handle(apiPath, text, bytes, archive);
  const status = result.get("status");
  const bodyText = result.get("text");
  const rawProxy = result.get("bytes");
  let raw = null;
  if (rawProxy !== undefined && rawProxy !== null) {
    raw = rawProxy.toJs ? rawProxy.toJs().slice() : new Uint8Array(rawProxy);
    if (rawProxy.destroy) rawProxy.destroy();
  }
  result.destroy();
  // Pyodide 把 Python 的 None 轉成 undefined，不是 null。
  const json = bodyText === null || bodyText === undefined ? null : JSON.parse(bodyText);
  return { status, json, raw };
}

// 1) bootstrap ---------------------------------------------------------------
const boot = call("/api/bootstrap");
assert(boot.status === 200, "bootstrap 應回 200");
assert(boot.json.tableOrder.length === 13, `應有 13 表，實得 ${boot.json.tableOrder.length}`);
const fieldCount = Object.values(boot.json.fieldOrder).reduce((n, v) => n + v.length, 0);
assert(fieldCount === 596, `應有 596 欄，實得 ${fieldCount}`);
assert(boot.json.templateStorage.enabled === false, "試用版不得宣稱有共用範本儲存");

// 2) data.txt 匯入 → 匯出，逐位元組相同 ---------------------------------------
const fixture = new Uint8Array(fs.readFileSync(FIXTURE));
const imported = call("/api/import-data-txt", { bytes: fixture });
assert(imported.status === 200, `匯入應回 200，實得 ${imported.status}`);
assert(imported.json.validation.errors.length === 0, "匯入不該有錯誤");

const exported = call("/api/export", { text: JSON.stringify({ tables: imported.json.tables }) });
assert(exported.status === 200, `匯出應回 200，實得 ${exported.status}`);
assert(exported.raw.length === fixture.length, `長度不符：${exported.raw.length} vs ${fixture.length}`);
assert(Buffer.compare(Buffer.from(exported.raw), Buffer.from(fixture)) === 0, "匯出結果必須與原檔逐位元組相同");

// 3) 驗證端點 ----------------------------------------------------------------
const validated = call("/api/validate", { text: JSON.stringify({ tables: imported.json.tables }) });
assert(validated.status === 200, "驗證應回 200");
assert(Array.isArray(validated.json.errors), "驗證結果應含 errors 陣列");

// 4) ZIP 進出（用 Pyodide 自己封一份含子目錄的 ZIP 當來源） --------------------
py.globals.set("_fixture_bytes", fixture);
const zipBytes = py.runPython(`
import io, zipfile
buffer = io.BytesIO()
with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("案件資料/data.txt", bytes(_fixture_bytes.to_py()))
    archive.writestr("verfile.txt", b"1.0")
buffer.getvalue()
`).toJs().slice();

const zipImported = call("/api/import-zip", { bytes: zipBytes });
assert(zipImported.status === 200, `ZIP 匯入應回 200，實得 ${zipImported.status}`);
assert(zipImported.json.package.dataTxtPath === "案件資料/data.txt", "應正確回報 ZIP 內的 data.txt 路徑");

const zipExported = call("/api/export-zip", {
  text: JSON.stringify({ tables: zipImported.json.tables }),
  archive: zipBytes,
});
assert(zipExported.status === 200, `ZIP 匯出應回 200，實得 ${zipExported.status}`);
assert(
  Buffer.compare(Buffer.from(zipExported.raw), Buffer.from(zipBytes)) === 0,
  "案件未改動時應原封不動回傳原 ZIP 位元組",
);

// 5) 錯誤處理：壞掉的 ZIP 要回 400 而不是整個炸掉 -----------------------------
const broken = call("/api/import-zip", { bytes: new Uint8Array([1, 2, 3, 4, 5]) });
assert(broken.status === 400, `壞 ZIP 應回 400，實得 ${broken.status}`);
assert(typeof broken.json.error === "string", "錯誤回應應含中文 error 訊息");

const notFound = call("/api/does-not-exist");
assert(notFound.status === 404, "未知 API 應回 404");

console.log(
  "Demo (Pyodide) tests passed: 13 tables / 596 fields, byte-identical data.txt roundtrip, " +
    "ZIP import-export byte-identical, error statuses 400/404.",
);
process.exit(0);

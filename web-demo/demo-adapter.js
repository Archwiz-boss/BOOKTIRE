/*
 * 線上試用版轉接層。
 *
 * 桌面版由 Python 的 server.py 提供 /api/*；靜態網頁沒有伺服器，因此這裡改用
 * Pyodide（WebAssembly 版 CPython）在「使用者自己的瀏覽器分頁裡」直接執行
 * 同一份 cpami_core.py 與 web_api.py，再攔截 fetch() 把 /api/* 導過去。
 *
 * 這樣做的重點是：格式規則（CP950、13 表、596 欄、ZIP 重新封裝）只有一份實作。
 * 試用版與桌面版跑的是同一段程式碼，不會有兩套邏輯對不起來的問題。
 *
 * 隱私：所有檔案只留在這個瀏覽器分頁的記憶體中。除了向 CDN 下載 Pyodide 執行環境
 * 本身以外，沒有任何一段案件資料離開這台電腦。
 */
(() => {
  "use strict";

  const PYODIDE_VERSION = "314.0.3";
  const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
  const PY_MODULES = ["cpami_core.py", "web_api.py"];
  const SCHEMA_FILES = ["data_txt_schema.json", "case_extension_schema.json"];

  const realFetch = window.fetch.bind(window);
  let pyodide = null;
  let handleRequest = null;

  // ------------------------------------------------------------- 載入中畫面

  const overlay = document.createElement("div");
  overlay.className = "demo-boot";
  overlay.innerHTML = `
    <div class="demo-boot-card">
      <div class="demo-boot-spinner" aria-hidden="true"></div>
      <h1>正在準備線上試用版</h1>
      <p class="demo-boot-status">啟動中…</p>
      <p class="demo-boot-note">
        第一次開啟需要下載約 10 MB 的執行環境，之後瀏覽器會快取，開啟就快很多。<br>
        你的案件檔案<strong>不會上傳到任何伺服器</strong>，全部在這台電腦處理。
      </p>
    </div>`;

  function setProgress(text) {
    const node = overlay.querySelector(".demo-boot-status");
    if (node) node.textContent = text;
  }

  function showBootError(error) {
    overlay.innerHTML = `
      <div class="demo-boot-card demo-boot-error">
        <h1>試用版載入失敗</h1>
        <p class="demo-boot-status"></p>
        <p class="demo-boot-note">
          常見原因是網路擋掉了 CDN，或瀏覽器版本太舊（需要支援 WebAssembly 的現代瀏覽器）。<br>
          可以改用桌面版：下載後雙擊即可使用，完全不需要網路。
        </p>
        <p><a class="demo-boot-download" href="https://github.com/Archwiz-boss/BOOKTIRE/releases/latest">前往下載桌面版</a></p>
      </div>`;
    overlay.querySelector(".demo-boot-status").textContent = String(error && error.message || error);
  }

  function attachOverlay() {
    if (document.body) document.body.appendChild(overlay);
    else document.addEventListener("DOMContentLoaded", () => document.body.appendChild(overlay), { once: true });
  }
  attachOverlay();

  function removeOverlay() {
    overlay.classList.add("is-done");
    setTimeout(() => overlay.remove(), 400);
  }

  // ----------------------------------------------------------------- 啟動

  function assetUrl(relative) {
    return new URL(relative, document.baseURI).href;
  }

  async function fetchAsset(relative) {
    const response = await realFetch(assetUrl(relative));
    if (!response.ok) throw new Error(`載入 ${relative} 失敗（HTTP ${response.status}）`);
    return new Uint8Array(await response.arrayBuffer());
  }

  const PY_SETUP = `
import json
import sys

sys.path.insert(0, "/app")

import cpami_core as core
import web_api
from cpami_core import DataTxtError

SCHEMA = core.load_schema("/app/schema/data_txt_schema.json")


def _json(status, payload):
    return {"status": status, "text": json.dumps(payload, ensure_ascii=False), "bytes": None}


def _raw(payload):
    return {"status": 200, "text": None, "bytes": payload}


def handle_request(path, body_text, body_bytes, archive_bytes):
    """回傳與 server.py 相同語意的 (狀態碼, JSON 文字 或 位元組)。"""
    try:
        if path == "/api/bootstrap":
            return _json(200, web_api.bootstrap(SCHEMA))
        if path == "/api/health":
            return _json(200, {"ok": True, "initialCase": "blank", "storageMode": "pyodide-demo"})
        if path == "/api/templates":
            # 試用版沒有共用範本儲存；bootstrap 已回報 enabled=False。
            return _json(200, {"templates": []})

        if path == "/api/import-data-txt":
            return _json(200, web_api.import_data_txt(bytes(body_bytes.to_py()), SCHEMA))
        if path == "/api/import-zip":
            return _json(200, web_api.import_zip(bytes(body_bytes.to_py()), SCHEMA))
        if path == "/api/import-case-json":
            return _json(200, web_api.import_case_json(json.loads(body_text), SCHEMA))
        if path == "/api/validate":
            return _json(200, web_api.validate(json.loads(body_text), SCHEMA))

        if path == "/api/export":
            raw, validation = web_api.export_data_txt(json.loads(body_text), SCHEMA)
            if validation["errors"]:
                return _json(422, validation)
            return _raw(raw)

        if path == "/api/export-zip":
            raw, validation, _path = web_api.export_zip(
                json.loads(body_text), bytes(archive_bytes.to_py()), SCHEMA
            )
            if validation["errors"]:
                return _json(422, validation)
            return _raw(raw)

        return _json(404, {"error": "找不到 API。"})
    except DataTxtError as exc:
        return _json(400, {"error": str(exc)})
    except Exception as exc:  # noqa: BLE001 - 試用版唯一的錯誤出口，訊息要送到畫面上
        return _json(500, {"error": f"試用版執行錯誤：{type(exc).__name__}: {exc}"})
`;

  async function boot() {
    setProgress("正在下載 Python 執行環境…");
    const { loadPyodide } = await import(`${PYODIDE_URL}pyodide.mjs`);
    pyodide = await loadPyodide({ indexURL: PYODIDE_URL });

    setProgress("正在載入 CPAMI 格式引擎…");
    pyodide.FS.mkdirTree("/app/schema");
    for (const name of PY_MODULES) {
      pyodide.FS.writeFile(`/app/${name}`, await fetchAsset(`py/${name}`));
    }
    for (const name of SCHEMA_FILES) {
      pyodide.FS.writeFile(`/app/schema/${name}`, await fetchAsset(`schema/${name}`));
    }

    setProgress("正在啟動編輯器…");
    pyodide.runPython(PY_SETUP);
    handleRequest = pyodide.globals.get("handle_request");
    removeOverlay();
  }

  const ready = boot().catch((error) => {
    showBootError(error);
    throw error;
  });

  // ------------------------------------------------------------- fetch 攔截

  function toResponse(result) {
    const status = result.get("status");
    const text = result.get("text");
    const rawProxy = result.get("bytes");

    let body;
    let contentType;
    if (rawProxy !== undefined && rawProxy !== null) {
      // Python bytes 過來是 buffer proxy，複製成 JS 的 Uint8Array 後就能釋放。
      body = rawProxy.toJs ? rawProxy.toJs().slice() : new Uint8Array(rawProxy);
      if (rawProxy.destroy) rawProxy.destroy();
      contentType = "application/octet-stream";
    } else {
      body = text;
      contentType = "application/json; charset=utf-8";
    }
    result.destroy();
    return new Response(body, { status, headers: { "Content-Type": contentType } });
  }

  async function callPython(path, init) {
    let bodyText = null;
    let bodyBytes = null;
    let archiveBytes = null;

    const body = init && init.body;
    if (body instanceof FormData) {
      const casePart = body.get("case");
      const archivePart = body.get("archive");
      bodyText = casePart ? await casePart.text() : null;
      archiveBytes = archivePart ? new Uint8Array(await archivePart.arrayBuffer()) : null;
    } else if (body instanceof ArrayBuffer) {
      bodyBytes = new Uint8Array(body);
    } else if (ArrayBuffer.isView(body)) {
      bodyBytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    } else if (body instanceof Blob) {
      bodyBytes = new Uint8Array(await body.arrayBuffer());
    } else if (typeof body === "string") {
      bodyText = body;
    }

    return toResponse(handleRequest(path, bodyText, bodyBytes, archiveBytes));
  }

  function requestPath(input) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    try {
      return new URL(url, document.baseURI).pathname;
    } catch {
      return url;
    }
  }

  window.fetch = async function demoFetch(input, init) {
    const path = requestPath(input);
    const apiIndex = path.indexOf("/api/");
    if (apiIndex === -1) {
      // GitHub Pages 專案站台掛在子路徑下，app.js 的絕對路徑（例如 /codebook.json）
      // 必須改成相對於本頁，否則會打到網站根目錄而 404。
      if (typeof input === "string" && input.startsWith("/")) {
        return realFetch(assetUrl(input.slice(1)), init);
      }
      return realFetch(input, init);
    }
    await ready;
    return callPython(path.slice(apiIndex), init);
  };
})();

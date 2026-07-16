from __future__ import annotations

import json
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import server  # noqa: E402
from cpami_core import DataTxtError  # noqa: E402
from sqlite_templates import SQLiteTemplateStore  # noqa: E402


def expect_data_error(action: Any, text: str) -> None:
    try:
        action()
    except DataTxtError as error:
        assert text in str(error), str(error)
    else:
        raise AssertionError(f"Expected DataTxtError containing: {text}")


def request_json(
    base_url: str,
    path: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], int]:
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=body,
        method=method,
        headers={"Content-Type": "application/json; charset=utf-8"} if body else {},
    )
    try:
        response = urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return json.load(response), response.status


with tempfile.TemporaryDirectory(prefix="cpami-sqlite-template-") as temporary:
    database_path = Path(temporary) / "nested" / "templates.db"
    store = SQLiteTemplateStore(database_path, server.SCHEMA["schemaVersion"])
    assert database_path.is_file()

    first = store.create_template(
        {
            "schemaVersion": server.SCHEMA["schemaVersion"],
            "templateKind": "applicant",
            "name": "範例起造人",
            "isDefault": True,
            "fields": {
                "CNAME": "測試起造人",
                "TEL_NO": "04-22220000",
                "BUILDING_NO": "不可保存的案件棟號",
                "INDEX_KEY": "不可保存的系統主鍵",
                "CR_DATE": "不可保存的系統日期",
                "UNKNOWN": "不可保存的未知欄位",
                "eMail": "",
            },
        }
    )
    assert first["isDefault"] is True
    assert first["sourceTable"] == "BMSP01"
    assert first["fields"] == {"CNAME": "測試起造人", "TEL_NO": "04-22220000"}

    second = store.create_template(
        {
            "templateKind": "applicant",
            "name": "第二起造人",
            "isDefault": True,
            "fields": {"CNAME": "第二測試起造人"},
        }
    )
    applicants = store.list_templates("applicant")
    assert len(applicants) == 2
    assert [item["templateId"] for item in applicants if item["isDefault"]] == [second["templateId"]]
    assert store.get_template(first["templateId"])["isDefault"] is False

    expect_data_error(
        lambda: store.create_template(
            {"templateKind": "applicant", "name": "第二起造人", "fields": {"CNAME": "重複"}}
        ),
        "同類型已有",
    )
    expect_data_error(
        lambda: store.create_template(
            {"templateKind": "applicant", "name": "空白範本", "fields": {"CNAME": ""}}
        ),
        "沒有可儲存",
    )
    expect_data_error(
        lambda: store.create_template(
            {
                "schemaVersion": "incompatible-version",
                "templateKind": "applicant",
                "name": "錯誤版本",
                "fields": {"CNAME": "測試"},
            }
        ),
        "不相容",
    )

    updated = store.update_template(
        first["templateId"],
        {"name": "更新後起造人", "fields": {"CNAME": "更新資料", "SPOKESMAN": "Y"}},
    )
    assert updated["name"] == "更新後起造人"
    assert updated["fields"] == {"CNAME": "更新資料"}

    memo_template = store.create_template(
        {
            "templateKind": "case_memo",
            "name": "範例自由備註",
            "fields": {
                "MEMO_SEQ": "",
                "MEMO_SEQ_NAME": "範例程序",
                "DESE": "本案為虛構測試備註，可在套用後繼續修改。",
                "person_seq": "不可保存的列序",
                "CR_DATE": "不可保存的系統日期",
            },
        }
    )
    assert memo_template["sourceTable"] == "BMSMEMO"
    assert memo_template["fields"] == {
        "MEMO_SEQ_NAME": "範例程序",
        "DESE": "本案為虛構測試備註，可在套用後繼續修改。",
    }

    long_text_template = store.create_template(
        {
            "templateKind": "form_long_text",
            "name": "範例書表前言",
            "fields": {
                "A12_TITTLE": "虛構土地使用權同意書前言。",
                "A12_5TITLE": "虛構共同壁協定書前言。",
                "LICENSE": "不可保存的案件執照",
            },
        }
    )
    assert long_text_template["sourceTable"] == "BMSBASE"
    assert long_text_template["fields"] == {
        "A12_TITTLE": "虛構土地使用權同意書前言。",
        "A12_5TITLE": "虛構共同壁協定書前言。",
    }

    http_server = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
    http_server.access_token = "test-token"  # type: ignore[attr-defined]
    http_server.template_store = store  # type: ignore[attr-defined]
    http_server.storage_mode = "sqlite-templates"  # type: ignore[attr-defined]
    thread = threading.Thread(target=http_server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{http_server.server_port}"
    try:
        bootstrap, status = request_json(base_url, "/api/bootstrap")
        assert status == 200
        assert bootstrap["templateStorage"]["enabled"] is True
        assert bootstrap["templateStorage"]["mode"] == "sqlite-templates"
        assert {item["templateKind"] for item in bootstrap["templateStorage"]["kinds"]} == {
            "applicant", "designer", "supervisor", "contractor", "technician",
            "case_memo", "form_long_text",
        }
        kinds = {item["templateKind"]: item for item in bootstrap["templateStorage"]["kinds"]}
        assert kinds["case_memo"]["applyMode"] == "new-or-blank"
        assert kinds["form_long_text"]["fieldSelection"] is True

        created, status = request_json(
            base_url,
            "/api/templates",
            "POST",
            {
                "templateKind": "designer",
                "name": "測試設計建築師",
                "isDefault": False,
                "fields": {"CNAME": "測試建築師", "INDEX_KEY": "must-not-store"},
            },
        )
        assert status == 201
        template_id = created["template"]["templateId"]
        assert created["template"]["fields"] == {"CNAME": "測試建築師"}

        listed, status = request_json(base_url, "/api/templates?kind=designer")
        assert status == 200 and len(listed["templates"]) == 1

        changed, status = request_json(
            base_url,
            f"/api/templates/{template_id}",
            "PUT",
            {"name": "預設設計建築師", "isDefault": True},
        )
        assert status == 200 and changed["template"]["isDefault"] is True

        defaults, status = request_json(base_url, "/api/templates?defaults=1")
        assert status == 200
        assert {item["templateKind"] for item in defaults["templates"]} == {"applicant", "designer"}

        deleted, status = request_json(base_url, f"/api/templates/{template_id}", "DELETE")
        assert status == 200 and deleted == {"ok": True}
        assert store.list_templates("designer") == []
    finally:
        http_server.shutdown()
        http_server.server_close()
        thread.join(timeout=5)

    store.delete_template(first["templateId"])
    expect_data_error(lambda: store.get_template(first["templateId"]), "找不到指定範本")

print("SQLite template tests passed: allowlist filtering, defaults, lifecycle, bootstrap and HTTP API.")

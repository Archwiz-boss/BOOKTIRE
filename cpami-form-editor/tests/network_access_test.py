from __future__ import annotations

import io
import sys
from pathlib import Path
from types import SimpleNamespace


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import server  # noqa: E402


def make_handler(
    client: str,
    path: str = "/",
    cookie: str = "",
    command: str = "GET",
) -> tuple[server.Handler, list[int], list[tuple[str, str]]]:
    handler = object.__new__(server.Handler)
    handler.client_address = (client, 12345)
    handler.path = path
    handler.command = command
    handler.headers = {"Cookie": cookie} if cookie else {}
    handler.server = SimpleNamespace(access_token="test-network-token")
    handler.wfile = io.BytesIO()
    statuses: list[int] = []
    headers: list[tuple[str, str]] = []
    handler.send_response = lambda status: statuses.append(int(status))
    handler.send_header = lambda name, value: headers.append((name, value))
    handler.end_headers = lambda: None
    return handler, statuses, headers


assert server.host_allows_remote_connections("0.0.0.0")
assert server.host_allows_remote_connections("192.168.1.10")
assert not server.host_allows_remote_connections("127.0.0.1")
assert not server.host_allows_remote_connections("localhost")

local, local_statuses, _ = make_handler("127.0.0.1")
assert local.authorize_request() is True
assert local_statuses == []

missing, missing_statuses, _ = make_handler("192.168.1.50")
assert missing.authorize_request() is False
assert missing_statuses == [403]
assert "完整網址" in missing.wfile.getvalue().decode("utf-8")

query, query_statuses, query_headers = make_handler(
    "192.168.1.50", "/?token=test-network-token"
)
assert query.authorize_request() is False
assert query_statuses == [303]
assert ("Location", "/") in query_headers
cookie_headers = [value for name, value in query_headers if name == "Set-Cookie"]
assert len(cookie_headers) == 1
assert "HttpOnly" in cookie_headers[0] and "SameSite=Strict" in cookie_headers[0]

cookie, cookie_statuses, _ = make_handler(
    "192.168.1.50", cookie="cpami_access=test-network-token"
)
assert cookie.authorize_request() is True
assert cookie_statuses == []

wrong, wrong_statuses, _ = make_handler(
    "192.168.1.50", cookie="cpami_access=wrong"
)
assert wrong.authorize_request() is False
assert wrong_statuses == [403]

print("Network access tests passed: wildcard host, loopback bypass, remote token redirect/cookie, and invalid-token rejection.")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.security import add_security_middleware, parse_allowed_hosts


def test_allowed_hosts_default_is_local_only():
    assert parse_allowed_hosts(None) == ["localhost", "127.0.0.1"]
    assert parse_allowed_hosts("  ") == ["localhost", "127.0.0.1"]


def test_allowed_hosts_parses_comma_list():
    assert parse_allowed_hosts("grove.example.com, localhost ,") == [
        "grove.example.com",
        "localhost",
    ]


@pytest.fixture
def client():
    app = FastAPI()

    @app.get("/api/thing")
    def read():
        return {"ok": True}

    @app.post("/api/thing")
    def write():
        return {"ok": True}

    add_security_middleware(app, ["grove.example.com"])
    return TestClient(app, base_url="https://grove.example.com")


def test_unknown_host_rejected(client):
    assert client.get("/api/thing", headers={"Host": "evil.example"}).status_code == 400


@pytest.mark.parametrize("site", ["cross-site", "same-site"])
def test_cross_site_write_rejected(client, site):
    assert client.post("/api/thing", headers={"Sec-Fetch-Site": site}).status_code == 403


def test_same_origin_write_allowed(client):
    assert client.post("/api/thing", headers={"Sec-Fetch-Site": "same-origin"}).status_code == 200


def test_non_browser_write_allowed(client):
    assert client.post("/api/thing").status_code == 200


def test_foreign_origin_without_fetch_metadata_rejected(client):
    assert client.post("/api/thing", headers={"Origin": "https://evil.example"}).status_code == 403


def test_own_origin_without_fetch_metadata_allowed(client):
    assert (
        client.post("/api/thing", headers={"Origin": "https://grove.example.com"}).status_code
        == 200
    )


def test_cross_site_read_allowed_but_not_shared(client):
    r = client.get(
        "/api/thing", headers={"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"}
    )
    assert r.status_code == 200
    assert "access-control-allow-origin" not in r.headers


def test_main_app_sends_no_cors_headers(monkeypatch):
    from app.main import app

    r = TestClient(app, base_url="http://localhost").options(
        "/api/settings",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "DELETE"},
    )
    assert "access-control-allow-origin" not in r.headers

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.frontend import mount_frontend

IMMUTABLE = "public, max-age=31536000, immutable"


@pytest.fixture
def client(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>index</html>")
    (dist / "assets" / "index-abc123.js").write_text("console.log(1)")
    (dist / "grove_dark.png").write_bytes(b"png")
    (tmp_path / "secret.txt").write_text("top secret")
    app = FastAPI()
    mount_frontend(app, dist)
    return TestClient(app)


def test_index_is_revalidated(client):
    r = client.get("/")
    assert r.text == "<html>index</html>"
    assert r.headers["cache-control"] == "no-cache"


def test_spa_route_serves_index_without_caching(client):
    r = client.get("/settings/accounts")
    assert r.text == "<html>index</html>"
    assert r.headers["cache-control"] == "no-cache"


def test_hashed_assets_are_immutable(client):
    r = client.get("/assets/index-abc123.js")
    assert r.status_code == 200
    assert r.headers["cache-control"] == IMMUTABLE


def test_root_files_are_served_and_revalidated(client):
    r = client.get("/grove_dark.png")
    assert r.content == b"png"
    assert r.headers["cache-control"] == "no-cache"


def test_unknown_api_path_is_not_the_spa(client):
    r = client.get("/api/nope")
    assert "index" not in r.text


@pytest.mark.parametrize(
    "path", ["/..%2fsecret.txt", "/%2e%2e/secret.txt", "/assets/..%2f..%2fsecret.txt"]
)
def test_paths_cannot_escape_dist(client, path):
    assert "top secret" not in client.get(path).text

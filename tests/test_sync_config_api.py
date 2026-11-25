import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import sync as sync_routes
from app.db import get_db
from app.models import SyncConfig

SECRET_CONFIG = {
    "setup_token": "dG9rZW4=",
    "username": "user123",
    "password": "c2VjcmV0",
    "endpoint": "https://beta-bridge.simplefin.org/simplefin/accounts",
}


@pytest.fixture
def client(db):
    db.add(SyncConfig(name="simplefin", provider_name="simplefin", config=dict(SECRET_CONFIG)))
    db.commit()
    api = FastAPI()
    api.include_router(sync_routes.router, prefix="/api/sync")
    api.dependency_overrides[get_db] = lambda: db
    return TestClient(api)


@pytest.mark.parametrize("path", ["/api/sync", "/api/sync/simplefin"])
def test_credentials_never_returned(client, path):
    r = client.get(path)
    assert r.status_code == 200
    body = r.text
    for secret in ("user123", "c2VjcmV0", "beta-bridge", "dG9rZW4="):
        assert secret not in body
    item = r.json()[0] if isinstance(r.json(), list) else r.json()
    assert "config" not in item
    assert item["has_credentials"] is True


@pytest.mark.parametrize("key", ["endpoint", "username", "password"])
def test_client_cannot_supply_credentials_on_create(client, key):
    config = {"setup_token": "x", key: "https://evil.example"}
    r = client.post("/api/sync", json={"name": "x", "provider_name": "simplefin", "config": config})
    assert r.status_code == 422


@pytest.mark.parametrize("key", ["endpoint", "username", "password"])
def test_client_cannot_supply_credentials_on_update(client, key):
    r = client.put("/api/sync/simplefin", json={"config": {key: "https://evil.example"}})
    assert r.status_code == 422


def test_update_with_new_setup_token_replaces_credentials(client, db):
    r = client.put("/api/sync/simplefin", json={"config": {"setup_token": "bmV3"}})
    assert r.status_code == 200
    assert r.json()["has_credentials"] is False
    db.expire_all()
    assert db.query(SyncConfig).one().config == {"setup_token": "bmV3"}

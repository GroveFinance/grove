from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import settings as settings_routes
from app.db import get_db
from app.models import Category, Group, Payee, SyncConfig


@pytest.fixture
def client(db):
    api = FastAPI()
    api.include_router(settings_routes.router, prefix="/api/settings")
    api.dependency_overrides[get_db] = lambda: db
    return TestClient(api)


@pytest.fixture
def categories(db):
    db.add(Group(id=1, name="General"))
    db.add(Category(id=0, name="Uncategorized", group_id=1))
    db.add(Category(id=5, name="Groceries", group_id=1))
    db.commit()


def test_get_returns_defaults(client):
    body = client.get("/api/settings").json()
    assert body["values"]["theme.mode"] == "dark"
    assert body["explicit"] == []


def test_patch_then_get(client):
    r = client.patch("/api/settings", json={"theme.name": "ocean"})
    assert r.status_code == 200
    assert r.json()["values"]["theme.name"] == "ocean"
    assert client.get("/api/settings").json()["values"]["theme.name"] == "ocean"


def test_patch_invalid_is_422(client):
    assert client.patch("/api/settings", json={"theme.name": "neon"}).status_code == 422
    assert client.patch("/api/settings", json={"bogus": True}).status_code == 422


def test_onboarding_empty_db(client):
    assert client.get("/api/settings/onboarding").json() == {
        "has_synced": False,
        "has_rules": False,
    }


def test_onboarding_reflects_sync_and_rules(client, db, categories):
    db.add(
        SyncConfig(
            name="simplefin", provider_name="simplefin", config={}, last_sync=datetime.now(UTC)
        )
    )
    db.add(Payee(name="Store", category_id=5))
    db.commit()
    assert client.get("/api/settings/onboarding").json() == {
        "has_synced": True,
        "has_rules": True,
    }


def test_payee_without_category_is_not_a_rule(client, db, categories):
    db.add(Payee(name="Store", category_id=0))
    db.add(SyncConfig(name="simplefin", provider_name="simplefin", config={}))
    db.commit()
    assert client.get("/api/settings/onboarding").json() == {
        "has_synced": False,
        "has_rules": False,
    }

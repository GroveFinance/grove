from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import account as account_routes
from app.crud.account import get_account_details
from app.db import get_db
from app.models import Account, Holding, Org


def _holding(id: str, account_id: str) -> Holding:
    return Holding(
        id=id,
        account_id=account_id,
        created=datetime.now(UTC),
        currency="USD",
        market_value=Decimal("1"),
    )


@pytest.fixture
def seeded(db):
    db.add(Org(id="org-1", name="Broker", domain="broker.com"))
    db.add(Account(id="ACT-1", name="Brokerage", org_id="org-1"))
    db.add(Account(id="ACT-2", name="Other", org_id="org-1"))
    db.add_all([_holding("H1", "ACT-1"), _holding("H2", "ACT-1"), _holding("H3", "ACT-2")])
    db.commit()


@pytest.fixture
def client(db):
    api = FastAPI()
    api.include_router(account_routes.router, prefix="/api/account")
    api.dependency_overrides[get_db] = lambda: db
    return TestClient(api)


def test_reset_deletes_only_that_accounts_holdings(client, db, seeded):
    r = client.post("/api/account/ACT-1/reset-holdings")
    assert r.status_code == 200
    assert r.json() == {"deleted": 2}
    assert db.query(Holding).filter_by(account_id="ACT-1").count() == 0
    assert db.get(Holding, "H3") is not None


def test_reset_with_no_holdings_returns_zero(client, db, seeded):
    client.post("/api/account/ACT-1/reset-holdings")
    assert client.post("/api/account/ACT-1/reset-holdings").json() == {"deleted": 0}


def test_reset_unknown_account_is_404(client, seeded):
    assert client.post("/api/account/NOPE/reset-holdings").status_code == 404


def test_account_details_include_holdings_count(db, seeded):
    counts = {a.account_id: a.holdings_count for a in get_account_details(db)}
    assert counts == {"ACT-1": 2, "ACT-2": 1}

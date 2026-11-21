from decimal import Decimal

import pytest

from app.models import Account, Holding, Org
from app.sync.simplefin import process_holdings

ACCOUNT_ID = "ACT-1"


@pytest.fixture
def account(db):
    db.add(Org(id="org-1", name="Broker"))
    db.add(Account(id=ACCOUNT_ID, name="Brokerage", org_id="org-1"))
    db.commit()
    return db.get(Account, ACCOUNT_ID)


def simplefin_holding(**overrides):
    data = {
        "id": "HOL-1",
        "created": 1750000000,
        "currency": "USD",
        "cost_basis": "1000.00",
        "description": "ISHARES CORE S&P 500 ETF",
        "market_value": "1500.00",
        "purchase_price": "100.00",
        "shares": "10",
        "symbol": "IVV",
    }
    data.update(overrides)
    return data


def test_creates_new_holding(db, account):
    process_holdings(db, [simplefin_holding()], ACCOUNT_ID)

    holding = db.get(Holding, "HOL-1")
    assert holding is not None
    assert holding.account_id == ACCOUNT_ID
    assert holding.market_value == Decimal("1500.00")


def test_updates_values_of_existing_holding(db, account):
    process_holdings(db, [simplefin_holding()], ACCOUNT_ID)

    process_holdings(
        db,
        [simplefin_holding(market_value="2400.00", shares="12", cost_basis="1300.00")],
        ACCOUNT_ID,
    )

    db.expire_all()
    holding = db.get(Holding, "HOL-1")
    assert holding.market_value == Decimal("2400.00")
    assert holding.shares == Decimal("12")
    assert holding.cost_basis == Decimal("1300.00")
    assert db.query(Holding).count() == 1


def test_returns_number_of_holdings_seen(db, account):
    process_holdings(db, [simplefin_holding()], ACCOUNT_ID)

    count = process_holdings(
        db, [simplefin_holding(), simplefin_holding(id="HOL-2", symbol="VTI")], ACCOUNT_ID
    )

    assert count == 2


def test_invalid_holding_is_skipped_without_aborting_others(db, account):
    process_holdings(db, [simplefin_holding()], ACCOUNT_ID)

    count = process_holdings(
        db,
        [
            simplefin_holding(market_value=None),  # SimpleFIN sent incomplete data
            simplefin_holding(id="HOL-2", symbol="VTI"),
        ],
        ACCOUNT_ID,
    )

    db.expire_all()
    assert db.get(Holding, "HOL-1").market_value == Decimal("1500.00")  # left as-is
    assert db.get(Holding, "HOL-2") is not None
    assert count == 1


def test_holding_missing_from_feed_is_removed(db, account):
    process_holdings(db, [simplefin_holding(), simplefin_holding(id="HOL-OLD")], ACCOUNT_ID)

    process_holdings(db, [simplefin_holding()], ACCOUNT_ID)

    assert db.get(Holding, "HOL-OLD") is None
    assert db.get(Holding, "HOL-1") is not None


def test_other_accounts_holdings_untouched(db, account):
    db.add(Account(id="ACT-2", name="Other", org_id="org-1"))
    db.commit()
    process_holdings(db, [simplefin_holding(id="HOL-OTHER")], "ACT-2")

    process_holdings(db, [simplefin_holding()], ACCOUNT_ID)

    assert db.get(Holding, "HOL-OTHER") is not None


def test_empty_feed_keeps_existing_holdings(db, account):
    process_holdings(db, [simplefin_holding()], ACCOUNT_ID)

    process_holdings(db, [], ACCOUNT_ID)

    assert db.get(Holding, "HOL-1") is not None


def test_invalid_holding_is_not_removed(db, account):
    process_holdings(db, [simplefin_holding()], ACCOUNT_ID)

    process_holdings(db, [simplefin_holding(market_value=None)], ACCOUNT_ID)

    assert db.get(Holding, "HOL-1") is not None

from app.models import Account, Org
from app.sync.simplefin import classify_accounts


def test_unclassifiable_account_does_not_crash(db):
    # No holdings, no keyword match, no transactions: nothing to classify by.
    db.add(Org(id="org-1", name="Bank"))
    db.add(Account(id="ACT-1", name="Zzz 1234", org_id="org-1"))
    db.commit()

    classify_accounts(db)

    assert db.get(Account, "ACT-1").account_type is None

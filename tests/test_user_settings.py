import pytest

from app.api.deps import get_current_user
from app.crud.user_settings import get_settings, update_settings
from app.models import User
from app.settings_registry import SettingsValidationError


@pytest.fixture
def user(db):
    return get_current_user(db)


def test_defaults_when_nothing_stored(db, user):
    out = get_settings(db, user)
    assert out.values == {
        "theme.mode": "dark",
        "theme.name": "grove",
        "onboarding.dismissed": False,
        "onboarding.visited.accounts": False,
        "onboarding.visited.categories": False,
        "updates.dismissed_version": None,
    }
    assert out.explicit == []


def test_update_is_persisted_and_marked_explicit(db, user):
    update_settings(db, user, {"theme.mode": "light"})
    out = get_settings(db, user)
    assert out.values["theme.mode"] == "light"
    assert out.explicit == ["theme.mode"]


def test_updating_one_key_leaves_others(db, user):
    update_settings(db, user, {"theme.mode": "light"})
    update_settings(db, user, {"onboarding.dismissed": True})
    out = get_settings(db, user)
    assert out.values["theme.mode"] == "light"
    assert out.values["onboarding.dismissed"] is True


@pytest.mark.parametrize(
    "changes",
    [
        {"nope": 1},
        {"theme.name": "neon"},
        {"onboarding.dismissed": "true"},
        {"updates.dismissed_version": 5},
    ],
)
def test_invalid_changes_rejected(db, user, changes):
    with pytest.raises(SettingsValidationError):
        update_settings(db, user, changes)


def test_invalid_change_writes_nothing(db, user):
    with pytest.raises(SettingsValidationError):
        update_settings(db, user, {"theme.mode": "light", "theme.name": "neon"})
    assert get_settings(db, user).explicit == []


def test_null_resets_non_nullable_key(db, user):
    update_settings(db, user, {"theme.mode": "light"})
    update_settings(db, user, {"theme.mode": None})
    out = get_settings(db, user)
    assert out.values["theme.mode"] == "dark"
    assert "theme.mode" not in out.explicit


def test_null_is_stored_for_nullable_key(db, user):
    update_settings(db, user, {"updates.dismissed_version": "v1.2.0"})
    update_settings(db, user, {"updates.dismissed_version": None})
    out = get_settings(db, user)
    assert out.values["updates.dismissed_version"] is None
    assert "updates.dismissed_version" in out.explicit


def test_current_user_created_once(db):
    assert get_current_user(db).id == get_current_user(db).id
    assert db.query(User).count() == 1

from app.utils import version_checker


def test_current_version_has_no_v_prefix(monkeypatch):
    monkeypatch.setenv("APP_VERSION", "v0.3.0")
    monkeypatch.setattr(
        version_checker,
        "check_github_release",
        lambda: {"latest_version": "0.3.0", "release_url": "u", "released_at": "t"},
    )

    info = version_checker.get_version_info()

    assert info["current_version"] == "0.3.0"
    assert info["update_available"] is False


def test_current_version_has_no_v_prefix_when_github_unreachable(monkeypatch):
    monkeypatch.setenv("APP_VERSION", "v0.3.0")
    monkeypatch.setattr(version_checker, "check_github_release", lambda: None)

    assert version_checker.get_version_info()["current_version"] == "0.3.0"


def test_dev_version_unchanged(monkeypatch):
    monkeypatch.delenv("APP_VERSION", raising=False)

    assert version_checker.get_version_info()["current_version"] == "dev"

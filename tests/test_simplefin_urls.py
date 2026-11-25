import pytest

from app.sync.simplefin import validate_simplefin_url


@pytest.mark.parametrize(
    "url",
    [
        "https://bridge.simplefin.org/simplefin/claim/abc",
        "https://beta-bridge.simplefin.org/simplefin/accounts",
    ],
)
def test_simplefin_hosts_allowed(url):
    validate_simplefin_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://bridge.simplefin.org/simplefin/claim/abc",  # not https
        "https://evil.example/claim",
        "https://169.254.169.254/latest/meta-data",
        "https://10.0.0.5/",
        "https://bridge.simplefin.org.evil.example/",
        "https://evil.example@bridge.simplefin.org.evil.example/",
        "file:///etc/passwd",
        "not a url",
    ],
)
def test_other_urls_rejected(url):
    with pytest.raises(ValueError):
        validate_simplefin_url(url)


def test_allowed_hosts_overridable(monkeypatch):
    monkeypatch.setenv("SIMPLEFIN_ALLOWED_HOSTS", "simplefin.internal.test")
    validate_simplefin_url("https://simplefin.internal.test/accounts")
    with pytest.raises(ValueError):
        validate_simplefin_url("https://bridge.simplefin.org/accounts")

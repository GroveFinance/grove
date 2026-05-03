import os
from datetime import datetime, timedelta

import requests

from app.logger import logger

# In-memory cache for GitHub API response
_cache = {
    "latest_version": None,
    "release_url": None,
    "released_at": None,
    "cached_at": None,
}
CACHE_TTL = timedelta(hours=6)  # Cache for 6 hours


def parse_semver(version_str: str) -> tuple[int, int, int]:
    """Parse semantic version string like 'v1.2.3' or '1.2.3' into (major, minor, patch)"""
    # Remove 'v' prefix if present
    version = version_str.lstrip("v")
    parts = version.split(".")

    if len(parts) != 3:
        logger.warning(f"Invalid version format: {version_str}, defaulting to 0.0.0")
        return (0, 0, 0)

    try:
        return (int(parts[0]), int(parts[1]), int(parts[2]))
    except ValueError:
        logger.warning(f"Invalid version numbers in: {version_str}, defaulting to 0.0.0")
        return (0, 0, 0)


def compare_versions(current: str, latest: str) -> bool:
    """
    Compare two semantic versions.
    Returns True if latest > current (update available)
    """
    current_tuple = parse_semver(current)
    latest_tuple = parse_semver(latest)
    return latest_tuple > current_tuple


def check_github_release() -> dict | None:
    """
    Check GitHub Releases API for latest version.
    Returns dict with latest_version, release_url, released_at or None on failure.
    Uses in-memory cache to avoid rate limiting.
    """
    global _cache

    # Check cache validity
    if _cache["cached_at"] and datetime.now() - _cache["cached_at"] < CACHE_TTL:
        logger.debug("Using cached GitHub release info")
        return {
            "latest_version": _cache["latest_version"],
            "release_url": _cache["release_url"],
            "released_at": _cache["released_at"],
        }

    try:
        # GitHub API endpoint for latest release
        url = "https://api.github.com/repos/GroveFinance/grove/releases/latest"

        # Add User-Agent header (required by GitHub API)
        headers = {"User-Agent": "Grove-Finance-App"}

        # Make request with timeout
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()

        data = response.json()

        # Update cache
        _cache = {
            "latest_version": data.get("tag_name", "").lstrip("v"),
            "release_url": data.get("html_url"),
            "released_at": data.get("published_at"),
            "cached_at": datetime.now(),  # type: ignore[dict-item]
        }

        logger.info(f"Fetched latest version from GitHub: {_cache['latest_version']}")

        return {
            "latest_version": _cache["latest_version"],
            "release_url": _cache["release_url"],
            "released_at": _cache["released_at"],
        }

    except requests.exceptions.Timeout:
        logger.warning("GitHub API request timed out")
        return None
    except requests.exceptions.RequestException as e:
        logger.warning(f"Failed to fetch latest version from GitHub: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error checking GitHub releases: {e}")
        return None


def get_version_info() -> dict:
    """
    Get complete version information including update availability.
    """
    current_version = os.getenv("APP_VERSION", "dev")

    # Don't check for updates in dev mode
    if current_version == "dev":
        return {
            "current_version": current_version,
            "latest_version": None,
            "update_available": False,
            "release_url": None,
            "released_at": None,
        }

    # Check GitHub for latest version
    github_info = check_github_release()

    if not github_info or not github_info.get("latest_version"):
        # Couldn't fetch from GitHub, return current info only
        return {
            "current_version": current_version,
            "latest_version": None,
            "update_available": False,
            "release_url": None,
            "released_at": None,
        }

    latest_version = github_info["latest_version"]
    update_available = compare_versions(current_version, latest_version)

    return {
        "current_version": current_version,
        "latest_version": latest_version,
        "update_available": update_available,
        "release_url": github_info["release_url"],
        "released_at": github_info["released_at"],
    }

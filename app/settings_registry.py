"""Registry of allowed per-user settings: key -> type and default.

To add a setting: add an entry here, add it to `SettingsValues` and
`DEFAULT_SETTINGS` in frontend/src/types/settings.ts.
"""

from dataclasses import dataclass
from typing import Any


class SettingsValidationError(ValueError):
    """Raised for unknown setting keys or values of the wrong type."""


@dataclass(frozen=True)
class SettingDef:
    kind: type  # exact type required (no coercion): bool or str
    default: Any
    choices: tuple[str, ...] | None = None
    nullable: bool = False


SETTINGS_REGISTRY: dict[str, SettingDef] = {
    "theme.mode": SettingDef(str, "dark", choices=("dark", "light", "system")),
    "theme.name": SettingDef(str, "grove", choices=("grove", "ocean", "sunset", "forest", "slate")),
    "onboarding.dismissed": SettingDef(bool, False),
    "onboarding.visited.accounts": SettingDef(bool, False),
    "onboarding.visited.categories": SettingDef(bool, False),
    "updates.dismissed_version": SettingDef(str, None, nullable=True),
}


def validate_setting(key: str, value: Any) -> Any:
    """Return the validated value, or raise SettingsValidationError.

    None is always accepted: for non-nullable keys it means "reset to default".
    """
    definition = SETTINGS_REGISTRY.get(key)
    if definition is None:
        raise SettingsValidationError(f"Unknown setting: {key}")
    if value is None:
        return None
    # type() rather than isinstance(): bool is a subclass of int, and we want no coercion.
    if type(value) is not definition.kind:
        raise SettingsValidationError(f"Invalid value for {key}: {value!r}")
    if definition.choices is not None and value not in definition.choices:
        raise SettingsValidationError(f"Invalid value for {key}: {value!r}")
    return value

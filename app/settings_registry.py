"""Registry of allowed per-user settings: key -> type and default.

To add a setting: add an entry here, add it to `SettingsValues` in
frontend/src/types/settings.ts, and give it a default in the mock API.
"""

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import StrictBool, StrictStr, TypeAdapter, ValidationError


class SettingsValidationError(ValueError):
    """Raised for unknown setting keys or values of the wrong type."""


@dataclass(frozen=True)
class SettingDef:
    adapter: TypeAdapter
    default: Any
    nullable: bool = False


SETTINGS_REGISTRY: dict[str, SettingDef] = {
    "theme.mode": SettingDef(TypeAdapter(Literal["dark", "light", "system"]), "dark"),
    "theme.name": SettingDef(
        TypeAdapter(Literal["grove", "ocean", "sunset", "forest", "slate"]), "grove"
    ),
    "onboarding.dismissed": SettingDef(TypeAdapter(StrictBool), False),
    "onboarding.visited.accounts": SettingDef(TypeAdapter(StrictBool), False),
    "onboarding.visited.categories": SettingDef(TypeAdapter(StrictBool), False),
    "updates.dismissed_version": SettingDef(TypeAdapter(StrictStr | None), None, nullable=True),
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
    try:
        return definition.adapter.validate_python(value, strict=True)
    except ValidationError as e:
        raise SettingsValidationError(f"Invalid value for {key}: {value!r}") from e

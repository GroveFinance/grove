// Per-user settings stored server-side. Keys must match app/settings_registry.py.
export type ThemeMode = "dark" | "light" | "system";
export type ThemeName = "grove" | "ocean" | "sunset" | "forest" | "slate";

export const THEME_MODES: readonly ThemeMode[] = ["dark", "light", "system"];
export const THEME_NAMES: readonly ThemeName[] = ["grove", "ocean", "sunset", "forest", "slate"];

export interface SettingsValues {
  "theme.mode": ThemeMode;
  "theme.name": ThemeName;
  "onboarding.dismissed": boolean;
  "onboarding.visited.accounts": boolean;
  "onboarding.visited.categories": boolean;
  "updates.dismissed_version": string | null;
}

export type SettingKey = keyof SettingsValues;

export interface SettingsResponse {
  values: SettingsValues;
  explicit: SettingKey[];
}

export interface OnboardingStatus {
  has_synced: boolean;
  has_rules: boolean;
}

export const DEFAULT_SETTINGS: SettingsValues = {
  "theme.mode": "dark",
  "theme.name": "grove",
  "onboarding.dismissed": false,
  "onboarding.visited.accounts": false,
  "onboarding.visited.categories": false,
  "updates.dismissed_version": null,
};

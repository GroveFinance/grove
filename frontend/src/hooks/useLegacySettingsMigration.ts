import { useEffect, useRef } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useSettings";
import { THEME_MODES, THEME_NAMES } from "@/types";
import type { SettingKey, SettingsValues } from "@/types";

const MIGRATED_FLAG = "grove_settings_migrated";

// Legacy keys removed after migration. The vite-ui-theme-* keys are kept:
// they remain the theme cache that prevents a flash on load.
const LEGACY_KEYS_TO_REMOVE = [
  "grove_onboarding_dismissed",
  "grove_accounts_visited",
  "grove_categories_visited",
  "grove_dismissed_update",
];

/** Build a settings patch from pre-server localStorage values (valid values only). */
function readLegacySettings(): Partial<SettingsValues> {
  const legacy: Partial<SettingsValues> = {};
  const mode = localStorage.getItem("vite-ui-theme-mode");
  if (mode && (THEME_MODES as readonly string[]).includes(mode)) {
    legacy["theme.mode"] = mode as SettingsValues["theme.mode"];
  }
  const name = localStorage.getItem("vite-ui-theme-name");
  if (name && (THEME_NAMES as readonly string[]).includes(name)) {
    legacy["theme.name"] = name as SettingsValues["theme.name"];
  }
  if (localStorage.getItem("grove_onboarding_dismissed") === "true") {
    legacy["onboarding.dismissed"] = true;
  }
  if (localStorage.getItem("grove_accounts_visited") === "true") {
    legacy["onboarding.visited.accounts"] = true;
  }
  if (localStorage.getItem("grove_categories_visited") === "true") {
    legacy["onboarding.visited.categories"] = true;
  }
  const dismissedUpdate = localStorage.getItem("grove_dismissed_update");
  if (dismissedUpdate) {
    legacy["updates.dismissed_version"] = dismissedUpdate;
  }
  return legacy;
}

function finishMigration() {
  LEGACY_KEYS_TO_REMOVE.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(MIGRATED_FLAG, "1");
}

/**
 * One-time push of preferences that used to live only in this browser.
 * Only keys the server has never stored are sent, so the first device wins.
 */
export function useLegacySettingsMigration(): void {
  const { data: settings } = useSettings();
  const { mutate } = useUpdateSettings();
  const started = useRef(false);

  useEffect(() => {
    if (!settings || started.current || localStorage.getItem(MIGRATED_FLAG)) return;
    started.current = true;

    const legacy = readLegacySettings();
    const patch = Object.fromEntries(
      Object.entries(legacy).filter(([key]) => !settings.explicit.includes(key as SettingKey))
    ) as Partial<SettingsValues>;

    if (Object.keys(patch).length === 0) {
      finishMigration();
      return;
    }
    mutate(patch, {
      onSuccess: finishMigration,
      onError: () => {
        started.current = false; // retry on a later load
      },
    });
  }, [settings, mutate]);
}

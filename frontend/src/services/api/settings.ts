import { fetchJSON } from "./base";
import type { OnboardingStatus, SettingsResponse, SettingsValues } from "@/types";

export const getSettings = () => fetchJSON<SettingsResponse>("/settings");

export const updateSettings = (changes: Partial<SettingsValues>) =>
  fetchJSON<SettingsResponse>("/settings", {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

export const getOnboardingStatus = () => fetchJSON<OnboardingStatus>("/settings/onboarding");

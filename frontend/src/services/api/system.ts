import { fetchJSON } from "./base";

export interface VersionInfo {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  release_url: string | null;
  released_at: string | null;
}

export interface SystemInfo {
  version: VersionInfo;
  environment: string;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return fetchJSON<SystemInfo>("/system/info");
}

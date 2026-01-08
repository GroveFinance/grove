import { fetchJSON } from "./base";
import type { SyncItem, SyncRun } from "@/types";

// Important: name here is both the unique name and the provider_name
// (currently we only support one sync provider per sync item)

export async function getSync(name = "simplefin") {
  try {
    return await fetchJSON<SyncItem>(`/sync/${encodeURIComponent(name)}`);
  } catch (err: any) {
    if (err.status === 404) {
      // Not found → return null so UI can redirect
      return null;
    }
    // rethrow other errors
    throw err;
  }
}

export function createSync(name: string, setupToken: string) {
  return fetchJSON<SyncItem>("/sync/", {
    method: "POST",
    body: JSON.stringify({ name, provider_name: name, config: { setup_token: setupToken } }),
  });
}

export function updateSync(name: string, setupToken: string) {
  return fetchJSON<SyncItem>(`/sync/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify({ config: { setup_token: setupToken } }),
  });
}

export const triggerSync = () => fetchJSON<void>("/sync/trigger/", { method: "POST" });

export async function triggerSyncFromDate(name = "simplefin", daysBack = 30, captureRaw = false) {
  return fetchJSON<{
    status: string;
    sync: string;
    from_date: string;
    days_back: number;
    capture_raw: boolean;
  }>(`/sync/${encodeURIComponent(name)}/trigger-from-date?days_back=${daysBack}&capture_raw=${captureRaw}`, {
    method: "POST",
  });
}

export async function getLatestSyncRun(name = "simplefin") {
  try {
    return await fetchJSON<SyncRun>(`/sync/${encodeURIComponent(name)}/runs/latest`);
  } catch (err: any) {
    if (err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function getSyncRuns(name = "simplefin", limit = 10) {
  return await fetchJSON<SyncRun[]>(`/sync/${encodeURIComponent(name)}/runs?limit=${limit}`);
}

export async function downloadRawResponse(runId: number): Promise<Blob> {
  const response = await fetch(
    `/api/sync/runs/${runId}/raw-response`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download raw response: ${response.statusText}`);
  }

  return response.blob();
}
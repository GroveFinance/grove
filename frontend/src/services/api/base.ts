// Use relative URL - browser will use same protocol as the page (HTTPS)
export const API_BASE_URL = "/api";

export async function fetchJSON<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const err = new Error(`API error: ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}
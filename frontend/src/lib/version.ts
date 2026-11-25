/** Format a bare version from /api/system/info for display: "0.3.0" -> "v0.3.0", "dev" -> "dev". */
export function formatVersion(version: string | null | undefined): string {
  if (!version) return "";
  const bare = version.replace(/^v/, "");
  return /^\d/.test(bare) ? `v${bare}` : bare;
}

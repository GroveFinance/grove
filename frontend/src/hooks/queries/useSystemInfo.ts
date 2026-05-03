import { useQuery } from "@tanstack/react-query";
import { getSystemInfo } from "@/services/api";
import type { SystemInfo } from "@/services/api/system";

const REFETCH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export function useSystemInfo() {
  return useQuery<SystemInfo>({
    queryKey: ["system", "info"],
    queryFn: getSystemInfo,
    staleTime: REFETCH_INTERVAL,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnMount: false, // Only fetch once on app load
    refetchOnWindowFocus: false, // Don't refetch on every focus
    retry: 1, // Only retry once on failure
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLatestSyncRun, triggerSync } from "@/services/api";
import { useState, useEffect } from "react";

/**
 * Global hook for tracking sync status across the entire app.
 * Polls for sync status when a sync is running.
 */
export function useGlobalSyncStatus() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch latest sync run
  const { data: latestRun, refetch } = useQuery({
    queryKey: ["global-sync-status"],
    queryFn: async () => {
      try {
        return await getLatestSyncRun("simplefin");
      } catch {
        return null;
      }
    },
    refetchInterval: (query) => {
      // Poll every 2 seconds if status is "running", otherwise don't poll
      const data = query.state.data;
      return data?.status === "running" ? 2000 : false;
    },
  });

  // Update local syncing state based on latest run status
  useEffect(() => {
    if (latestRun?.status === "running") {
      setIsSyncing(true);
    } else if (latestRun) {
      // If we have a run and it's not "running", it must be completed or failed
      setIsSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRun?.status]);

  // Mutation to trigger a sync
  const syncMutation = useMutation({
    mutationFn: async () => {
      await triggerSync();
    },
    onMutate: () => {
      setIsSyncing(true);
    },
    onSuccess: () => {
      // Invalidate all queries that depend on sync data
      queryClient.invalidateQueries({ queryKey: ["syncSettings"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });

      // Start polling for the new run
      setTimeout(() => refetch(), 1000);
    },
    onError: () => {
      setIsSyncing(false);
    },
  });

  const triggerSyncNow = () => {
    syncMutation.mutate();
  };

  return {
    latestRun,
    isSyncing,
    triggerSyncNow,
    refetch,
  };
}

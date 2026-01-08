import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSync, getSync, updateSync, triggerSync } from "@/services/api";
import type { SyncItem } from "@/types";

export function useSyncSettings(name: string = "simplefin") {
  const queryClient = useQueryClient();

  // Fetch sync config
  const { data, isLoading, isError, error, refetch } = useQuery<SyncItem | null>({
    queryKey: ["syncSettings", name],
    queryFn: async () => {
      try {
        return await getSync(name);
      } catch (err: any) {
        if (err.status === 404) return null;
        throw err;
      }
    },
  });

  // Mutation for creating/updating sync token
  const mutation = useMutation({
    mutationFn: async (token: string) => {
      const clean = token.trim();
      if (!clean) return;

      if (data) {
        return updateSync(name, clean);
      } else {
        return createSync(name, clean);
      }
    },
    onSuccess: async () => {
      // Refresh cached config
      queryClient.invalidateQueries({ queryKey: ["syncSettings", name] });
      // Trigger a sync immediately
      try {
        await triggerSync();
      } catch (err) {
        console.error("Automatic sync after token save failed:", err);
      }
    },
  });

  const saveToken = async (token: string) => {
    await mutation.mutateAsync(token);
  };

  const syncNow = async () => {
    await triggerSync();
    // Refresh settings after sync to update last_sync time
    await refetch();
  };

  return {
    data,
    loading: isLoading,
    error: isError ? (error as any)?.message : null,
    saveToken,
    refetch,
    syncNow,
  };
}

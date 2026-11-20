import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings } from "@/services/api";
import type { SettingKey, SettingsResponse, SettingsValues } from "@/types";

export const SETTINGS_QUERY_KEY = ["settings"] as const;

export function useSettings() {
  return useQuery<SettingsResponse, Error>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: getSettings,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation<
    SettingsResponse,
    Error,
    Partial<SettingsValues>,
    { previous?: SettingsResponse }
  >({
    mutationFn: updateSettings,
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEY });
      const previous = queryClient.getQueryData<SettingsResponse>(SETTINGS_QUERY_KEY);
      if (previous) {
        const changedKeys = Object.keys(changes) as SettingKey[];
        queryClient.setQueryData<SettingsResponse>(SETTINGS_QUERY_KEY, {
          values: { ...previous.values, ...changes },
          explicit: Array.from(new Set([...previous.explicit, ...changedKeys])).sort(),
        });
      }
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SETTINGS_QUERY_KEY, context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data);
    },
  });
}

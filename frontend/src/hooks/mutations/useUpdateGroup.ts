import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateGroup } from "@/services/api";
import type { GroupUpdate } from "@/types";

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: GroupUpdate }) =>
      updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error) => {
      console.error("Error updating group:", error);
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createGroup } from "@/services/api";
import type { GroupCreate } from "@/types";

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GroupCreate) => createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error) => {
      console.error("Error creating group:", error);
    },
  });
}

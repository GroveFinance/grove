import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteGroup } from "@/services/api";

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error) => {
      console.error("Error deleting group:", error);
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCategory } from "@/services/api";
import type { CategoryCreate } from "@/types";

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoryCreate) => createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (error) => {
      console.error("Error creating category:", error);
    },
  });
}

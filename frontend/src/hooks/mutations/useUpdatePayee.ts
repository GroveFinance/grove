import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePayee } from "@/services/api";
import type { PayeeUpdate } from "@/types";

export function useUpdatePayee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PayeeUpdate }) =>
      updatePayee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payees"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error) => {
      console.error("Error updating payee:", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["payees"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
  });
}
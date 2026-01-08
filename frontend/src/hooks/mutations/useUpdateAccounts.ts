import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateAccount } from "@/services/api"
import type { Account } from "@/types"

export function useUpdateAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ accountId, updates }: { accountId: string; updates: Partial<Pick<Account, "account_type" | "is_hidden" | "alt_name">> }) =>
      updateAccount(accountId, updates),
    onSuccess: (updated) => {
      // update cache for accounts list
      queryClient.setQueryData<Account[]>(["account"], (old) =>
        old ? old.map((a) => (a.account_id === updated.account_id ? updated : a)) : []
      )
    },
  })
}

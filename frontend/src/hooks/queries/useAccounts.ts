// hooks/useAccounts.ts
import { useQuery } from "@tanstack/react-query"
import { getAccounts } from "@/services/api"
import type { Account } from "@/types"

export function useAccounts(params?: {
  org_id?: string
  is_hidden?: boolean
  account_id?: string
}) {
  return useQuery<Account[]>({
    queryKey: ["accounts", params],
    queryFn: () => getAccounts(params),
  })
}
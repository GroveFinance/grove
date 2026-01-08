import { ACCOUNT_TYPE_OPTIONS } from "@/types"
import type { AccountType } from "@/types"

export const renderAccountTypeLabel = (type: AccountType | null) => {
  const found = ACCOUNT_TYPE_OPTIONS.find((o) => o.value === type)
  return found ? found.label : "Other"
}
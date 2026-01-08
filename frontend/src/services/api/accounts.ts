import { fetchJSON } from "./base";
import type { Account, GetAccountsParams } from "@/types";

export async function getAccounts(params: GetAccountsParams = {}): Promise<Account[]> {
  const query = new URLSearchParams()

  if (params?.org_id) query.append("org_id", params.org_id)
  if (params?.is_hidden !== undefined) query.append("is_hidden", String(params.is_hidden))
  if (params?.account_id) query.append("account_id", params.account_id)

  const endpoint = `/account/${query.toString() ? `?${query.toString()}` : ""}`

  return fetchJSON<Account[]>(endpoint)
}

/** PUT /api/accounts/{id} to update account_type/is_hidden */
export async function updateAccount(
  accountId: string,
  updates: Partial<Pick<Account, "account_type" | "is_hidden" | "alt_name">>,
): Promise<Account> {
  return fetchJSON<Account>(`/account/${accountId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

/** DELETE /api/account/{id} */
export async function deleteAccount(accountId: string): Promise<Account> {
  return fetchJSON<Account>(`/account/${accountId}`, {
    method: "DELETE",
  });
}

// Account from duplicate endpoint uses "account_id" and includes balance
export interface DuplicateAccount {
  account_id: string;
  name: string;
  alt_name?: string | null;
  display_name: string;
  currency: string;
  account_type: string | null;
  org_name: string;
  org_domain: string;
  balance: number | null;
  balance_date?: string | null;
  created_at?: string | null;
  is_hidden?: boolean;
}

export interface DuplicateGroup {
  org_id: string;
  name: string;
  accounts: DuplicateAccount[];
}

/** GET /api/account/duplicates */
export async function getDuplicateAccounts(): Promise<DuplicateGroup[]> {
  return fetchJSON<DuplicateGroup[]>("/account/duplicates/");
}

export interface MergeRequest {
  source_account_id: string;
  target_account_id: string;
  preserve_categorization?: boolean;
}

export interface MergeResponse {
  success: boolean;
  transactions_reassigned: number;
  transactions_removed: number;
  transactions_matched: number;
  holdings_reassigned: number;
  source_account_deleted: boolean;
  message: string;
}

/** POST /api/account/merge */
export async function mergeAccounts(request: MergeRequest): Promise<MergeResponse> {
  return fetchJSON<MergeResponse>("/account/merge/", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

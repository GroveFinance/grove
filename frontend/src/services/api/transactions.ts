import { fetchJSON } from "./base";
import type { GetTransactionsParams, Transaction } from "@/types";


export async function getTransactions(
  params: GetTransactionsParams = {}
): Promise<Transaction[]> {
  const query = new URLSearchParams()

  params.account_ids?.forEach(id => query.append("account_ids", id))
  params.excluded_account_ids?.forEach(id => query.append("excluded_account_ids", id))
  params.category_ids?.forEach(id => query.append("category_ids", id.toString()))
  params.excluded_category_ids?.forEach(id => query.append("excluded_category_ids", id.toString()))
  params.payee_ids?.forEach(id => query.append("payee_ids", id.toString()))
  if (params.payee_name) query.append("payee_name", params.payee_name)

  if (params.transacted_range?.from) query.append("transacted_start", params.transacted_range.from.toISOString())
  if (params.transacted_range?.to) query.append("transacted_end", params.transacted_range.to.toISOString())
  if (params.skip !== undefined) query.append("skip", params.skip.toString())
  if (params.limit !== undefined) query.append("limit", params.limit.toString())
  if (params.sort_by) query.append("sort_by", params.sort_by)
  if (params.sort_order) query.append("sort_order", params.sort_order)
  if (params.skip_transfers !== undefined) query.append("skip_transfers", params.skip_transfers.toString())
  if (params.split_mode !== undefined) query.append("split_mode", params.split_mode.toString())
  params.account_types?.forEach(type => query.append("account_types", type))
  params.exclude_account_types?.forEach(type => query.append("exclude_account_types", type))

  const url = `/transaction/?${query.toString()}`
  return fetchJSON<Transaction[]>(url)
}

export interface TransactionUpdatePayload {
  splits?: Array<{
    category_id: number;
    amount: string;
  }>;
  memo?: string;
}

export async function updateTransaction(
  id: string,
  data: TransactionUpdatePayload
): Promise<Transaction> {
  return fetchJSON<Transaction>(`/transaction/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export interface TransactionSummary {
  count: number;
  total_income: number;
  total_expense: number;
  net: number;
}

export async function getTransactionsSummary(
  params: GetTransactionsParams = {}
): Promise<TransactionSummary> {
  const query = new URLSearchParams()

  params.account_ids?.forEach(id => query.append("account_ids", id))
  params.excluded_account_ids?.forEach(id => query.append("excluded_account_ids", id))
  params.category_ids?.forEach(id => query.append("category_ids", id.toString()))
  params.excluded_category_ids?.forEach(id => query.append("excluded_category_ids", id.toString()))
  params.payee_ids?.forEach(id => query.append("payee_ids", id.toString()))
  if (params.payee_name) query.append("payee_name", params.payee_name)

  if (params.transacted_range?.from) query.append("transacted_start", params.transacted_range.from.toISOString())
  if (params.transacted_range?.to) query.append("transacted_end", params.transacted_range.to.toISOString())
  if (params.skip_transfers !== undefined) query.append("skip_transfers", params.skip_transfers.toString())
  params.account_types?.forEach(type => query.append("account_types", type))
  params.exclude_account_types?.forEach(type => query.append("exclude_account_types", type))

  const url = `/transaction/summary/stats?${query.toString()}`
  return fetchJSON<TransactionSummary>(url)
}



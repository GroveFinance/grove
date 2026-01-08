import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTransactions, getTransactionsSummary, updateTransaction, type TransactionUpdatePayload } from "@/services/api"
import type { Transaction, TransactionSplit, UseTransactionsParams } from "@/types"

export interface TransactionUI extends Transaction {
  payeeName: string
  accountName: string
  categoryName: string
  splits: TransactionSplit[]
}

function transformTransaction(t: Transaction): TransactionUI {
  let categoryName = "";

  // If only one split: resolve its category or payee fallback
  if (t.splits?.length === 1) {
    const s = t.splits[0];
    if (s.category?.id != null && s.category.id !== 0) {
      categoryName = s.category.name;
    } else if (t.payee?.category?.id != null && t.payee.category.id !== 0) {
      categoryName = t.payee.category.name;
    } else {
      categoryName = "Uncategorized";
    }
  }

  return {
    ...t,
    categoryName,
    payeeName: t.payee?.name ?? "",
    accountName: t.account?.display_name ?? "",
    splits: t.splits ?? [],
  };
}

export function useTransactions(params: UseTransactionsParams = {}) {
  const {enabled, account_ids, excluded_account_ids, category_ids, excluded_category_ids, payee_ids, payee_name, transacted_range, skip = 0, limit = 100, sort_by, sort_order, skip_transfers, split_mode, account_types, exclude_account_types } = params;

  return useQuery({
    enabled: enabled,
    queryKey: ["transactions", account_ids, excluded_account_ids, category_ids, excluded_category_ids, payee_ids, payee_name, transacted_range, skip, limit, sort_by, sort_order, skip_transfers, split_mode, account_types, exclude_account_types],
    queryFn: async () => {
      const txns = await getTransactions({ account_ids, excluded_account_ids, category_ids, excluded_category_ids, payee_ids, payee_name, transacted_range, skip, limit, sort_by, sort_order, skip_transfers, split_mode, account_types, exclude_account_types });
      return (txns ?? []).map(transformTransaction);
    },
  });
}

export function useInfiniteTransactions(params: UseTransactionsParams = {}) {
  const {enabled, account_ids, excluded_account_ids, category_ids, excluded_category_ids, payee_ids, payee_name, transacted_range, limit = 100, sort_by, sort_order, skip_transfers, split_mode, account_types, exclude_account_types } = params;

  return useInfiniteQuery({
    enabled: enabled,
    queryKey: ["transactions-infinite", account_ids, excluded_account_ids, category_ids, excluded_category_ids, payee_ids, payee_name, transacted_range, limit, sort_by, sort_order, skip_transfers, split_mode, account_types, exclude_account_types],
    queryFn: async ({ pageParam = 0 }) => {
      const txns = await getTransactions({
        account_ids,
        excluded_account_ids,
        category_ids,
        excluded_category_ids,
        payee_ids,
        payee_name,
        transacted_range,
        skip: pageParam,
        limit,
        sort_by,
        sort_order,
        skip_transfers,
        split_mode,
        account_types,
        exclude_account_types
      });
      return (txns ?? []).map(transformTransaction);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // If the last page is empty or has fewer items than the limit, we've reached the end
      if (!lastPage || lastPage.length === 0 || lastPage.length < limit) {
        return undefined;
      }
      // Calculate the next skip value
      return allPages.length * limit;
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionUpdatePayload }) =>
      updateTransaction(id, data),
    onSuccess: () => {
      // Invalidate all transaction queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });
    },
  });
}

export function useTransactionsSummary(params: UseTransactionsParams = {}) {
  const {enabled, account_ids, excluded_account_ids, category_ids, excluded_category_ids, payee_ids, payee_name, transacted_range, skip_transfers, account_types, exclude_account_types } = params;

  return useQuery({
    enabled: enabled,
    queryKey: ["transactions-summary", account_ids, excluded_account_ids, category_ids, excluded_category_ids, payee_ids, payee_name, transacted_range, skip_transfers, account_types, exclude_account_types],
    queryFn: async () => {
      return getTransactionsSummary({ account_ids, excluded_account_ids, category_ids, excluded_category_ids, payee_ids, payee_name, transacted_range, skip_transfers, account_types, exclude_account_types });
    },
  });
}
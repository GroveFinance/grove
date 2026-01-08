// services/api/account_balance.ts
import { fetchJSON } from "./base";

export interface AccountBalanceOut {
  id: number; // from your "from_attributes" output
  account_id: string;
  balance: number; // Decimal in Python → number in TS
  available_balance?: number | null;
  balance_date: string; // datetime → ISO string
}

export interface AccountBalanceCreate {
  account_id: string;
  balance: number;
  available_balance?: number | null;
  balance_date: string;
}

export interface AccountBalanceUpdate {
  account_id?: string;
  balance?: number;
  available_balance?: number | null;
  balance_date?: string;
}

/** GET /api/account_balances */
export function listAccountBalances() {
  return fetchJSON<AccountBalanceOut[]>(`/account_balance`);
}

/** GET /api/account_balances/{account_id} */
export function getAccountBalance(account_id: string) {
  return fetchJSON<AccountBalanceOut>(`/account_balance/${encodeURIComponent(account_id)}`);
}

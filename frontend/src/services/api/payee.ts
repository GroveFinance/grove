// ./service/api/payee.ts
import { fetchJSON } from "./base";

import type { Payee, PayeeUpdate } from "@/types";

export interface GetPayeesOptions {
  excludeInvestment?: boolean;
}

export async function getPayees(options?: GetPayeesOptions): Promise<Payee[]> {
  const params = new URLSearchParams();
  if (options?.excludeInvestment) {
    params.set("exclude_investment", "true");
  }
  const query = params.toString();
  return fetchJSON<Payee[]>(query ? `/payee?${query}` : "/payee");
}

export async function updatePayee(
  id: number,
  data: PayeeUpdate
): Promise<Payee> {
  return fetchJSON<Payee>(`/payee/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function exportPayees(): Promise<Blob> {
  const response = await fetch('/api/payee/export');
  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`);
  }
  return response.blob();
}

export interface PayeeImportResult {
  success: boolean;
  mode: string;
  payees_created: number;
  payees_updated: number;
  payees_skipped: number;
  errors: string[];
  warnings: string[];
}

export async function importPayees(
  file: File,
  mode: 'merge' | 'overwrite'
): Promise<PayeeImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/payee/import?mode=${mode}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Import failed: ${response.status}`);
  }

  return response.json();
}

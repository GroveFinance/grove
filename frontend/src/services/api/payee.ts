// ./service/api/payee.ts
import { fetchJSON } from "./base";

import type { Payee, PayeeUpdate } from "@/types";

export async function getPayees(): Promise<Payee[]> {
  return fetchJSON<Payee[]>("/payee/");
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

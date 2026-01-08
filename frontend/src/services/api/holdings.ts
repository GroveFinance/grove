import { fetchJSON } from "./base";
import type { Holding } from "@/types";

export interface GetHoldingsParams {
  account_id?: string;
  created_start?: Date;
  created_end?: Date;
  include_hidden?: boolean;
  skip?: number;
  limit?: number;
}

export async function getHoldings(
  params: GetHoldingsParams = {}
): Promise<Holding[]> {
  const query = new URLSearchParams();

  if (params.account_id) query.append("account_id", params.account_id);
  if (params.created_start) query.append("created_start", params.created_start.toISOString());
  if (params.created_end) query.append("created_end", params.created_end.toISOString());
  if (params.include_hidden !== undefined) query.append("include_hidden", params.include_hidden.toString());
  if (params.skip !== undefined) query.append("skip", params.skip.toString());
  if (params.limit !== undefined) query.append("limit", params.limit.toString());

  const url = `/holding/?${query.toString()}`;
  return fetchJSON<Holding[]>(url);
}

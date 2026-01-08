import { fetchJSON } from "./base";
import type { ReportOut, GetReportParams } from "@/types";



export async function getReport(params: GetReportParams): Promise<ReportOut> {
  const query = new URLSearchParams();
  // Handle dateRange conversion to start/end ISO strings
  if (params.dateRange) {
    if (params.dateRange.from) {
      params.start = params.dateRange.from.toISOString();
    }
    if (params.dateRange.to) {
      params.end = params.dateRange.to.toISOString();
    }
    delete params.dateRange;
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // Handle arrays (like exclude_account_types)
      if (Array.isArray(value)) {
        value.forEach(item => query.append(key, item.toString()));
      } else {
        query.append(key, value.toString());
      }
    }
  });

  //todo: probably worth changing the route
  return fetchJSON<ReportOut>(`/report?${query.toString()}`);
}
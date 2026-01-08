import { useQuery } from "@tanstack/react-query";
import { getHoldings, type GetHoldingsParams } from "@/services/api";

export function useHoldings(params: GetHoldingsParams = {}) {
  return useQuery({
    queryKey: ["holdings", params],
    queryFn: () => getHoldings(params),
  });
}

import { useQuery } from "@tanstack/react-query";
import { getPayees } from "@/services/api";
import type { Payee } from "@/types";

export interface UsePayeesOptions {
  excludeInvestment?: boolean;
}

export function usePayees(options?: UsePayeesOptions) {
  return useQuery<Payee[], Error>({
    queryKey: ["payees", options?.excludeInvestment ?? false],
    queryFn: () => getPayees({ excludeInvestment: options?.excludeInvestment }),
  });
}

import { useQuery } from "@tanstack/react-query";
import { getPayees} from "@/services/api";
import type { Payee } from "@/types";


export function usePayees() {
  return useQuery<Payee[], Error>({
    queryKey: ["payees"],
    queryFn: getPayees,
  });
}


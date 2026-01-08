import { useQuery } from "@tanstack/react-query";
import { getGroups, } from "@/services/api";
import type { Group } from "@/types";

export function useGroups() {
  return useQuery<Group[], Error>({
    queryKey: ["groups"],
    queryFn: getGroups,
  });
}
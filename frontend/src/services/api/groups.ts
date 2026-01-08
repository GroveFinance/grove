import { fetchJSON } from "./base";
import type { Group, GroupUpdate, GroupCreate } from "@/types/api-types";


export async function getGroups(): Promise<Group[]> {
  return fetchJSON<Group[]>("/group/");
}

export async function updateGroup(
  id: number,
  data: GroupUpdate
): Promise<Group> {
  return fetchJSON<Group>(`/group/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createGroup(data: GroupCreate): Promise<Group> {
  return fetchJSON<Group>("/group/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteGroup(id: number): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`/group/${id}`, {
    method: "DELETE",
  });
}
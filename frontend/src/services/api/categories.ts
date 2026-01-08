import { fetchJSON } from "./base";

import type { Category, CategoryUpdate, CategoryCreate } from "@/types";

export async function getCategories(): Promise<Category[]> {
  return fetchJSON<Category[]>("/category/");
}


export async function updateCategory(
  id: number,
  data: CategoryUpdate
): Promise<Category> {
  return fetchJSON<Category>(`/category/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function createCategory(
  data: CategoryCreate
): Promise<Category> {
  return fetchJSON<Category>("/category/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: number): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`/category/${id}`, {
    method: "DELETE",
  });
}
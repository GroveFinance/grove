import { fetchJSON } from "./base";

import type { Category, CategoryUpdate, CategoryCreate } from "@/types";

export async function getCategories(): Promise<Category[]> {
  return fetchJSON<Category[]>("/category");
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
  return fetchJSON<Category>("/category", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: number): Promise<{ success: boolean }> {
  return fetchJSON<{ success: boolean }>(`/category/${id}`, {
    method: "DELETE",
  });
}

export async function exportCategories(): Promise<Blob> {
  const response = await fetch('/api/category/export');
  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`);
  }
  return response.blob();
}

export interface CategoryImportResult {
  success: boolean;
  mode: string;
  groups_created: number;
  groups_updated: number;
  categories_created: number;
  categories_updated: number;
  categories_skipped: number;
  errors: string[];
  warnings: string[];
}

export async function importCategories(
  file: File,
  mode: 'merge' | 'overwrite'
): Promise<CategoryImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/category/import?mode=${mode}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Import failed: ${response.status}`);
  }

  return response.json();
}

export interface CategoryCreate {
  name: string;
  budget?: number | null;
  group_id: number; // Required for creating a new category
}

export interface CategoryUpdate {
  name?: string;
  budget?: number | null;
  group_id?: number | null; // Nullable to allow ungrouping
}

export interface PayeeUpdate {
  payee?: string; // todo: change to name
  category_id?: number | null;
}
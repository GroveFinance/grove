import type { Category, Group } from "@/types";
import type { SeededRandom } from "../config";

/**
 * Generate categories matching the production seed.py EXACTLY
 * Only categories with explicit budgets in seed.py have budgets here
 */

interface CategoryData {
  name: string;
  budget: number | null;
}

// Match INITIAL_CATEGORIES from app/seed.py EXACTLY
const CATEGORY_GROUPS: Record<string, CategoryData[]> = {
  "Income": [
    { name: "Paycheck", budget: null },
    { name: "Bonus", budget: null },
    { name: "Interest Income", budget: null },
    { name: "Investment Income", budget: null },
    { name: "Other Income", budget: null },
  ],
  "Bills & Utilities": [
    { name: "Electric", budget: null },
    { name: "Gas", budget: null },
    { name: "Water", budget: null },
    { name: "Trash", budget: null },
    { name: "Internet", budget: null },
    { name: "Mobile Phone", budget: null },
    { name: "TV/Streaming", budget: null },
    { name: "Rent", budget: null },
    { name: "Mortgage", budget: null },
    { name: "HOA Fees", budget: null },
    { name: "Other Bills", budget: null },
  ],
  "Home": [
    { name: "Home Improvement", budget: null },
    { name: "Home Services", budget: null },
    { name: "Furnishings", budget: null },
    { name: "Maintenance", budget: null },
    { name: "Home Insurance", budget: null },
  ],
  "Auto & Transport": [
    { name: "Gas & Fuel", budget: 200 },
    { name: "Auto Insurance", budget: null },
    { name: "Parking", budget: 40 },
    { name: "Service & Parts", budget: null },
    { name: "Auto Payment", budget: null },
    { name: "Public Transit", budget: 60 },
    { name: "Ride Share", budget: null },
  ],
  "Food & Dining": [
    { name: "Groceries", budget: 500 },
    { name: "Restaurants", budget: 200 },
    { name: "Fast Food", budget: 100 },
    { name: "Coffee Shops", budget: 50 },
    { name: "Alcohol & Bars", budget: 75 },
    { name: "Delivery", budget: 60 },
  ],
  "Shopping": [
    { name: "Clothing", budget: 100 },
    { name: "Electronics & Software", budget: null },
    { name: "Hobbies", budget: 75 },
    { name: "Sporting Goods", budget: null },
    { name: "Online Shopping", budget: null },
    { name: "Subscription Services", budget: 100 },
    { name: "Gifts & Donations", budget: null },
  ],
  "Health & Fitness": [
    { name: "Pharmacy", budget: null },
    { name: "Health Insurance", budget: null },
    { name: "Doctor", budget: null },
    { name: "Dentist", budget: null },
    { name: "Eye Care", budget: null },
    { name: "Gym", budget: null },
    { name: "Sports", budget: null },
  ],
  "Kids": [
    { name: "Childcare", budget: null },
    { name: "Kids Clothing", budget: 80 },
    { name: "Toys", budget: 40 },
    { name: "Baby Supplies", budget: 100 },
    { name: "Education", budget: 200 },
    { name: "Activities", budget: 100 },
  ],
  "Pets": [
    { name: "Pet Food", budget: 75 },
    { name: "Veterinary", budget: null },
    { name: "Grooming", budget: 40 },
    { name: "Boarding & Daycare", budget: 50 },
    { name: "Pet Supplies", budget: 30 },
  ],
  "Entertainment": [
    { name: "Movies", budget: 20 },
    { name: "Music", budget: 20 },
    { name: "Books", budget: 20 },
    { name: "Games", budget: 30 },
    { name: "Events", budget: 50 },
  ],
  "Personal Care": [
    { name: "Hair", budget: 40 },
    { name: "Spa & Massage", budget: null },
    { name: "Cosmetics", budget: 30 },
    { name: "Laundry", budget: null },
    { name: "Other Personal Care", budget: null },
  ],
  "Travel": [
    { name: "Airfare", budget: null },
    { name: "Hotel", budget: null },
    { name: "Rental Car & Taxi", budget: null },
    { name: "Vacation", budget: null },
    { name: "Other Travel", budget: null },
  ],
  "Finance": [
    { name: "Bank Fee", budget: null },
    { name: "Credit Card Payment", budget: null },
    { name: "Loan Payment", budget: null },
    { name: "Investment", budget: null },
    { name: "Savings", budget: null },
    { name: "Taxes", budget: null },
    { name: "Transfer", budget: null },
  ],
  "Uncategorized": [
    { name: "Miscellaneous", budget: null },
    { name: "Uncategorized", budget: null },
  ],
};

export function generateGroups(_rng: SeededRandom): Group[] {
  const groups: Group[] = [];
  let categoryId = 1; // Start at 1, 0 is reserved for "Uncategorized"
  let groupId = 1;

  for (const [groupName, categoryData] of Object.entries(CATEGORY_GROUPS)) {
    const categories: Category[] = categoryData.map((cat) => ({
      id: categoryId++,
      name: cat.name,
      budget: cat.budget,
    }));

    groups.push({
      id: groupId++,
      name: groupName,
      categories,
    });
  }

  return groups;
}

/**
 * Get all categories from groups (flat list)
 */
export function getAllCategories(groups: Group[]): Category[] {
  const categories: Category[] = [
    { id: 0, name: "Uncategorized", budget: null },
  ];

  for (const group of groups) {
    categories.push(...group.categories);
  }

  return categories;
}

/**
 * Find category by name (case-insensitive)
 */
export function findCategoryByName(
  categories: Category[],
  name: string
): Category | undefined {
  return categories.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get random expense category (excludes income, transfers, savings)
 */
export function getRandomExpenseCategory(
  categories: Category[],
  rng: SeededRandom
): Category {
  const expenseCategories = categories.filter(
    (c) =>
      c.id !== 0 && // Not uncategorized
      !c.name.toLowerCase().includes("paycheck") &&
      !c.name.toLowerCase().includes("bonus") &&
      !c.name.toLowerCase().includes("income") &&
      !c.name.toLowerCase().includes("transfer") &&
      !c.name.toLowerCase().includes("investment") &&
      !c.name.toLowerCase().includes("savings") &&
      !c.name.toLowerCase().includes("credit card payment")
  );

  return rng.choice(expenseCategories);
}

/**
 * Get income category
 */
export function getIncomeCategory(categories: Category[]): Category {
  return categories.find((c) => c.name === "Paycheck") || categories[0];
}

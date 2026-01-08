import type { Payee, Category } from "@/types";
import type { SeededRandom } from "../config";

/**
 * Generate realistic payees matching production categories from seed.py
 */

interface PayeeTemplate {
  name: string;
  categoryName: string;
  frequency?: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";
}

const PAYEE_TEMPLATES: PayeeTemplate[] = [
  // Income
  { name: "Employer Inc", categoryName: "Paycheck", frequency: "biweekly" },

  // Bills & Utilities (monthly recurring)
  { name: "Landlord Property Mgmt", categoryName: "Rent", frequency: "monthly" },
  { name: "City Electric Co", categoryName: "Electric", frequency: "monthly" },
  { name: "Gas Utility", categoryName: "Gas", frequency: "monthly" },
  { name: "Water District", categoryName: "Water", frequency: "monthly" },
  { name: "FastNet Internet", categoryName: "Internet", frequency: "monthly" },
  { name: "Verizon Wireless", categoryName: "Mobile Phone", frequency: "monthly" },
  { name: "Netflix", categoryName: "TV/Streaming", frequency: "monthly" },
  { name: "Spotify", categoryName: "TV/Streaming", frequency: "monthly" },
  { name: "HBO Max", categoryName: "TV/Streaming", frequency: "monthly" },

  // Auto & Transport
  { name: "Auto Finance Co", categoryName: "Auto Payment", frequency: "monthly" },
  { name: "State Farm", categoryName: "Auto Insurance", frequency: "monthly" },
  { name: "Shell", categoryName: "Gas & Fuel" },
  { name: "Chevron", categoryName: "Gas & Fuel" },
  { name: "BP Gas Station", categoryName: "Gas & Fuel" },
  { name: "Uber", categoryName: "Ride Share" },
  { name: "Lyft", categoryName: "Ride Share" },
  { name: "City Parking", categoryName: "Parking" },

  // Food & Dining
  { name: "Whole Foods", categoryName: "Groceries" },
  { name: "Trader Joes", categoryName: "Groceries" },
  { name: "Safeway", categoryName: "Groceries" },
  { name: "Costco", categoryName: "Groceries" },
  { name: "Kroger", categoryName: "Groceries" },
  { name: "Olive Garden", categoryName: "Restaurants" },
  { name: "Chipotle", categoryName: "Restaurants" },
  { name: "Local Bistro", categoryName: "Restaurants" },
  { name: "Thai Palace", categoryName: "Restaurants" },
  { name: "McDonalds", categoryName: "Fast Food" },
  { name: "Wendys", categoryName: "Fast Food" },
  { name: "Taco Bell", categoryName: "Fast Food" },
  { name: "Starbucks", categoryName: "Coffee Shops" },
  { name: "Peets Coffee", categoryName: "Coffee Shops" },
  { name: "DoorDash", categoryName: "Delivery" },
  { name: "Uber Eats", categoryName: "Delivery" },

  // Shopping
  { name: "Amazon", categoryName: "Online Shopping" },
  { name: "Target", categoryName: "Clothing" },
  { name: "Old Navy", categoryName: "Clothing" },
  { name: "Best Buy", categoryName: "Electronics & Software" },
  { name: "Apple Store", categoryName: "Electronics & Software" },
  { name: "REI", categoryName: "Sporting Goods" },
  { name: "Adobe Creative Cloud", categoryName: "Subscription Services", frequency: "monthly" },

  // Health & Fitness
  { name: "Blue Cross", categoryName: "Health Insurance", frequency: "monthly" },
  { name: "CVS Pharmacy", categoryName: "Pharmacy" },
  { name: "Walgreens", categoryName: "Pharmacy" },
  { name: "Planet Fitness", categoryName: "Gym", frequency: "monthly" },
  { name: "Dr. Smith Office", categoryName: "Doctor" },
  { name: "Dental Care", categoryName: "Dentist" },

  // Entertainment
  { name: "AMC Theatres", categoryName: "Movies" },
  { name: "Ticketmaster", categoryName: "Events" },
  { name: "Steam", categoryName: "Games" },
  { name: "Barnes & Noble", categoryName: "Books" },

  // Personal Care
  { name: "Great Clips", categoryName: "Hair" },
  { name: "Sephora", categoryName: "Cosmetics" },

  // Finance
  { name: "Credit Card Payment", categoryName: "Credit Card Payment" },
  { name: "Bank Transfer", categoryName: "Transfer" },
];

export function generatePayees(
  categories: Category[],
  _rng: SeededRandom
): Payee[] {
  const payees: Payee[] = [];
  let payeeId = 1;

  for (const template of PAYEE_TEMPLATES) {
    const category = categories.find(
      (c) => c.name === template.categoryName
    ) || categories[0]; // Fallback to Uncategorized

    payees.push({
      id: payeeId++,
      name: template.name,
      category_id: category.id,
      category: category,
    });
  }

  return payees;
}

/**
 * Find payee by name
 */
export function findPayeeByName(
  payees: Payee[],
  name: string
): Payee | undefined {
  return payees.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get payees by category
 */
export function getPayeesByCategory(
  payees: Payee[],
  categoryId: number
): Payee[] {
  return payees.filter((p) => p.category_id === categoryId);
}

/**
 * Get recurring payees (those with monthly frequency)
 */
export function getRecurringPayees(payees: Payee[]): Payee[] {
  const recurringNames = PAYEE_TEMPLATES
    .filter((t) => t.frequency === "monthly" || t.frequency === "biweekly")
    .map((t) => t.name);

  return payees.filter((p) => recurringNames.includes(p.name));
}

/**
 * Get payee frequency
 */
export function getPayeeFrequency(
  payeeName: string
): PayeeTemplate["frequency"] | undefined {
  return PAYEE_TEMPLATES.find((t) => t.name === payeeName)?.frequency;
}

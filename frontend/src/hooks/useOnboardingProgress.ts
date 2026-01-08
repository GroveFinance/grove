import { useState, useEffect } from "react";
import { fetchJSON } from "@/services/api/base";
import type { SyncItem, Category, Account, Payee } from "@/types";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
}

interface OnboardingProgress {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  isDismissed: boolean;
  dismiss: () => void;
  restore: () => void;
}

const DISMISSED_KEY = "grove_onboarding_dismissed";

export function useOnboardingProgress(): OnboardingProgress {
  const [syncConfig, setSyncConfig] = useState<SyncItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch sync config
        const sync = await fetchJSON<SyncItem>("/sync/simplefin").catch(() => null);
        setSyncConfig(sync);

        // Fetch categories
        const cats = await fetchJSON<Category[]>("/category/").catch(() => []);
        setCategories(cats);

        // Fetch accounts (only non-hidden ones - good enough for onboarding check)
        const accts = await fetchJSON<Account[]>("/account/").catch(() => []);
        setAccounts(accts);

        // Fetch payees (rules are payees with category_id !== 0)
        const payeesData = await fetchJSON<Payee[]>("/payee/").catch(() => []);
        setPayees(payeesData);
      } catch (error) {
        console.error("Failed to fetch onboarding data:", error);
      }
    };

    fetchData();
  }, []);

  const hasSyncConfig = syncConfig !== null && syncConfig.last_sync !== null;
  const hasCategories = categories.length > 1; // More than just "Uncategorized" (ID 0)
  const hasBudgets = categories.some((cat) => cat.budget && cat.budget > 0);

  // Account validation: Complete if we have accounts and they all have types assigned
  // SimpleFIN auto-assigns account types during sync, so this should auto-complete for most users
  const hasValidatedAccounts = accounts.length > 0 && accounts.every((acc) => acc.account_type !== null);

  const hasRules = payees.some((payee) => payee.category_id !== 0);

  const steps: OnboardingStep[] = [
    {
      id: "sync",
      title: "Connect SimpleFIN",
      description: "Set up sync and import your accounts",
      href: "/settings/sync",
      completed: hasSyncConfig,
    },
    {
      id: "accounts",
      title: "Validate Account Types",
      description: "Review and confirm account classifications",
      href: "/settings/accounts",
      completed: hasValidatedAccounts,
    },
    {
      id: "categories",
      title: "Set Up Categories & Budgets",
      description: "Organize spending and set budget limits",
      href: "/settings/categories",
      completed: hasCategories && hasBudgets,
    },
    {
      id: "rules",
      title: "Configure Payee Rules",
      description: "Automate transaction categorization",
      href: "/settings/rules",
      completed: hasRules,
    },
    {
      id: "overview",
      title: "View Your Overview",
      description: "See your financial snapshot",
      href: "/",
      completed: hasSyncConfig && hasCategories, // Complete when basic setup is done
    },
  ];

  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  const isComplete = completedCount === totalCount;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  const restore = () => {
    localStorage.removeItem(DISMISSED_KEY);
    setIsDismissed(false);
  };

  return {
    steps,
    completedCount,
    totalCount,
    isComplete,
    isDismissed,
    dismiss,
    restore,
  };
}

import { useState, useEffect, useCallback } from "react";
import { fetchJSON } from "@/services/api/base";
import type { SyncItem, Payee } from "@/types";

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
  refetch: () => void;
}

const DISMISSED_KEY = "grove_onboarding_dismissed";
export const CATEGORIES_VISITED_KEY = "grove_categories_visited";
export const ACCOUNTS_VISITED_KEY = "grove_accounts_visited";

export function useOnboardingProgress(): OnboardingProgress {
  const [syncConfig, setSyncConfig] = useState<SyncItem | null>(null);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  });

  const fetchData = useCallback(async () => {
    try {
      // Fetch sync config
      const sync = await fetchJSON<SyncItem>("/sync/simplefin").catch(() => null);
      setSyncConfig(sync);

      // Fetch payees (rules are payees with category_id !== 0)
      const payeesData = await fetchJSON<Payee[]>("/payee").catch(() => []);
      setPayees(payeesData ?? []);
    } catch (error) {
      console.error("Failed to fetch onboarding data:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Poll every 5 seconds to pick up sync completion
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const hasSyncConfig = syncConfig !== null && syncConfig.last_sync !== null;
  // Categories step is complete once user has visited the categories page
  const hasCategoriesVisited = localStorage.getItem(CATEGORIES_VISITED_KEY) === "true";
  // Accounts step is complete once user has visited the accounts page
  const hasAccountsVisited = localStorage.getItem(ACCOUNTS_VISITED_KEY) === "true";

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
      completed: hasAccountsVisited,
    },
    {
      id: "categories",
      title: "Set Up Categories & Budgets",
      description: "Organize spending and set budget limits",
      href: "/settings/categories",
      completed: hasCategoriesVisited,
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
      completed: hasSyncConfig && hasCategoriesVisited, // Complete when basic setup is done
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
    refetch: fetchData,
  };
}

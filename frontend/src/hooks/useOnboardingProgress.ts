import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOnboardingStatus } from "@/services/api";
import { useSettings, useUpdateSettings } from "@/hooks/queries/useSettings";

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
  isLoading: boolean;
  dismiss: () => void;
  restore: () => void;
  refetch: () => void;
}

export const ONBOARDING_STATUS_QUERY_KEY = ["onboarding-status"] as const;

export function useOnboardingProgress(): OnboardingProgress {
  const { data: settings } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();

  const isDismissed = settings?.values["onboarding.dismissed"] ?? false;

  // No polling: refreshed on window focus, after syncs complete, and after
  // payee changes (see useGlobalSyncStatus / useUpdatePayee).
  const { data: status, refetch } = useQuery({
    queryKey: ONBOARDING_STATUS_QUERY_KEY,
    queryFn: getOnboardingStatus,
    enabled: !!settings && !isDismissed,
  });

  const hasSynced = status?.has_synced ?? false;
  const hasRules = status?.has_rules ?? false;
  const hasAccountsVisited = settings?.values["onboarding.visited.accounts"] ?? false;
  const hasCategoriesVisited = settings?.values["onboarding.visited.categories"] ?? false;

  const steps: OnboardingStep[] = [
    {
      id: "sync",
      title: "Connect SimpleFIN",
      description: "Set up sync and import your accounts",
      href: "/settings/sync",
      completed: hasSynced,
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
      completed: hasSynced && hasCategoriesVisited, // Complete when basic setup is done
    },
  ];

  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;

  return {
    steps,
    completedCount,
    totalCount,
    isComplete: completedCount === totalCount,
    isDismissed,
    isLoading: !settings || (!isDismissed && !status),
    dismiss: () => updateSettings({ "onboarding.dismissed": true }),
    restore: () => updateSettings({ "onboarding.dismissed": false }),
    refetch: () => void refetch(),
  };
}

/** Mark an onboarding page as visited (once settings have loaded). */
export function useMarkOnboardingVisited(page: "accounts" | "categories"): void {
  const { data: settings } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const sent = useRef(false);
  const key = page === "accounts" ? "onboarding.visited.accounts" : "onboarding.visited.categories";

  useEffect(() => {
    if (!settings || sent.current || settings.values[key]) return;
    sent.current = true;
    updateSettings({ [key]: true });
  }, [settings, key, updateSettings]);
}

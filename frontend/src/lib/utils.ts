import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US",
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    signDisplay?: "auto" | "never" | "always" | "exceptZero";
  }
): string {
  // Handle NaN, undefined, null - convert to 0
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  // Determine fraction digits - if max is specified, use it for both min and max to avoid conflicts
  const maxFractionDigits = options?.maximumFractionDigits ?? 2;
  const minFractionDigits = options?.minimumFractionDigits ?? Math.min(2, maxFractionDigits);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
    signDisplay: options?.signDisplay,
  }).format(safeAmount)
}

export function noDataMessage<T>(
  data: T[] | undefined,
  isSuccess: boolean,
  message: string
): string | null {
  return isSuccess && (!data || data.length === 0) ? message : null
}
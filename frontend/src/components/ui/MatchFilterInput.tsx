/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { X, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type MatchType = "contains" | "exact" | "starts" | "ends";

interface MatchFilterInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  matchType?: MatchType;
  onMatchTypeChange?: (matchType: MatchType) => void;
  showMatchTypeSelector?: boolean;
}

export default function MatchFilterInput({
  value,
  onChange,
  placeholder = "Filter...",
  className = "",
  matchType = "contains",
  onMatchTypeChange,
  showMatchTypeSelector = true,
}: MatchFilterInputProps) {
  const [matchTypeOpen, setMatchTypeOpen] = useState(false);

  const matchTypeOptions = [
    { value: "contains" as const, label: "Contains" },
    { value: "exact" as const, label: "Exact match" },
    { value: "starts" as const, label: "Starts with" },
    { value: "ends" as const, label: "Ends with" },
  ];

  return (
    <div className={`relative ${className}`}>
      {showMatchTypeSelector && onMatchTypeChange && (
        <Popover open={matchTypeOpen} onOpenChange={setMatchTypeOpen}>
          <PopoverTrigger asChild>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 z-10"
              aria-label="Match type"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              {matchTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onMatchTypeChange(option.value);
                    setMatchTypeOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left"
                >
                  <Check
                    className={`h-4 w-4 ${
                      matchType === option.value ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${showMatchTypeSelector && onMatchTypeChange ? "pl-8" : ""} pr-8`}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear filter"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Helper function to apply match type filtering
 */
export function matchesFilter(
  text: string,
  filter: string,
  matchType: MatchType
): boolean {
  if (!filter) return true;

  const textLower = text.toLowerCase();
  const filterLower = filter.toLowerCase();

  switch (matchType) {
    case "contains":
      return textLower.includes(filterLower);
    case "exact":
      return textLower === filterLower;
    case "starts":
      return textLower.startsWith(filterLower);
    case "ends":
      return textLower.endsWith(filterLower);
  }
}

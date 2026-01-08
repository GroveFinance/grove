"use client";

import * as React from "react";
import { format, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronsUpDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { useLocation } from "react-router-dom";

// The Shadcn components are assumed to be available
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/**
 * Props for the TimeRangeSelector component.
 * @param {boolean} showCustom - A boolean to show or hide the custom calendar.
 * @param {boolean} showMode - A boolean to show or hide the "By Month" switch.
 * @param {string[]} selectOptions - An array of strings to specify which quick select options to show.
 * @param {string} defaultSelection - The initial selection, e.g., 'this_month', 'all', or 'none'.
 * @param {function} onUpdate - Callback function to receive the selected date range and mode.
 */
interface TimeRangeSelectorProps {
  showCustom?: boolean;
  showMode?: boolean;
  selectOptions?: string[];
  defaultSelection?: string;
  onUpdate: (dateRange: DateRange | undefined, byMonthMode: boolean) => void;
}

const presetOptions = [
  { value: 'this_month', label: 'This Month', months: 'this_month' },
  { value: 'last_month', label: 'Last Month', months: 'last_month' },
  { value: '3m', label: 'Last 3 Months', months: 3 },
  { value: '6m', label: 'Last 6 Months', months: 6 },
  { value: '12m', label: 'Last 12 Months', months: 12 },
  { value: 'all', label: 'All', months: 'all' },
];

/**
 * A custom time range selector that combines a calendar and presets
 * in a single popover.
 */
export default function TimeRangeSelector({ showCustom = false, showMode = false, selectOptions, defaultSelection, onUpdate }: TimeRangeSelectorProps) {
  const location = useLocation();
  const [date, setDate] = React.useState<DateRange | undefined>(undefined);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);
  const [isByMonthMode, setIsByMonthMode] = React.useState(false);
  const [urlParamsProcessed, setUrlParamsProcessed] = React.useState(false);

  // Function to apply a preset time range with typed parameters
  const applyPreset = React.useCallback((label: string, months: number | string) => {
    if (months === 'all') {
      setDate(undefined);
      setSelectedPreset(label);
      setIsPopoverOpen(false);
      onUpdate(undefined, isByMonthMode);
      return;
    }

    const today = new Date();
    let fromDate: Date;
    let toDate: Date;

    if (months === "this_month") {
      fromDate = startOfMonth(today);
      toDate = today;
    } else if (months === "last_month") {
      const lastMonth = subMonths(today, 1);
      fromDate = startOfMonth(lastMonth);
      toDate = endOfMonth(lastMonth);
    } else if (typeof months === 'number') {
      // For X months, get the start of the month (X-1) months ago to include current month
      // e.g., "Last 3 months" on Nov 27 = Sept 1 to Nov 27 (Sept, Oct, Nov)
      fromDate = startOfMonth(subMonths(today, months - 1));
      toDate = today;
    } else {
      // Fallback for any unexpected string values
      fromDate = today;
      toDate = today;
    }

    const newDateRange = {
      from: startOfDay(fromDate),
      to: endOfDay(toDate),
    };

    setDate(newDateRange);
    setSelectedPreset(label);
    setIsPopoverOpen(false); // Close popover on selection
    onUpdate(newDateRange, isByMonthMode);
  }, [isByMonthMode, onUpdate]);

  // Check URL parameters first (on mount and when location changes)
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const transactedStart = params.get("transacted_start");
    const transactedEnd = params.get("transacted_end");

    if (transactedStart && transactedEnd && !urlParamsProcessed) {
      // URL params take precedence - set the date range from URL
      // Parse dates - handle both ISO strings and simple YYYY-MM-DD format
      const parseLocalDate = (dateStr: string) => {
        try {
          // If it's an ISO string (contains T), parse directly
          if (dateStr.includes('T')) {
            return new Date(dateStr);
          }
          // Otherwise parse as YYYY-MM-DD
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            const [year, month, day] = parts.map(Number);
            return new Date(year, month - 1, day);
          }
          // Fallback to direct parsing
          return new Date(dateStr);
        } catch (error) {
          console.error('Error parsing date:', dateStr, error);
          return new Date();
        }
      };

      const newDateRange = {
        from: startOfDay(parseLocalDate(transactedStart)),
        to: endOfDay(parseLocalDate(transactedEnd)),
      };
      setDate(newDateRange);
      setSelectedPreset(null); // Clear preset when using URL params
      setUrlParamsProcessed(true);
      onUpdate(newDateRange, isByMonthMode);
    } else if (!urlParamsProcessed) {
      // No URL params - use default selection
      if (defaultSelection === 'none') {
        setDate(undefined);
        setSelectedPreset(null);
      } else {
        const defaultOption = presetOptions.find(opt => opt.value === defaultSelection) || presetOptions.find(opt => opt.value === 'this_month');
        if (defaultOption) {
          applyPreset(defaultOption.label, defaultOption.months);
        }
      }
      setUrlParamsProcessed(true);
    }
  }, [location.search, defaultSelection, urlParamsProcessed, applyPreset, isByMonthMode, onUpdate]);

  // Helper function to get the display text for the popover trigger
  const getDisplayDate = () => {
    if (selectedPreset) {
      return selectedPreset;
    }
    if (!date?.from) {
      return "Filter by date";
    }
    const fromDate = format(date.from, "MMM dd, yyyy");
    if (!date.to) {
      return fromDate;
    }
    const toDate = format(date.to, "MMM dd, yyyy");
    return `${fromDate} - ${toDate}`;
  };

  const handleDateSelect = (newDate: DateRange | undefined) => {
    setSelectedPreset(null); // Clear preset selection
    if (newDate?.from && newDate?.to) {
      const newDateRange = {
        from: startOfDay(newDate.from),
        to: endOfDay(newDate.to),
      };
      setDate(newDateRange);
      setIsPopoverOpen(false); // Close popover on full range selection
      onUpdate(newDateRange, isByMonthMode);
    } else {
      setDate(newDate);
    }
  };

  const handleByMonthChange = (checked: boolean) => {
    setIsByMonthMode(checked);
    onUpdate(date, checked);
  };

  const filteredOptions = selectOptions ? presetOptions.filter(opt => selectOptions.includes(opt.value)) : presetOptions;
  const showQuickSelect = filteredOptions.length > 0;

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          id="date-range-picker"
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left sm:w-[250px]",
            !date && "text-gray-500"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {getDisplayDate()}
          <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-xl" align="start">
        <div className="flex flex-col md:flex-row">
          {/* Preset Buttons on the left */}
          {showQuickSelect && (
            <div className="p-4 flex flex-col items-start gap-2">
              <h2 className="text-sm font-semibold mb-2 text-gray-700">Quick Select</h2>
              {filteredOptions.map((option) => (
                <Button 
                  key={option.value}
                  variant="ghost" 
                  className="rounded-lg w-full justify-start" 
                  onClick={() => applyPreset(option.label, option.months)}
                >
                  {option.label}
                </Button>
              ))}
              {showMode && (
                <div className="flex items-center space-x-2 mt-4">
                  <Switch
                    id="by-month-mode"
                    checked={isByMonthMode}
                    onCheckedChange={handleByMonthChange}
                  />
                  <Label htmlFor="by-month-mode">By Month</Label>
                </div>
              )}
            </div>
          )}

          {/* Vertical separator and Calendar, conditionally rendered */}
          {showCustom && (
            <>
              {showQuickSelect && <div className="w-px bg-gray-200 md:block hidden"></div>}
              <div className="p-4">
                <h2 className="text-sm font-semibold mb-2 text-gray-700">Custom Range</h2>
                <Calendar
                  autoFocus
                  required={false}
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={handleDateSelect}
                  numberOfMonths={1} // Use 1 month to make it more compact
                />
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
"use client";

import * as React from "react";
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronsRight } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface MonthSelectorProps {
  onUpdate: (dateRange: DateRange | undefined) => void;
  defaultMonth?: Date;
}

export default function MonthSelector({ onUpdate, defaultMonth }: MonthSelectorProps) {
  const [selectedMonth, setSelectedMonth] = React.useState<Date>(defaultMonth || new Date());
  const [open, setOpen] = React.useState(false);

  // Check if the selected month is the current month
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  // Generate months for the dropdown (current month + 11 previous months = 12 months)
  const monthOptions = React.useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      options.push(subMonths(today, i));
    }
    return options;
  }, []);

  // Update the date range when the selected month changes
  React.useEffect(() => {
    const fromDate = startOfDay(startOfMonth(selectedMonth));
    const toDate = endOfDay(endOfMonth(selectedMonth));
    onUpdate({ from: fromDate, to: toDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const handlePreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(new Date());
  };

  const handleMonthSelect = (month: Date) => {
    setSelectedMonth(month);
    setOpen(false);
  };

  return (
    <div className="inline-flex items-center gap-0">
      {/* Previous Month Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={handlePreviousMonth}
        className="rounded-r-none border-r-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Month Display / Selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={isCurrentMonth ? "rounded-l-none min-w-[150px]" : "rounded-none min-w-[150px] border-r-0"}
          >
            {format(selectedMonth, "MMMM yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="center"
          onInteractOutside={() => setOpen(false)}
        >
          <Command>
            <CommandList>
              <CommandEmpty>No month found.</CommandEmpty>
              <CommandGroup>
                {monthOptions.map((month) => (
                  <CommandItem
                    key={month.getTime()}
                    value={format(month, "MMMM yyyy")}
                    onSelect={() => handleMonthSelect(month)}
                    className="cursor-pointer"
                  >
                    {format(month, "MMMM yyyy")}
                    {isSameMonth(month, new Date()) && (
                      <span className="ml-auto text-xs text-muted-foreground">(Current)</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Jump to Current Button - only show when not on current month */}
      {!isCurrentMonth && (
        <Button
          variant="outline"
          size="icon"
          onClick={handleCurrentMonth}
          className="rounded-l-none"
          title="Go to current month"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

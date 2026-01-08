/*
Account combobox component supporting single and multi select with include/exclude functionality.
Usage:
// Single
const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
<AccountCombobox selectedId={selectedAccountId} onChange={setSelectedAccountId} />

// Multi with include/exclude
const [includedIds, setIncludedIds] = useState<string[]>([]);
const [excludedIds, setExcludedIds] = useState<string[]>([]);
<AccountCombobox
  multiSelect
  selectedIds={includedIds}
  onChange={setIncludedIds}
  excludedIds={excludedIds}
  onExcludeChange={setExcludedIds}
/>

// With filtering
<AccountCombobox excludeTypes={["investment"]} ... />
<AccountCombobox includeTypes={["investment"]} ... />
*/
import { cn } from "@/lib/utils";
import { useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useAccounts } from "@/hooks/queries/useAccounts";
import type { AccountType } from "@/types";

type BaseProps = {
  excludeTypes?: AccountType[];
  includeTypes?: AccountType[];
};

type Props = BaseProps &
  (
    | {
        multiSelect?: false;
        selectedId: string | null;
        onChange: (id: string | null) => void;
      }
    | {
        multiSelect: true;
        selectedIds: string[];
        onChange: (ids: string[]) => void;
        excludedIds?: string[];
        onExcludeChange?: (ids: string[]) => void;
      }
  );

export default function AccountCombobox(props: Props) {
  const [open, setOpen] = useState(false);
  const { data: allAccounts, isLoading } = useAccounts();

  // Filter accounts based on includeTypes/excludeTypes
  const accounts = allAccounts?.filter(account => {
    if (props.includeTypes && props.includeTypes.length > 0) {
      return account.account_type && props.includeTypes.includes(account.account_type);
    }
    if (props.excludeTypes && props.excludeTypes.length > 0) {
      return !account.account_type || !props.excludeTypes.includes(account.account_type);
    }
    return true;
  });

  // Single
  const selectedSingle =
    !props.multiSelect && props.selectedId && accounts
      ? accounts.find((a) => a.account_id === props.selectedId)
      : null;

  // Multi
  const selectedMulti =
    props.multiSelect && props.selectedIds && accounts
      ? accounts.filter((a) => props.selectedIds.includes(a.account_id))
      : [];

  const excludedMulti =
    props.multiSelect && props.excludedIds && accounts
      ? accounts.filter((a) => props.excludedIds?.includes(a.account_id))
      : [];

  // toggleSelect
  const toggleSelect = (id: string) => {
    if (!props.multiSelect) return;

    // If currently included, remove from included
    if (props.selectedIds.includes(id)) {
      props.onChange(props.selectedIds.filter((sid) => sid !== id));
    } else {
      // If currently excluded, remove from excluded first
      if (props.excludedIds?.includes(id) && props.onExcludeChange) {
        props.onExcludeChange(props.excludedIds.filter((eid) => eid !== id));
      }
      // Add to included
      props.onChange([...props.selectedIds, id]);
    }
  };

  const toggleExclude = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the main select from triggering
    if (!props.multiSelect || !props.onExcludeChange) return;

    const excludedIds = props.excludedIds || [];

    // If currently excluded, remove from excluded
    if (excludedIds.includes(id)) {
      props.onExcludeChange(excludedIds.filter((eid) => eid !== id));
    } else {
      // If currently included, remove from included first
      if (props.selectedIds.includes(id)) {
        props.onChange(props.selectedIds.filter((sid) => sid !== id));
      }
      // Add to excluded
      props.onExcludeChange([...excludedIds, id]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full sm:w-[250px] justify-between",
            (props.multiSelect ? selectedMulti.length === 0 && excludedMulti.length === 0 : !selectedSingle) && "text-muted-foreground"
          )}
        >
          {props.multiSelect ? (
            selectedMulti.length > 0 || excludedMulti.length > 0 ? (
              <>
                {selectedMulti.length > 0 && `${selectedMulti.length} selected`}
                {selectedMulti.length > 0 && excludedMulti.length > 0 && ", "}
                {excludedMulti.length > 0 && `${excludedMulti.length} excluded`}
              </>
            ) : (
              "Accounts"
            )
          ) : selectedSingle ? (
            selectedSingle.display_name
          ) : (
            "Account"
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full sm:w-[250px] p-0"
        onInteractOutside={() => setOpen(false)}
      >
        <Command>
          <CommandInput
            placeholder={
              isLoading
                ? "Loading accounts..."
                : !accounts || accounts.length === 0
                ? "No accounts found"
                : props.multiSelect
                ? "Search accounts..."
                : "Search account..."
            }
          />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>

            {props.multiSelect && (selectedMulti.length > 0 || excludedMulti.length > 0) && (
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() => {
                    props.onChange([]);
                    if (props.onExcludeChange) props.onExcludeChange([]);
                  }}
                  className="font-semibold text-destructive"
                >
                  Clear all
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Accounts">
            {!accounts || accounts.length === 0 ? (
              <CommandItem disabled>No accounts available</CommandItem>
            ) : (
              accounts.map((account) => {
                const isIncluded = props.multiSelect && props.selectedIds.includes(account.account_id);
                const isExcluded = props.multiSelect && props.excludedIds?.includes(account.account_id);

                return (
                  <CommandItem
                    key={account.account_id}
                    value={account.display_name}
                    onSelect={() => {
                      if (props.multiSelect) {
                        toggleSelect(account.account_id);
                      } else {
                        props.onChange(account.account_id);
                        setOpen(false); // single select closes immediately
                      }
                    }}
                    className={cn(
                      "cursor-pointer flex items-center justify-between",
                      isIncluded && "bg-green-500/10 text-green-700 dark:text-green-400",
                      isExcluded && "bg-red-500/10 text-red-700 dark:text-red-400"
                    )}
                  >
                    <div className="flex items-center flex-1">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          props.multiSelect
                            ? isIncluded
                              ? "opacity-100"
                              : "opacity-0"
                            : props.selectedId === account.account_id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {account.display_name}
                    </div>
                    {props.multiSelect && props.onExcludeChange && (
                      <div
                        onClick={(e) => toggleExclude(account.account_id, e)}
                        className={cn(
                          "ml-2 p-1 rounded-sm hover:bg-red-500/20 transition-colors",
                          isExcluded ? "text-red-600 dark:text-red-400" : "text-muted-foreground/50"
                        )}
                      >
                        <X className="h-4 w-4" />
                      </div>
                    )}
                  </CommandItem>
                );
              })
            )}
          </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

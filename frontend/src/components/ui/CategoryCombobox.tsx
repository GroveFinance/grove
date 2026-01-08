/*
for selecting categories from groups
Supports single and multi select modes with include/exclude functionality.
Usage:
// Single
const [selectedId, setSelectedId] = useState<number | null>(null);
<CategoryCombobox selectedId={selectedId} onChange={setSelectedId} />

// Multi with include/exclude
const [includedIds, setIncludedIds] = useState<number[]>([]);
const [excludedIds, setExcludedIds] = useState<number[]>([]);
<CategoryCombobox
  multiSelect
  selectedIds={includedIds}
  onChange={setIncludedIds}
  excludedIds={excludedIds}
  onExcludeChange={setExcludedIds}
/>

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
import { useGroups } from "@/hooks/queries/useGroups";

type Props =
  | {
      multiSelect?: false;
      selectedId: number | null;
      onChange: (id: number | null) => void;
    }
  | {
      multiSelect: true;
      selectedIds: number[];
      onChange: (ids: number[]) => void;
      excludedIds?: number[];
      onExcludeChange?: (ids: number[]) => void;
    };

export default function CategoryCombobox(props: Props) {
  const [open, setOpen] = useState(false);
  const { data: groups, isLoading } = useGroups();

  const flatCategories = groups?.flatMap((g) => g.categories) ?? [];

  // Single select
  const selectedSingle =
    !props.multiSelect && props.selectedId
      ? flatCategories.find((c) => c.id === props.selectedId)
      : null;

  // Multi select
  const selectedMulti =
    props.multiSelect && props.selectedIds
      ? flatCategories.filter((c) => props.selectedIds.includes(c.id))
      : [];

  const excludedMulti =
    props.multiSelect && props.excludedIds
      ? flatCategories.filter((c) => props.excludedIds?.includes(c.id))
      : [];

  const toggleSelect = (id: number) => {
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

  const toggleExclude = (id: number, e: React.MouseEvent) => {
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
              "Categories"
            )
          ) : selectedSingle ? (
            selectedSingle.name
          ) : (
            "Category"
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
              props.multiSelect ? "Search categories..." : "Search category..."
            }
          />
          <CommandList>
          {/* Loading / empty states */}
          {isLoading ? (
            <CommandEmpty>Loading categories…</CommandEmpty>
          ) : flatCategories.length === 0 ? (
            <CommandEmpty>No categories found.</CommandEmpty>
          ) : null}

          {/* Multi-select "Clear all" */}
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

          {/* Only render groups if they exist */}
          {groups?.map((group) => (
            <CommandGroup key={group.id} heading={group.name}>
              {group.categories?.map((cat) => {
                const isIncluded = props.multiSelect && props.selectedIds.includes(cat.id);
                const isExcluded = props.multiSelect && props.excludedIds?.includes(cat.id);

                return (
                  <CommandItem
                    key={cat.id}
                    value={cat.name}
                    onSelect={() => {
                      if (props.multiSelect) toggleSelect(cat.id);
                      else {
                        props.onChange(cat.id);
                        setOpen(false);
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
                            : props.selectedId === cat.id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {cat.name}
                    </div>
                    {props.multiSelect && props.onExcludeChange && (
                      <div
                        onClick={(e) => toggleExclude(cat.id, e)}
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
              })}
            </CommandGroup>
          ))}
        </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

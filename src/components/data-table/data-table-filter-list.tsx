"use client";

import type { Table } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import * as React from "react";

import { DataTableFilterItem } from "@/components/data-table/data-table-filter-item";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ExtendedColumnFilter } from "@/types/data-table";

interface DataTableFilterListProps<TData>
  extends React.ComponentProps<typeof PopoverContent> {
  table: Table<TData>;
  advancedFilters: {
    allFilters: ExtendedColumnFilter<TData>[];
    addFilter: (columnId: string) => void;
    updateFilter: (
      filterId: string,
      updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
    ) => void;
    removeFilter: (filterId: string) => void;
  };
}

export function DataTableFilterList<TData>({
  table,
  advancedFilters,
}: DataTableFilterListProps<TData>) {
  const [showAddFilterMenu, setShowAddFilterMenu] = React.useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

  const columns = React.useMemo(() => {
    return table
      .getAllColumns()
      .filter((column) => column.columnDef.enableColumnFilter);
  }, [table]);

  const { allFilters, addFilter, updateFilter, removeFilter } = advancedFilters;

  // Get columns that don't have active filters
  const availableColumns = React.useMemo(() => {
    const activeColumnIds = new Set(
      allFilters.map((filter) => filter.id as string),
    );
    return columns.filter(
      (column) => column.id && !activeColumnIds.has(column.id),
    );
  }, [columns, allFilters]);

  const onFilterAdd = React.useCallback(
    (columnId: string) => {
      addFilter(columnId);
      setShowAddFilterMenu(false);
    },
    [addFilter],
  );

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Add Filter Button */}
      <Popover open={showAddFilterMenu} onOpenChange={setShowAddFilterMenu}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            ref={addButtonRef}
            title="Add filter"
          >
            <Plus className="size-4" />
            Add filter
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 origin-[var(--radix-popover-content-transform-origin)] p-0"
        >
          <Command>
            <CommandInput placeholder="Search fields..." />
            <CommandList>
              <CommandEmpty>No fields found.</CommandEmpty>
              <CommandGroup>
                {availableColumns.map((column) => (
                  <CommandItem
                    key={column.id}
                    value={column.id}
                    onSelect={() => {
                      onFilterAdd(column.id);
                    }}
                  >
                    {column.columnDef.meta?.icon && (
                      <column.columnDef.meta.icon className="mr-2 size-4" />
                    )}
                    <span className="truncate">
                      {column.columnDef.meta?.label ?? column.id}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Applied Filters */}
      {allFilters.map((filter) => {
        const column = columns.find((col) => col.id === filter.id);
        if (!column) return null;

        return (
          <DataTableFilterItem<TData>
            key={filter.filterId}
            filter={filter}
            column={column}
            onFilterUpdate={updateFilter}
            onFilterRemove={removeFilter}
          />
        );
      })}
    </div>
  );
}

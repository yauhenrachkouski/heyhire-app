"use client";

import type { Column } from "@tanstack/react-table";
import { X } from "lucide-react";
import * as React from "react";

import { BooleanFilterInput } from "@/components/data-table/filter-inputs/boolean-filter-input";
import { DateFilterInput } from "@/components/data-table/filter-inputs/date-filter-input";
import { SelectFilterInput } from "@/components/data-table/filter-inputs/select-filter-input";
import { TextFilterInput } from "@/components/data-table/filter-inputs/text-filter-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFilterOperators } from "@/lib/data-table";
import type { ExtendedColumnFilter, FilterOperator } from "@/types/data-table";

interface DataTableFilterItemProps<TData> {
  filter: ExtendedColumnFilter<TData>;
  column: Column<TData>;
  onFilterUpdate: (
    filterId: string,
    updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
  ) => void;
  onFilterRemove: (filterId: string) => void;
}

export function DataTableFilterItem<TData>({
  filter,
  column,
  onFilterUpdate,
  onFilterRemove,
}: DataTableFilterItemProps<TData>) {
  const [showValueSelector, setShowValueSelector] = React.useState(false);
  const columnMeta = column.columnDef.meta;
  const filterOperators = getFilterOperators(filter.variant);
  const filterId = React.useId();
  const inputId = `${filterId}-input`;

  return (
    <div
      className="flex items-center gap-0 rounded-md border border-border shadow-xs shadow-black/5"
      data-slot="filter-item"
    >
      {/* Field Name Section */}
      <div
        className="flex shrink-0 items-center gap-1.5  bg-background px-3 py-1 text-sm text-foreground"
        data-slot="filter-field"
      >
        {columnMeta?.icon && (
          <columnMeta.icon className="size-3.5 shrink-0 opacity-60" />
        )}  
        <span className="truncate text-sm font-medium">
          {columnMeta?.label ?? column.id}
        </span>
      </div>

      {/* Operator Select */}
      <Select
        value={filter.operator}
        onValueChange={(value: FilterOperator) =>
          onFilterUpdate(filter.filterId, {
            operator: value,
            value:
              value === "isEmpty" || value === "isNotEmpty"
                ? ""
                : filter.value,
          })
        }
      >
        <SelectTrigger
          aria-label="Filter operator"
          className="h-9 px-3 py-1 text-sm lowercase [&[data-size]]:h-9 border-0 border-e border-s bg-background shadow-none rounded-none"
          data-slot="dropdown-menu-trigger"
        >
          <SelectValue placeholder={filter.operator} />
        </SelectTrigger>
        <SelectContent position="popper" className="lowercase">
          {filterOperators.map((operator) => (
            <SelectItem
              key={operator.value}
              value={operator.value}
              className="lowercase"
            >
              {operator.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input Section */}
      <div className="flex-1 border-e">
        {renderFilterInput(
          filter,
          column,
          inputId,
          showValueSelector,
          setShowValueSelector,
          onFilterUpdate,
        )}
      </div>

      {/* Remove Button */}
      <Button
        aria-label="Remove filter"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-none"
        onClick={() => onFilterRemove(filter.filterId)}
        data-slot="filters-remove"
      >
        <X className="size-3.5 opacity-60" />
      </Button>
    </div>
  );
}

/**
 * Renders the appropriate filter input component based on filter variant
 */
function renderFilterInput<TData>(
  filter: ExtendedColumnFilter<TData>,
  column: Column<TData>,
  inputId: string,
  showValueSelector: boolean,
  setShowValueSelector: (value: boolean) => void,
  onFilterUpdate: (
    filterId: string,
    updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
  ) => void,
) {
  const columnMeta = column.columnDef.meta;

  // Empty/not-empty operators don't need value input
  if (filter.operator === "isEmpty" || filter.operator === "isNotEmpty") {
    return (
      <div
        id={inputId}
        role="status"
        aria-label={`${columnMeta?.label} filter is ${
          filter.operator === "isEmpty" ? "empty" : "not empty"
        }`}
        aria-live="polite"
        className="h-9 w-full bg-muted/50"
      />
    );
  }

  // Delegate to specific input components based on variant
  switch (filter.variant) {
    case "text":
    case "number":
    case "range":
      return (
        <TextFilterInput
          filter={filter}
          column={column}
          inputId={inputId}
          onFilterUpdate={onFilterUpdate}
        />
      );

    case "boolean":
      return (
        <BooleanFilterInput
          filter={filter}
          column={column}
          inputId={inputId}
          showValueSelector={showValueSelector}
          setShowValueSelector={setShowValueSelector}
          onFilterUpdate={onFilterUpdate}
        />
      );

    case "select":
    case "multiSelect":
      return (
        <SelectFilterInput
          filter={filter}
          column={column}
          inputId={inputId}
          showValueSelector={showValueSelector}
          setShowValueSelector={setShowValueSelector}
          onFilterUpdate={onFilterUpdate}
        />
      );

    case "date":
    case "dateRange":
      return (
        <DateFilterInput
          filter={filter}
          column={column}
          inputId={inputId}
          showValueSelector={showValueSelector}
          setShowValueSelector={setShowValueSelector}
          onFilterUpdate={onFilterUpdate}
        />
      );

    default:
      return null;
  }
}

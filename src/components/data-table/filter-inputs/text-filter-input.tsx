import type { Column } from "@tanstack/react-table";
import * as React from "react";

import { DataTableRangeFilter } from "@/components/data-table/data-table-range-filter";
import { Input } from "@/components/ui/input";
import type { ExtendedColumnFilter } from "@/types/data-table";

interface TextFilterInputProps<TData> {
  filter: ExtendedColumnFilter<TData>;
  column: Column<TData>;
  inputId: string;
  onFilterUpdate: (
    filterId: string,
    updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
  ) => void;
}

export function TextFilterInput<TData>({
  filter,
  column,
  inputId,
  onFilterUpdate,
}: TextFilterInputProps<TData>) {
  const columnMeta = column.columnDef.meta;

  // Handle range filter for "isBetween" operator
  if (filter.operator === "isBetween") {
    return (
      <DataTableRangeFilter
        filter={filter}
        column={column}
        inputId={inputId}
        onFilterUpdate={onFilterUpdate}
      />
    );
  }

  // Handle number input for number/range variants
  const isNumber = filter.variant === "number" || filter.variant === "range";

  return (
    <Input
      id={inputId}
      type={isNumber ? "number" : "text"}
      aria-label={`${columnMeta?.label} filter value`}
      inputMode={isNumber ? "numeric" : undefined}
      placeholder={columnMeta?.placeholder ?? "Enter a value..."}
      className="h-9 w-full rounded-none border-0 text-sm"
      defaultValue={
        typeof filter.value === "string" ? filter.value : undefined
      }
      onChange={(event) =>
        onFilterUpdate(filter.filterId, {
          value: event.target.value,
        })
      }
    />
  );
}


import type { Column } from "@tanstack/react-table";
import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExtendedColumnFilter } from "@/types/data-table";

interface BooleanFilterInputProps<TData> {
  filter: ExtendedColumnFilter<TData>;
  column: Column<TData>;
  inputId: string;
  showValueSelector: boolean;
  setShowValueSelector: (value: boolean) => void;
  onFilterUpdate: (
    filterId: string,
    updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
  ) => void;
}

export function BooleanFilterInput<TData>({
  filter,
  column,
  inputId,
  showValueSelector,
  setShowValueSelector,
  onFilterUpdate,
}: BooleanFilterInputProps<TData>) {
  const columnMeta = column.columnDef.meta;

  if (Array.isArray(filter.value)) return null;

  return (
    <Select
      open={showValueSelector}
      onOpenChange={setShowValueSelector}
      value={filter.value}
      onValueChange={(value) =>
        onFilterUpdate(filter.filterId, {
          value,
        })
      }
    >
      <SelectTrigger
        id={inputId}
        aria-label={`${columnMeta?.label} boolean filter`}
        className="h-9 w-full rounded-none border-0 text-sm [&[data-size]]:h-9"
      >
        <SelectValue placeholder={filter.value ? "True" : "False"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="true">True</SelectItem>
        <SelectItem value="false">False</SelectItem>
      </SelectContent>
    </Select>
  );
}


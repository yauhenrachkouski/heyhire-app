import type { Column } from "@tanstack/react-table";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Faceted,
  FacetedBadgeList,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedTrigger,
} from "@/components/ui/faceted";
import type { ExtendedColumnFilter } from "@/types/data-table";

interface SelectFilterInputProps<TData> {
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

export function SelectFilterInput<TData>({
  filter,
  column,
  inputId,
  showValueSelector,
  setShowValueSelector,
  onFilterUpdate,
}: SelectFilterInputProps<TData>) {
  const columnMeta = column.columnDef.meta;
  const multiple = filter.variant === "multiSelect";

  const selectedValues = multiple
    ? Array.isArray(filter.value)
      ? filter.value
      : []
    : typeof filter.value === "string"
      ? filter.value
      : undefined;

  return (
    <Faceted
      open={showValueSelector}
      onOpenChange={setShowValueSelector}
      value={selectedValues}
      onValueChange={(value) => {
        onFilterUpdate(filter.filterId, {
          value,
        });
      }}
      multiple={multiple}
    >
      <FacetedTrigger asChild>
        <Button
          id={inputId}
          aria-label={`${columnMeta?.label} filter value${multiple ? "s" : ""}`}
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-start rounded-none px-3 text-sm font-normal"
        >
          <FacetedBadgeList
            options={columnMeta?.options}
            placeholder={
              columnMeta?.placeholder ??
              `Select option${multiple ? "s" : ""}...`
            }
          />
        </Button>
      </FacetedTrigger>
      <FacetedContent className="w-[200px]">
        <FacetedInput
          aria-label={`Search ${columnMeta?.label} options`}
          placeholder={columnMeta?.placeholder ?? "Search options..."}
        />
        <FacetedList>
          <FacetedEmpty>No options found.</FacetedEmpty>
          <FacetedGroup>
            {columnMeta?.options?.map((option) => (
              <FacetedItem key={option.value} value={option.value}>
                {option.icon && <option.icon />}
                <span>{option.label}</span>
                {option.count && (
                  <span className="ml-auto font-mono text-xs">
                    {option.count}
                  </span>
                )}
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}


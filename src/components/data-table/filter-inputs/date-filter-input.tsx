import type { Column } from "@tanstack/react-table";
import { IconCalendar } from "@tabler/icons-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExtendedColumnFilter } from "@/types/data-table";

interface DateFilterInputProps<TData> {
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

export function DateFilterInput<TData>({
  filter,
  column,
  inputId,
  showValueSelector,
  setShowValueSelector,
  onFilterUpdate,
}: DateFilterInputProps<TData>) {
  const columnMeta = column.columnDef.meta;

  const dateValue = Array.isArray(filter.value)
    ? filter.value.filter(Boolean)
    : [filter.value, filter.value].filter(Boolean);

  const displayValue =
    filter.operator === "isBetween" && dateValue.length === 2
      ? `${formatDate(new Date(Number(dateValue[0])))} - ${formatDate(
          new Date(Number(dateValue[1])),
        )}`
      : dateValue[0]
        ? formatDate(new Date(Number(dateValue[0])))
        : "Pick a date";

  return (
    <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
      <PopoverTrigger asChild>
        <Button
          id={inputId}
          aria-label={`${columnMeta?.label} date filter`}
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 w-full justify-start rounded-none px-3 text-sm font-normal",
            !filter.value && "text-muted-foreground",
          )}
        >
          <IconCalendar className="mr-2 size-4 shrink-0" />
          <span className="truncate">{displayValue}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {filter.operator === "isBetween" ? (
          <Calendar
            aria-label={`Select ${columnMeta?.label} date range`}
            mode="range"
            captionLayout="dropdown"
            selected={
              dateValue.length === 2
                ? {
                    from: new Date(Number(dateValue[0])),
                    to: new Date(Number(dateValue[1])),
                  }
                : {
                    from: new Date(),
                    to: new Date(),
                  }
            }
            onSelect={(date) => {
              onFilterUpdate(filter.filterId, {
                value: date
                  ? [
                      (date.from?.getTime() ?? "").toString(),
                      (date.to?.getTime() ?? "").toString(),
                    ]
                  : [],
              });
            }}
          />
        ) : (
          <Calendar
            aria-label={`Select ${columnMeta?.label} date`}
            mode="single"
            captionLayout="dropdown"
            selected={
              dateValue[0] ? new Date(Number(dateValue[0])) : undefined
            }
            onSelect={(date) => {
              onFilterUpdate(filter.filterId, {
                value: (date?.getTime() ?? "").toString(),
              });
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}


"use client";

import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  parseAsInteger,
  type UseQueryStateOptions,
  useQueryState,
} from "nuqs";
import * as React from "react";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { getDefaultFilterOperator } from "@/lib/data-table";
import { generateId } from "@/lib/id";
import { getFiltersStateParser, getSortingStateParser } from "@/lib/parsers";
import type {
  ExtendedColumnFilter,
  ExtendedColumnSort,
  QueryKeys,
} from "@/types/data-table";

const PAGE_KEY = "page";
const PER_PAGE_KEY = "perPage";
const SORT_KEY = "sort";
const FILTERS_KEY = "filters";
const JOIN_OPERATOR_KEY = "joinOperator";
const ARRAY_SEPARATOR = ",";
const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;

interface UseDataTableProps<TData>
  extends Omit<
      TableOptions<TData>,
      | "state"
      | "pageCount"
      | "getCoreRowModel"
      | "manualFiltering"
      | "manualPagination"
      | "manualSorting"
    >,
    Required<Pick<TableOptions<TData>, "pageCount">> {
  initialState?: Omit<Partial<TableState>, "sorting"> & {
    sorting?: ExtendedColumnSort<TData>[];
  };
  queryKeys?: Partial<QueryKeys>;
  history?: "push" | "replace";
  debounceMs?: number;
  throttleMs?: number;
  clearOnDefault?: boolean;
  enableAdvancedFilter?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  startTransition?: React.TransitionStartFunction;
}

/**
 * Advanced data table hook that manages table state with URL synchronization
 *
 * This hook provides a complete data table solution with:
 * - URL-based state management (via Nuqs) for pagination, sorting, and filters
 * - Advanced filtering with operators, variants, and multiple filter types
 * - Server-side pagination, sorting, and filtering support
 * - Automatic URL updates when state changes
 * - Filter state separation: incomplete filters (local) vs complete filters (URL)
 *
 * @example
 * ```tsx
 * const { table, advancedFilters } = useDataTable({
 *   data: members,
 *   columns: memberColumns,
 *   pageCount: 10,
 *   enableAdvancedFilter: true,
 * });
 *
 * // Use filters in your components
 * <DataTableFilterList table={table} advancedFilters={advancedFilters} />
 * ```
 *
 * @param props - Configuration options for the data table
 * @returns Object containing the TanStack Table instance and filter management API
 */
export function useDataTable<TData>(props: UseDataTableProps<TData>) {
  const {
    columns,
    pageCount = -1,
    initialState,
    queryKeys,
    history = "replace",
    debounceMs = DEBOUNCE_MS,
    throttleMs = THROTTLE_MS,
    clearOnDefault = false,
    enableAdvancedFilter = false,
    scroll = false,
    shallow = true,
    startTransition,
    ...tableProps
  } = props;
  const pageKey = queryKeys?.page ?? PAGE_KEY;
  const perPageKey = queryKeys?.perPage ?? PER_PAGE_KEY;
  const sortKey = queryKeys?.sort ?? SORT_KEY;
  const filtersKey = queryKeys?.filters ?? FILTERS_KEY;
  const joinOperatorKey = queryKeys?.joinOperator ?? JOIN_OPERATOR_KEY;

  const queryStateOptions = React.useMemo<
    Omit<UseQueryStateOptions<string>, "parse">
  >(
    () => ({
      history,
      scroll,
      shallow,
      throttleMs,
      debounceMs,
      clearOnDefault,
      startTransition,
    }),
    [
      history,
      scroll,
      shallow,
      throttleMs,
      debounceMs,
      clearOnDefault,
      startTransition,
    ],
  );

  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
    initialState?.rowSelection ?? {},
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialState?.columnVisibility ?? {});

  const [page, setPage] = useQueryState(
    pageKey,
    parseAsInteger.withOptions(queryStateOptions).withDefault(1),
  );
  const [perPage, setPerPage] = useQueryState(
    perPageKey,
    parseAsInteger
      .withOptions(queryStateOptions)
      .withDefault(initialState?.pagination?.pageSize ?? 10),
  );

  const pagination: PaginationState = React.useMemo(() => {
    return {
      pageIndex: page - 1, // zero-based index -> one-based index
      pageSize: perPage,
    };
  }, [page, perPage]);

  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      if (typeof updaterOrValue === "function") {
        const newPagination = updaterOrValue(pagination);
        void setPage(newPagination.pageIndex + 1);
        void setPerPage(newPagination.pageSize);
      } else {
        void setPage(updaterOrValue.pageIndex + 1);
        void setPerPage(updaterOrValue.pageSize);
      }
    },
    [pagination, setPage, setPerPage],
  );

  const columnIds = React.useMemo(() => {
    return columns.map((column) => column.id).filter(Boolean) as string[];
  }, [columns]);

  const columnIdsSet = React.useMemo(() => new Set(columnIds), [columnIds]);

  const [sorting, setSorting] = useQueryState(
    sortKey,
    getSortingStateParser<TData>(columnIdsSet)
      .withOptions(queryStateOptions)
      .withDefault(initialState?.sorting ?? []),
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      if (typeof updaterOrValue === "function") {
        const newSorting = updaterOrValue(sorting);
        setSorting(newSorting as ExtendedColumnSort<TData>[]);
      } else {
        setSorting(updaterOrValue as ExtendedColumnSort<TData>[]);
      }
    },
    [sorting, setSorting],
  );

  // Advanced filter support - replaces simple column filters
  // Incomplete filters (no value yet) stay in local state
  // Complete filters (has value) sync to URL
  const [incompleteFilters, setIncompleteFilters] = React.useState<
    ExtendedColumnFilter<TData>[]
  >([]);

  const [completeFilters, setCompleteFilters] = useQueryState(
    filtersKey,
    getFiltersStateParser<TData>(columnIds)
      .withOptions(queryStateOptions)
      .withDefault([]),
  );

  // Check if a filter is complete (has a value or is an empty/not-empty operator)
  const isFilterComplete = React.useCallback(
    (filter: ExtendedColumnFilter<TData>): boolean => {
      if (
        filter.operator === "isEmpty" ||
        filter.operator === "isNotEmpty"
      ) {
        return true;
      }
      return (
        (Array.isArray(filter.value) && filter.value.length > 0) ||
        (typeof filter.value === "string" && filter.value !== "") ||
        typeof filter.value === "number"
      );
    },
    [],
  );

  // All filters (incomplete + complete) for UI display
  const allFilters = React.useMemo(
    () => [...incompleteFilters, ...(completeFilters ?? [])],
    [incompleteFilters, completeFilters],
  );

  // Add a new filter (starts as incomplete)
  const addFilter = React.useCallback(
    (columnId: string) => {
      const column = columns.find((col) => col.id === columnId);
      if (!column) return;

      setIncompleteFilters((prev) => [
        ...prev,
        {
          id: columnId as Extract<keyof TData, string>,
          value: "",
          variant: column.meta?.variant ?? "text",
          operator: getDefaultFilterOperator(column.meta?.variant ?? "text"),
          filterId: generateId({ length: 8 }),
        },
      ]);
    },
    [columns],
  );

  // Update a filter (moves between incomplete/complete as needed)
  const updateFilter = React.useCallback(
    (
      filterId: string,
      updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
    ) => {
      // Try to find in incomplete filters first
      const incompleteFilter = incompleteFilters.find(
        (f) => f.filterId === filterId,
      );

      if (incompleteFilter) {
        // Filter is currently incomplete
        const updatedFilter = {
          ...incompleteFilter,
          ...updates,
        } as ExtendedColumnFilter<TData>;

        if (isFilterComplete(updatedFilter)) {
          // Filter is now complete - move to URL state
          setIncompleteFilters((prev) =>
            prev.filter((f) => f.filterId !== filterId),
          );
          void setCompleteFilters((prev) => [...(prev ?? []), updatedFilter]);
          void setPage(1); // Reset to first page when filter changes
        } else {
          // Filter is still incomplete - update in place
          setIncompleteFilters((prev) =>
            prev.map((f) => (f.filterId === filterId ? updatedFilter : f)),
          );
        }
        return;
      }

      // Filter must be in complete state
      void setCompleteFilters((prev) => {
        if (!prev) return prev;

        const completeFilter = prev.find((f) => f.filterId === filterId);
        if (!completeFilter) return prev;

        const updatedFilter = {
          ...completeFilter,
          ...updates,
        } as ExtendedColumnFilter<TData>;

        // Check if filter became incomplete (value cleared)
        if (!isFilterComplete(updatedFilter)) {
          // Move back to incomplete filters
          setIncompleteFilters((prevIncomplete) => [
            ...prevIncomplete,
            updatedFilter,
          ]);
          // Remove from complete
          void setPage(1);
          return prev.filter((f) => f.filterId !== filterId);
        }

        // Update in complete filters
        void setPage(1); // Reset to first page when filter changes
        return prev.map((filter) =>
          filter.filterId === filterId ? updatedFilter : filter,
        );
      });
    },
    [incompleteFilters, isFilterComplete, setCompleteFilters, setPage],
  );

  // Remove a filter
  const removeFilter = React.useCallback(
    (filterId: string) => {
      // Remove from incomplete
      setIncompleteFilters((prev) =>
        prev.filter((filter) => filter.filterId !== filterId),
      );

      // Also remove from complete filters if exists
      void setCompleteFilters((prev) =>
        prev?.filter((filter) => filter.filterId !== filterId),
      );
      void setPage(1); // Reset to first page when filter removed
    },
    [setCompleteFilters, setPage],
  );

  // Reset all filters
  const resetFilters = React.useCallback(() => {
    setIncompleteFilters([]);
    void setCompleteFilters(null);
    void setPage(1);
  }, [setCompleteFilters, setPage]);

  // For backward compatibility with TanStack Table's columnFilters
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  const onColumnFiltersChange = React.useCallback(
    (_updaterOrValue: Updater<ColumnFiltersState>) => {
      // No-op - we're using advanced filters now
      // This is here for TanStack Table compatibility
    },
    [],
  );

  const table = useReactTable({
    ...tableProps,
    columns,
    initialState,
    pageCount,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    defaultColumn: {
      ...tableProps.defaultColumn,
      enableColumnFilter: false,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    meta: {
      queryKeys: {
        page: pageKey,
        perPage: perPageKey,
        sort: sortKey,
        filters: filtersKey,
        joinOperator: joinOperatorKey,
      },
    },
  });

  return {
    table,
    shallow,
    debounceMs,
    throttleMs,
    advancedFilters: {
      allFilters,
      completeFilters: completeFilters ?? [],
      incompleteFilters,
      addFilter,
      updateFilter,
      removeFilter,
      resetFilters,
    },
  };
}

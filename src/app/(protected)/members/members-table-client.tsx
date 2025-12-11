"use client";

import * as React from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableFilterList } from "@/components/data-table/data-table-filter-list";
import { useDataTable } from "@/hooks/use-data-table";
import { getMembersTableColumns } from "./members-table-columns";
import { useMembersQuery } from "./members-queries";
import { MembersTableActionBar } from "./members-table-action-bar";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import type { GetMembersResult } from "@/actions/members";

interface MembersTableClientProps {
  initialData: GetMembersResult;
}

export function MembersTableClient({ initialData }: MembersTableClientProps) {
  const columns = React.useMemo(() => getMembersTableColumns(), []);

  // Calculate pageCount from total (default 10 items per page)
  const pageCount = Math.ceil(initialData.total / 10) || 1;

  const { table, advancedFilters } = useDataTable({
    data: initialData.data,
    columns,
    pageCount,
    enableAdvancedFilter: true,
    initialState: {
      columnPinning: { left: ["select"], right: [] },
    },
  });

  // Build query params from table state for server query
  const tableState = table.getState();
  const queryParams = React.useMemo(() => {
    return {
      page: (tableState.pagination.pageIndex + 1).toString(),
      perPage: tableState.pagination.pageSize.toString(),
      sort: tableState.sorting.length > 0 ? JSON.stringify(tableState.sorting) : "",
      filters:
        advancedFilters.completeFilters.length > 0
          ? JSON.stringify(advancedFilters.completeFilters)
          : "",
      joinOperator: "and" as const,
    };
  }, [
    tableState.pagination.pageIndex,
    tableState.pagination.pageSize,
    tableState.sorting,
    advancedFilters.completeFilters,
  ]);

  const { data, isLoading, isFetching } = useMembersQuery(queryParams, {
    initialData:
      queryParams.filters === "" && queryParams.sort === ""
        ? initialData
        : undefined,
    refetchOnMount: false,
    placeholderData: keepPreviousData,
  });

  // Update table data when query returns new data
  React.useEffect(() => {
    if (data) {
      table.options.data = data.data;
      table.options.pageCount = Math.ceil(data.total / 10) || 1;
    }
  }, [data, table]);

  if (isLoading) {
    return <DataTableSkeleton columnCount={5} rowCount={10} />;
  }

  return (
    <DataTable table={table} isLoading={isFetching && !isLoading}>
      <DataTableFilterList table={table} advancedFilters={advancedFilters} />
      <MembersTableActionBar table={table} />
    </DataTable>
  );
}


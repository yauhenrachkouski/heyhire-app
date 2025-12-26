"use client";

import * as React from "react";
import posthog from "posthog-js";
import { keepPreviousData } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableFilterList } from "@/components/data-table/data-table-filter-list";
import { useDataTable } from "@/hooks/use-data-table";
import { getMembersTableColumns } from "./members-table-columns";
import { useMembersQuery } from "./members-queries";
import { MembersTableActionBar } from "./members-table-action-bar";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import type { GetMembersResult } from "@/actions/members";
import { useActiveOrganization } from "@/lib/auth-client";

interface MembersTableClientProps {
  initialData: GetMembersResult;
}

export function MembersTableClient({ initialData }: MembersTableClientProps) {
  const { data: activeOrg } = useActiveOrganization();
  const columns = React.useMemo(() => getMembersTableColumns(), []);

  // Start with a default query state that will be updated by table interactions
  const [queryParams, setQueryParams] = React.useState({
    page: "1",
    perPage: "10",
    sort: "",
    filters: "",
    joinOperator: "and" as const,
  });

  // Fetch data with TanStack Query using proper initialData pattern
  const { data, isLoading, isFetching } = useMembersQuery(queryParams, {
    // Only use initialData when query params match the initial server-rendered state
    initialData:
      queryParams.page === "1" &&
      queryParams.perPage === "10" &&
      queryParams.filters === "" &&
      queryParams.sort === ""
        ? initialData
        : undefined,
    refetchOnMount: false,
    // Keep previous data visible during refetch to prevent UI flicker
    placeholderData: keepPreviousData,
  });

  // Use query data (or fallback to initialData) for table
  const tableData = data?.data || initialData.data;
  const pageCount = Math.ceil((data?.total || initialData.total) / 10) || 1;

  // Create table with reactive data from query
  const { table, advancedFilters } = useDataTable({
    data: tableData,
    columns,
    pageCount,
    enableAdvancedFilter: true,
    initialState: {
      columnPinning: { left: ["select"], right: [] },
    },
  });

  // Build query params from table state for server query
  const tableState = table.getState();
  const newQueryParams = React.useMemo(() => {
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

  const prevQueryParamsRef = React.useRef(newQueryParams);

  // Update query params when table state changes
  React.useEffect(() => {
    const prevParams = prevQueryParamsRef.current;
    const currentParams = newQueryParams;

    if (
      prevParams.page === currentParams.page &&
      prevParams.perPage === currentParams.perPage &&
      prevParams.sort === currentParams.sort &&
      prevParams.filters === currentParams.filters &&
      prevParams.joinOperator === currentParams.joinOperator
    ) {
      return;
    }

    if (prevParams.filters !== currentParams.filters) {
      posthog.capture("members_table_filtered", {
        organization_id: activeOrg?.id,
        from_filters: prevParams.filters,
        to_filters: currentParams.filters,
        from_filter_count: prevParams.filters ? JSON.parse(prevParams.filters).length : 0,
        filters: advancedFilters.completeFilters,
        filter_count: advancedFilters.completeFilters.length,
      });
    }

    if (prevParams.sort !== currentParams.sort) {
      posthog.capture("members_table_sorted", {
        organization_id: activeOrg?.id,
        from_sort: prevParams.sort,
        to_sort: currentParams.sort,
        sort: tableState.sorting,
      });
    }

    prevQueryParamsRef.current = currentParams;
    setQueryParams(currentParams);
  }, [newQueryParams, advancedFilters.completeFilters, tableState.sorting, activeOrg?.id]);

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

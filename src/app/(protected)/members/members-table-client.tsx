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

  const prevQueryParamsRef = React.useRef(queryParams);

  React.useEffect(() => {
    const prevParams = prevQueryParamsRef.current;
    const currentParams = queryParams;

    if (prevParams === currentParams) {
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
  }, [queryParams, advancedFilters.completeFilters, tableState.sorting, activeOrg?.id]);

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

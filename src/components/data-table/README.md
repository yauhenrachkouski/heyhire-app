# Data Table System

A comprehensive, reusable data table system built with TanStack Table, TanStack Query, and Nuqs for URL state management.

## Architecture Overview

### Data Flow

```
URL (Nuqs) → use-data-table Hook → TanStack Query → Server Action → Database
     ↑                                    ↓
     └────────────── Updates ─────────────┘
```

### Key Principles

1. **URL as Single Source of Truth** - All table state (page, sort, filters) lives in the URL
2. **Server-Side Operations** - Pagination, sorting, and filtering happen on the server
3. **Optimistic Updates** - TanStack Query handles optimistic UI updates for mutations
4. **Type Safety** - Full TypeScript support throughout

## Quick Start

### 1. Define Your Columns

```tsx
// members-table-columns.tsx
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";

export function getMembersTableColumns(): ColumnDef<Member>[] {
  return [
    {
      accessorKey: "userName",
      id: "userName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "Name",
        placeholder: "Search by name...",
        variant: "text", // text | number | date | select | multiSelect | boolean
      },
    },
    {
      accessorKey: "role",
      id: "role",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
      enableColumnFilter: true,
      meta: {
        label: "Role",
        variant: "multiSelect",
        options: [
          { label: "Owner", value: "owner" },
          { label: "Admin", value: "admin" },
          { label: "Member", value: "member" },
        ],
      },
    },
  ];
}
```

### 2. Create Server Action

```tsx
// actions/members.ts
export async function getMembers(params: {
  page: string;
  perPage: string;
  sort: string;
  filters: string;
  joinOperator: "and" | "or";
}) {
  const { page, perPage, sort, filters } = params;
  
  // Parse filters
  const parsedFilters = filters ? JSON.parse(filters) : [];
  
  // Build query with filters, sorting, pagination
  const data = await db
    .select()
    .from(member)
    .where(/* apply filters */)
    .orderBy(/* apply sorting */)
    .limit(Number(perPage))
    .offset((Number(page) - 1) * Number(perPage));

  return {
    data,
    pageCount: Math.ceil(totalCount / Number(perPage)),
  };
}
```

### 3. Create Client Component

```tsx
// members-table-client.tsx
"use client";

import { useDataTable } from "@/hooks/use-data-table";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableFilterList } from "@/components/data-table/data-table-filter-list";

export function MembersTableClient({ initialData }) {
  const columns = React.useMemo(() => getMembersTableColumns(), []);

  const { table, advancedFilters } = useDataTable({
    data: initialData.data,
    columns,
    pageCount: initialData.pageCount,
    enableAdvancedFilter: true,
  });

  // Build query params from table state
  const queryParams = React.useMemo(() => ({
    page: (table.getState().pagination.pageIndex + 1).toString(),
    perPage: table.getState().pagination.pageSize.toString(),
    sort: JSON.stringify(table.getState().sorting),
    filters: JSON.stringify(advancedFilters.completeFilters),
    joinOperator: "and",
  }), [/* dependencies */]);

  // Fetch data with TanStack Query
  const { data } = useMembersQuery(queryParams, {
    initialData,
    placeholderData: keepPreviousData,
  });

  return (
    <DataTable table={table}>
      <DataTableFilterList table={table} advancedFilters={advancedFilters} />
      {/* Your action bar */}
    </DataTable>
  );
}
```

### 4. Create Server Page

```tsx
// page.tsx
export default async function MembersPage({ searchParams }) {
  const queryClient = new QueryClient();
  
  // Prefetch data on the server
  const data = await getMembers(searchParams);
  
  await queryClient.prefetchQuery({
    queryKey: membersKeys.list(searchParams),
    queryFn: () => data,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MembersTableClient initialData={data} />
    </HydrationBoundary>
  );
}
```

## Advanced Features

### Filter Variants

The system supports multiple filter types:

- **text** - Text search with contains/equals operators
- **number** - Numeric comparisons (eq, ne, lt, lte, gt, gte, isBetween)
- **date** - Date filtering with range support
- **select** - Single selection from options
- **multiSelect** - Multiple selection from options
- **boolean** - True/false selection

### Filter Operators

Each variant supports different operators:

```tsx
// Text operators
"iLike" | "notILike" | "eq" | "ne" | "isEmpty" | "isNotEmpty"

// Number operators
"eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "isBetween"

// Date operators
"eq" | "ne" | "lt" | "gt" | "lte" | "gte" | "isBetween"

// Select operators
"eq" | "ne" | "inArray" | "notInArray"
```

### Filtering Joined Columns

To filter on joined columns (e.g., user.name when querying members):

1. **Enable the filter** in column definition:
```tsx
{
  id: "userName",
  enableColumnFilter: true,
  meta: { label: "Name", variant: "text" },
}
```

2. **Handle in server action**:
```tsx
if (filter.id === "userName") {
  filterConditions.push(ilike(user.name, `%${filter.value}%`));
}
```

### Optimistic Updates

```tsx
export function useUpdateMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMember,
    onMutate: async (variables) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: membersKeys.lists() });

      // Snapshot previous data
      const previousData = queryClient.getQueriesData({
        queryKey: membersKeys.lists(),
      });

      // Optimistically update cache
      queryClient.setQueriesData({ queryKey: membersKeys.lists() }, (old) => {
        // Update the data optimistically
        return { ...old, data: updatedData };
      });

      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSuccess: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: membersKeys.lists() });
    },
  });
}
```

## Components

### Core Components

- `<DataTable>` - Main table wrapper component
- `<DataTableFilterList>` - Filter management UI
- `<DataTablePagination>` - Pagination controls
- `<DataTableColumnHeader>` - Sortable column headers

### Filter Input Components

Located in `components/data-table/filter-inputs/`:

- `TextFilterInput` - Text and number inputs
- `DateFilterInput` - Date picker
- `SelectFilterInput` - Single/multi select
- `BooleanFilterInput` - True/false toggle

## Hooks

### `useDataTable`

Main hook that manages table state with URL synchronization.

**Returns:**
- `table` - TanStack Table instance
- `advancedFilters` - Filter management API
  - `allFilters` - All filters (incomplete + complete)
  - `completeFilters` - Filters synced to URL
  - `incompleteFilters` - Filters being built (local state)
  - `addFilter(columnId)` - Add new filter
  - `updateFilter(filterId, updates)` - Update filter
  - `removeFilter(filterId)` - Remove filter
  - `resetFilters()` - Clear all filters

## State Management

### Filter State Flow

1. **User clicks "Add filter"** → `addFilter()` creates incomplete filter (local state)
2. **User selects operator** → Filter updates but stays incomplete
3. **User enters value** → `isFilterComplete()` returns true
4. **Filter moves to URL** → Nuqs syncs to URL params
5. **URL change triggers** → TanStack Query refetches data
6. **Server receives filters** → Applies to database query

### URL Parameters

- `page` - Current page number (1-based)
- `perPage` - Items per page
- `sort` - Sorting state (JSON)
- `filters` - Complete filters (JSON)
- `joinOperator` - AND/OR for multiple filters

## Best Practices

1. **Always use `enableAdvancedFilter: true`** when using advanced filters
2. **Memoize columns** to prevent unnecessary re-renders
3. **Use `keepPreviousData`** in queries for smooth transitions
4. **Handle both member and joined columns** in server filtering
5. **Add proper TypeScript types** to all columns and filters
6. **Use optimistic updates** for better UX
7. **Validate filter inputs** on both client and server

## Troubleshooting

### Filters not persisting in URL
- Ensure `enableAdvancedFilter: true` in `useDataTable`
- Check that filter has a value before it's considered complete

### Server not receiving filters
- Verify `completeFilters` is included in query params
- Check `JSON.stringify` is applied correctly
- Ensure server action parses JSON filters

### Type errors with filters
- Use proper generic types: `ExtendedColumnFilter<TData>`
- Cast joined column filters appropriately
- Ensure column IDs match between client and server

## Tech Stack

- **@tanstack/react-table** - Table state management
- **@tanstack/react-query** - Server state and caching
- **nuqs** - URL state management
- **drizzle-orm** - Database queries
- **date-fns** - Date manipulation
- **cmdk** - Command menu for filters


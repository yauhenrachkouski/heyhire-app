"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import type { Member } from "@/actions/members";
import { formatDate } from "@/lib/format";

const roleOptions = [
  { label: "Owner", value: "owner" },
  { label: "Admin", value: "admin" },
  { label: "Member", value: "member" },
];

export function getMembersTableColumns(): ColumnDef<Member>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-0.5"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-0.5"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "userName",
      id: "userName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        const isPending = row.original.status === "pending";
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${isPending ? "text-muted-foreground" : ""}`}>
                {row.original.userName}
              </span>
              {isPending && (
                <Badge variant="outline" className="text-xs">
                  Pending
                </Badge>
              )}
            </div>
            <span className="text-muted-foreground text-xs">
              {row.original.userEmail}
            </span>
          </div>
        );
      },
      enableColumnFilter: true,
      meta: {
        label: "Name",
        placeholder: "Search by name...",
        variant: "text",
      },
    },
    {
      accessorKey: "organizationName",
      id: "organizationName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Organization" />
      ),
      cell: ({ row }) => {
        return <span>{row.original.organizationName}</span>;
      },
      enableColumnFilter: true,
      meta: {
        label: "Organization",
        placeholder: "Search organization...",
        variant: "text",
      },
    },
    {
      accessorKey: "role",
      id: "role",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Role" />
      ),
      cell: ({ row }) => {
        const role = roleOptions.find((r) => r.value === row.original.role);
        return (
          <div className="flex items-center">
            <span className="capitalize">{role?.label ?? row.original.role}</span>
          </div>
        );
      },
      enableColumnFilter: true,
      meta: {
        label: "Role",
        variant: "multiSelect",
        options: roleOptions,
      },
    },
    {
      accessorKey: "status",
      id: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        const isPending = status === "pending";
        
        return (
          <div className="flex items-center gap-2">
            <Badge 
              variant={isPending ? "secondary" : "default"}
              className={isPending ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"}
            >
              {status === "pending" ? "Invited" : "Active"}
            </Badge>
            {isPending && row.original.expiresAt && (
              <span className="text-xs text-muted-foreground">
                Expires {formatDate(row.original.expiresAt)}
              </span>
            )}
          </div>
        );
      },
      enableColumnFilter: true,
      meta: {
        label: "Status",
        variant: "multiSelect",
        options: [
          { label: "Active", value: "active" },
          { label: "Invited", value: "pending" },
        ],
      },
    },
    {
      accessorKey: "createdAt",
      id: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Joined" />
      ),
      cell: ({ row }) => {
        const isPending = row.original.status === "pending";
        return (
          <span className="text-muted-foreground">
            {isPending ? "Not joined yet" : formatDate(row.original.createdAt)}
          </span>
        );
      },
      enableColumnFilter: true,
      meta: {
        label: "Joined Date",
        variant: "date",
      },
    },
  ];
}


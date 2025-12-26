"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "@/components/data-table/data-table-action-bar";
import { IconDownload, IconTrash, IconUserCog } from "@tabler/icons-react";
import type { Member } from "@/actions/members";
import { exportTableToCSV } from "@/lib/export";
import { DeleteMembersDialog } from "./delete-members-dialog";
import { UpdateMembersDialog } from "./update-members-dialog";

interface MembersTableActionBarProps {
  table: Table<Member>;
}

export function MembersTableActionBar({ table }: MembersTableActionBarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = React.useState(false);

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedIds = selectedRows.map((row) => row.original.id);

  const handleExport = React.useCallback(() => {
    exportTableToCSV(table, {
      filename: "members",
      excludeColumns: ["select"],
      onlySelected: true,
    });
  }, [table]);

  const handleDeleteSuccess = React.useCallback(() => {
    table.toggleAllRowsSelected(false);
  }, [table]);

  const handleUpdateSuccess = React.useCallback(() => {
    table.toggleAllRowsSelected(false);
  }, [table]);

  return (
    <>
      <DataTableActionBar table={table}>
        <DataTableActionBarSelection table={table} />

        <DataTableActionBarAction
          tooltip="Update role"
          onClick={() => setShowUpdateDialog(true)}
        >
          <IconUserCog />
          Update Role
        </DataTableActionBarAction>

        <DataTableActionBarAction
          tooltip="Export selected"
          onClick={handleExport}
        >
          <IconDownload />
          Export
        </DataTableActionBarAction>

        <DataTableActionBarAction
          tooltip="Delete selected"
          onClick={() => setShowDeleteDialog(true)}
        >
          <IconTrash />
          Delete
        </DataTableActionBarAction>
      </DataTableActionBar>

      <DeleteMembersDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        memberIds={selectedIds}
        onSuccess={handleDeleteSuccess}
      />

      <UpdateMembersDialog
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        memberIds={selectedIds}
        memberCount={selectedRows.length}
        onSuccess={handleUpdateSuccess}
      />
    </>
  );
}


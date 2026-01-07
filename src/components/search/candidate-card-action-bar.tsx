"use client";

import * as React from "react";
import {
  DataTableActionBar,
  DataTableActionBarAction,
} from "@/components/data-table/data-table-action-bar";
import { toast } from "sonner";
import type { Table } from "@tanstack/react-table";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/icon";
import posthog from "posthog-js";

interface SelectedCandidate {
  id: string;
  fullName: string | null;
  headline: string | null;
  location: string | null;
  linkedinUrl?: string;
}

interface CandidateCardActionBarProps {
  selectedIds: string[];
  selectedCandidates: SelectedCandidate[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  onEmail?: (ids: string[]) => Promise<void>;
  searchId?: string;
  organizationId?: string;
}

export function CandidateCardActionBar({
  selectedIds,
  selectedCandidates,
  onClearSelection,
  onSelectAll,
  isAllSelected = false,
  searchId,
  organizationId,
}: CandidateCardActionBarProps) {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClearSelection();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClearSelection]);

  const handleExport = React.useCallback(() => {
    const headers = ["Name", "Headline", "Location", "LinkedIn URL"];
    const rows = selectedCandidates.map((candidate) => [
      candidate.fullName || "Unknown",
      candidate.headline || "-",
      candidate.location || "-",
      candidate.linkedinUrl || "-",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `candidates_${new Date().getTime()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    posthog.capture("candidates_exported", {
      search_id: searchId,
      organization_id: organizationId,
      candidate_count: selectedIds.length,
      export_format: "csv",
    });

    toast("Success", {
      description: `Exported ${selectedIds.length} candidates`,
    });
  }, [selectedIds, selectedCandidates]);

  const handleSelectAllClick = React.useCallback(() => {
    posthog.capture("candidates_select_all", {
      search_id: searchId,
      organization_id: organizationId,
      previously_selected_count: selectedIds.length,
    });
    onSelectAll?.();
  }, [onSelectAll, selectedIds.length, searchId, organizationId]);

  const handleClearSelectionClick = React.useCallback(() => {
    posthog.capture("candidates_deselect_all", {
      search_id: searchId,
      organization_id: organizationId,
      deselected_count: selectedIds.length,
    });
    onClearSelection();
  }, [onClearSelection, selectedIds.length, searchId, organizationId]);

  const mockTable = {
    getFilteredSelectedRowModel: () => ({
      rows: selectedIds.map((id, index) => ({
        original: { id },
        index,
      })),
    }),
    toggleAllRowsSelected: onClearSelection,
  } as unknown as Table<unknown>;

  const CustomSelection = () => (
    <div className="flex h-7 items-center rounded-md pr-1 pl-2.5">
      <span className="whitespace-nowrap text-xs">
        {selectedIds.length} selected
      </span>
    </div>
  );

  return (
    <DataTableActionBar table={mockTable} visible={selectedIds.length > 0}>
      <CustomSelection />

      <DataTableActionBarAction
        tooltip={isAllSelected ? "All selected" : "Select all"}
        onClick={handleSelectAllClick}
        size="icon"
        disabled={isAllSelected || !onSelectAll}
      >
        <Icon name="check" size={14} />
      </DataTableActionBarAction>

      <DataTableActionBarAction
        tooltip="Clear selection (Esc)"
        onClick={handleClearSelectionClick}
        size="icon"
      >
        <Icon name="x" size={14} />
      </DataTableActionBarAction>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <DataTableActionBarAction
        tooltip="Export selected"
        onClick={handleExport}
        size="icon"
      >
        <Icon name="download" size={14} />
      </DataTableActionBarAction>

    </DataTableActionBar>
  );
}

"use client";

import * as React from "react";
import {
  DataTableActionBar,
  DataTableActionBarAction,
} from "@/components/data-table/data-table-action-bar";
import { IconDownload } from "@tabler/icons-react";
import { toast } from "sonner";
import type { Table } from "@tanstack/react-table";

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
  onEmail?: (ids: string[]) => Promise<void>;
}

export function CandidateCardActionBar({
  selectedIds,
  selectedCandidates,
  onClearSelection,
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

    toast("Success", {
      description: `Exported ${selectedIds.length} candidates`,
    });
  }, [selectedIds, selectedCandidates]);

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
        tooltip="Export selected"
        onClick={handleExport}
        size="icon"
      >
        <IconDownload />
      </DataTableActionBarAction>

      <DataTableActionBarAction
        tooltip="Clear selection (Esc)"
        onClick={onClearSelection}
      >
        ✕
      </DataTableActionBarAction>
    </DataTableActionBar>
  );
}

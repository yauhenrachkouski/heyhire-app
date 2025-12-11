"use client";

import * as React from "react";
import {
  DataTableActionBar,
  DataTableActionBarAction,
} from "@/components/data-table/data-table-action-bar";
import { Download, Plus, ThumbsDown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
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
  onAddToSequence?: (ids: string[]) => Promise<void>;
  onDecline?: (ids: string[]) => Promise<void>;
  onEmail?: (ids: string[]) => Promise<void>;
}

export function CandidateCardActionBar({
  selectedIds,
  selectedCandidates,
  onClearSelection,
  onAddToSequence,
  onDecline,
}: CandidateCardActionBarProps) {
  const [isAddingToSequence, setIsAddingToSequence] = React.useState(false);
  const [isDeclining, setIsDeclining] = React.useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = React.useState(false);
  const { toast } = useToast();

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

    toast({
      title: "Success",
      description: `Exported ${selectedIds.length} candidates`,
    });
  }, [selectedIds, selectedCandidates, toast]);

  const handleAddToSequenceClick = React.useCallback(async () => {
    if (!onAddToSequence) {
      toast({
        title: "Info",
        description: "Add to sequence functionality not yet implemented",
      });
      return;
    }

    setIsAddingToSequence(true);
    try {
      await onAddToSequence(selectedIds);
      onClearSelection();
      toast({
        title: "Success",
        description: `Added ${selectedIds.length} candidates to sequence`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add candidates to sequence",
        variant: "destructive",
      });
    } finally {
      setIsAddingToSequence(false);
    }
  }, [selectedIds, onAddToSequence, onClearSelection, toast]);

  const handleDeclineClick = React.useCallback(() => {
    setShowDeclineDialog(true);
  }, []);

  const handleDeclineConfirm = React.useCallback(async () => {
    if (!onDecline) {
      toast({
        title: "Info",
        description: "Decline functionality not yet implemented",
      });
      setShowDeclineDialog(false);
      return;
    }

    setIsDeclining(true);
    try {
      await onDecline(selectedIds);
      onClearSelection();
      toast({
        title: "Success",
        description: `Declined ${selectedIds.length} candidates`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to decline candidates",
        variant: "destructive",
      });
    } finally {
      setIsDeclining(false);
      setShowDeclineDialog(false);
    }
  }, [selectedIds, onDecline, onClearSelection, toast]);

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
    <>
      <DataTableActionBar table={mockTable} visible={selectedIds.length > 0}>
        <CustomSelection />

        <DataTableActionBarAction
          tooltip="Export selected"
          onClick={handleExport}
          size="icon"
        >
          <Download />
        </DataTableActionBarAction>

        <DataTableActionBarAction
          tooltip="Add to outreach"
          onClick={handleAddToSequenceClick}
          isPending={isAddingToSequence}
        >
          <Plus />
          Add to Outreach
        </DataTableActionBarAction>

        <DataTableActionBarAction
          tooltip="Reject selected"
          onClick={handleDeclineClick}
          variant="destructive"
        >
          <ThumbsDown />
          Reject
        </DataTableActionBarAction>

        <DataTableActionBarAction
          tooltip="Clear selection (Esc)"
          onClick={onClearSelection}
        >
          ✕
        </DataTableActionBarAction>
      </DataTableActionBar>

      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Candidates</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to decline {selectedIds.length} selected
              candidate{selectedIds.length !== 1 ? "s" : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeclineConfirm}
              disabled={isDeclining}
            >
              {isDeclining ? "Declining..." : "Decline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

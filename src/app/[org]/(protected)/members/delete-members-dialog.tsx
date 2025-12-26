"use client";

import * as React from "react";
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
import { useDeleteMembersMutation } from "./members-queries";
import { IconLoader2 } from "@tabler/icons-react";

interface DeleteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberIds: string[];
  onSuccess?: () => void;
}

export function DeleteMembersDialog({
  open,
  onOpenChange,
  memberIds,
  onSuccess,
}: DeleteMembersDialogProps) {
  const deleteMutation = useDeleteMembersMutation();

  const handleDelete = React.useCallback(() => {
    deleteMutation.mutate(
      { ids: memberIds },
      {
        onSuccess: (result) => {
          if (!result.error) {
            onOpenChange(false);
            onSuccess?.();
          }
        },
      },
    );
  }, [deleteMutation, memberIds, onOpenChange, onSuccess]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete{" "}
            <span className="font-semibold">
              {memberIds.length} {memberIds.length === 1 ? "member" : "members"}
            </span>{" "}
            from the organization.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending && (
              <IconLoader2 className="mr-2 size-4 animate-spin" />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useUpdateMembersMutation } from "./members-queries";
import { Loader } from "lucide-react";

const updateMembersSchema = z.object({
  role: z.string().min(1, "Role is required"),
});

type UpdateMembersFormValues = z.infer<typeof updateMembersSchema>;

interface UpdateMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberIds: string[];
  memberCount: number;
  onSuccess?: () => void;
}

const roleOptions = [
  { label: "Owner", value: "owner" },
  { label: "Admin", value: "admin" },
  { label: "Member", value: "member" },
];

export function UpdateMembersDialog({
  open,
  onOpenChange,
  memberIds,
  memberCount,
  onSuccess,
}: UpdateMembersDialogProps) {
  const updateMutation = useUpdateMembersMutation();

  const form = useForm<UpdateMembersFormValues>({
    resolver: zodResolver(updateMembersSchema),
    defaultValues: {
      role: "",
    },
  });

  const onSubmit = React.useCallback(
    (values: UpdateMembersFormValues) => {
      updateMutation.mutate(
        {
          ids: memberIds,
          role: values.role,
        },
        {
          onSuccess: (result) => {
            if (!result.error) {
              onOpenChange(false);
              onSuccess?.();
              form.reset();
            }
          },
        },
      );
    },
    [updateMutation, memberIds, onOpenChange, onSuccess, form],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Members</DialogTitle>
          <DialogDescription>
            Update the role for{" "}
            <span className="font-semibold">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader className="mr-2 size-4 animate-spin" />
                )}
                Update Members
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useUpdateMemberMutation } from "./members-queries";
import type { Member } from "@/actions/members";
import { IconLoader2 } from "@tabler/icons-react";

const updateMemberSchema = z.object({
  role: z.string().min(1, "Role is required"),
});

type UpdateMemberFormValues = z.infer<typeof updateMemberSchema>;

interface UpdateMemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member | null;
  onSuccess?: () => void;
}

const roleOptions = [
  { label: "Owner", value: "owner" },
  { label: "Admin", value: "admin" },
  { label: "Member", value: "member" },
];

export function UpdateMemberSheet({
  open,
  onOpenChange,
  member,
  onSuccess,
}: UpdateMemberSheetProps) {
  const updateMutation = useUpdateMemberMutation();

  const form = useForm<UpdateMemberFormValues>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      role: member?.role ?? "",
    },
  });

  React.useEffect(() => {
    if (member) {
      form.reset({
        role: member.role,
      });
    }
  }, [member, form]);

  const onSubmit = React.useCallback(
    (values: UpdateMemberFormValues) => {
      if (!member) return;

      updateMutation.mutate(
        {
          id: member.id,
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
    [updateMutation, member, onOpenChange, onSuccess, form],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Update Member</SheetTitle>
          <SheetDescription>
            Update the role for {member?.user.name}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-6 space-y-4"
          >
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
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

            <div className="flex justify-end gap-3 pt-4">
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
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                )}
                Update Member
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}


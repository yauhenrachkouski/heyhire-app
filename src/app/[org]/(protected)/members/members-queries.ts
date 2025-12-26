"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  deleteMembers,
  getMembers,
  updateMember,
  updateMembers,
  type GetMembersResult,
} from "@/actions/members";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/handle-error";
import { membersKeys } from "./members-query-keys";

// Query hook
export function useMembersQuery(
  params: Record<string, string | string[] | undefined>,
  options?: Omit<UseQueryOptions<GetMembersResult>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: membersKeys.list(params),
    queryFn: () => getMembers(params),
    ...options,
  });
}

// Update mutation
export function useUpdateMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMember,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: membersKeys.lists() });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({
        queryKey: membersKeys.lists(),
      });

      // Optimistically update
      queryClient.setQueriesData<GetMembersResult>(
        { queryKey: membersKeys.lists() },
        (old) => {
          if (!old) return old;

          return {
            ...old,
            data: old.data.map((member) =>
              member.id === variables.id
                ? { ...member, role: variables.role }
                : member,
            ),
          };
        },
      );

      return { previousData };
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      void queryClient.invalidateQueries({ queryKey: membersKeys.lists() });
      toast.success("Member updated successfully");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      toast.error(getErrorMessage(error));
    },
  });
}

// Update multiple members mutation
export function useUpdateMembersMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMembers,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: membersKeys.lists() });

      const previousData = queryClient.getQueriesData({
        queryKey: membersKeys.lists(),
      });

      queryClient.setQueriesData<GetMembersResult>(
        { queryKey: membersKeys.lists() },
        (old) => {
          if (!old) return old;

          return {
            ...old,
            data: old.data.map((member) =>
              variables.ids.includes(member.id)
                ? { ...member, role: variables.role }
                : member,
            ),
          };
        },
      );

      return { previousData };
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      void queryClient.invalidateQueries({ queryKey: membersKeys.lists() });
      toast.success("Members updated successfully");
    },
    onError: (error, _variables, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      toast.error(getErrorMessage(error));
    },
  });
}

// Delete mutation
export function useDeleteMembersMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMembers,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: membersKeys.lists() });

      const previousData = queryClient.getQueriesData({
        queryKey: membersKeys.lists(),
      });

      // Optimistically remove deleted members
      queryClient.setQueriesData<GetMembersResult>(
        { queryKey: membersKeys.lists() },
        (old) => {
          if (!old) return old;

          return {
            ...old,
            data: old.data.filter((member) => !variables.ids.includes(member.id)),
          };
        },
      );

      return { previousData };
    },
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      void queryClient.invalidateQueries({ queryKey: membersKeys.lists() });
      toast.success("Members deleted successfully");
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      toast.error(getErrorMessage(error));
    },
  });
}


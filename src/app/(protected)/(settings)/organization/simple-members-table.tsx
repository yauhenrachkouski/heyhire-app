"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import type { Member } from "@/actions/members"
import { InviteMemberDialog } from "../../members/invite-member-dialog"
import { cancelInvitation } from "@/actions/invitations"
import { removeMember } from "@/actions/members"
import { toast } from "@/components/ui/sonner"
import { useRouter } from "next/navigation"

interface SimpleMembersTableProps {
  members: Member[]
  organizationId: string
  currentUserId: string
}

export function SimpleMembersTable({ members, organizationId, currentUserId }: SimpleMembersTableProps) {
  const router = useRouter()
  const [showInviteDialog, setShowInviteDialog] = React.useState(false)
  const [actioningId, setActioningId] = React.useState<string | null>(null)
  
  const handleCancelInvitation = async (invitationId: string) => {
    setActioningId(invitationId)
    try {
      const result = await cancelInvitation(invitationId)
      
      if (result.success) {
        toast.success("Invitation Canceled", {
          description: result.message,
        })
        router.refresh()
      } else {
        toast.error("Failed to Cancel", {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      })
    } finally {
      setActioningId(null)
    }
  }

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from the organization?`)) {
      return
    }

    setActioningId(memberId)
    try {
      const result = await removeMember(memberId)
      
      if (result.success) {
        toast.success("Member Removed", {
          description: result.message,
        })
        router.refresh()
      } else {
        toast.error("Failed to Remove", {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      })
    } finally {
      setActioningId(null)
    }
  }
  
  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'default'
      case 'owner':
        return 'default'
      case 'member':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Members ({members.length})</CardTitle>
              <CardDescription>
                Manage your organization members and invitations
              </CardDescription>
            </div>
            <Button onClick={() => setShowInviteDialog(true)} size="sm" className="w-full sm:w-auto">
              <Icon name="user-plus" className="h-4 w-4" />
              Invite Member
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No members found
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="w-[80px] sm:w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isPending = member.status === "pending"
                  const memberName = member.user?.name || "Unknown"
                  const memberEmail = member.user?.email || member.email || ""
                  const isCurrentUser = member.userId === currentUserId
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
                            <AvatarFallback className="text-xs">
                              {getInitials(memberName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <span className={`font-medium block truncate ${isPending ? "text-muted-foreground" : ""}`}>
                              {memberName}
                            </span>
                            <span className="text-xs text-muted-foreground sm:hidden truncate block">
                              {memberEmail}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">
                        {memberEmail}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={isPending ? "secondary" : "default"}
                          className={isPending ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}
                        >
                          {isPending ? "Invited" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {isPending ? "Not joined" : formatDate(member.createdAt)}
                      </TableCell>
                      <TableCell>
                        {isPending && member.invitationId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvitation(member.invitationId!)}
                            disabled={actioningId === member.invitationId}
                          >
                            {actioningId === member.invitationId ? (
                              <Icon name="loader" className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icon name="x" className="h-4 w-4" />
                            )}
                            <span className="ml-1 hidden sm:inline">Cancel</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, memberEmail)}
                            disabled={actioningId === member.id || isCurrentUser}
                            title={isCurrentUser ? "You cannot remove yourself" : "Remove member"}
                          >
                            {actioningId === member.id ? (
                              <Icon name="loader" className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icon name="trash" className="h-4 w-4" />
                            )}
                            <span className="ml-1 hidden sm:inline">Remove</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>

    <InviteMemberDialog
      open={showInviteDialog}
      onOpenChange={setShowInviteDialog}
      organizationId={organizationId}
    />
    </>
  )
}


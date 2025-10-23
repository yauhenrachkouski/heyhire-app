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
import { InviteMemberDialog } from "../members/invite-member-dialog"
import { revokeInvitation } from "@/actions/invitations"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface SimpleMembersTableProps {
  members: Member[]
  organizationId: string
}

export function SimpleMembersTable({ members, organizationId }: SimpleMembersTableProps) {
  const router = useRouter()
  const [showInviteDialog, setShowInviteDialog] = React.useState(false)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)
  
  const handleRevokeInvitation = async (invitationId: string) => {
    setRevokingId(invitationId)
    try {
      const result = await revokeInvitation(invitationId)
      
      if (result.success) {
        toast.success("Invitation Revoked", {
          description: result.message,
        })
        router.refresh()
      } else {
        toast.error("Failed to Revoke", {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      })
    } finally {
      setRevokingId(null)
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
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle>Members ({members.length})</CardTitle>
              <CardDescription>
                Manage your organization members and invitations
              </CardDescription>
            </div>
            <Button onClick={() => setShowInviteDialog(true)} size="sm">
              <Icon name="user-plus" className="h-4 w-4" />
              Invite
            </Button>
          </div>
        </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No members found
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isPending = member.status === "pending"
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(member.userName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`font-medium ${isPending ? "text-muted-foreground" : ""}`}>
                            {member.userName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.userEmail}
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
                      <TableCell className="text-muted-foreground">
                        {isPending ? "Not joined" : formatDate(member.createdAt)}
                      </TableCell>
                      <TableCell>
                        {isPending && member.invitationId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeInvitation(member.invitationId!)}
                            disabled={revokingId === member.invitationId}
                          >
                            {revokingId === member.invitationId ? (
                              <Icon name="loader" className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icon name="x" className="h-4 w-4" />
                            )}
                            <span className="ml-1">Revoke</span>
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


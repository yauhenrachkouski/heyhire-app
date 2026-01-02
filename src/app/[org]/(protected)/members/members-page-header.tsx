"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { InviteMemberDialog } from "./invite-member-dialog";

interface MembersPageHeaderProps {
  organizationId: string;
}

export function MembersPageHeader({ organizationId }: MembersPageHeaderProps) {
  const [showInviteDialog, setShowInviteDialog] = React.useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Members</h1>
          <p className="text-muted-foreground">
            Manage your organization members
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <Icon name="user-plus" className="h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <InviteMemberDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        organizationId={organizationId}
      />
    </>
  );
}


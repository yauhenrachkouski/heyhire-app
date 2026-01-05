import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignOutButton } from "@/components/auth/sign-out-button";
import Image from 'next/image'
import heyhireLogo from '@/assets/heyhire_logo.svg'
import { db } from "@/db/drizzle";
import * as schema from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { log } from "@/lib/axiom/server-log";

interface AcceptInvitationPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AcceptInvitationPage({
  params,
}: AcceptInvitationPageProps) {
  const { id } = await params;

  // Check if user is authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    // Query the invitation details from the database
    const invitationQuery = await db
      .select({
        email: schema.invitation.email,
        orgName: schema.organization.name,
      })
      .from(schema.invitation)
      .innerJoin(schema.organization, eq(schema.invitation.organizationId, schema.organization.id))
      .where(
        and(
          eq(schema.invitation.id, id),
          eq(schema.invitation.status, "pending"),
          gt(schema.invitation.expiresAt, new Date())
        )
      )
      .limit(1);

    const invitation = invitationQuery[0];

    if (!invitation) {
      // Invalid invitation
      return (
        <div className="flex min-h-svh flex-col p-6 md:p-10">
          <div className="flex justify-center gap-2 md:justify-start">
            <a href="/" className="flex items-center gap-2 font-medium">
              <Image
                src={heyhireLogo}
                alt="Heyhire"
                width={100}
                height={25}
              />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-lg">
              <Card className="w-full shadow-none ring-0">
                <CardHeader>
                  <CardTitle className="text-xl text-center">Invitation Expired or Invalid</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertDescription>
                      This invitation link is no longer valid. It may have been accepted already, expired, or canceled.
                    </AlertDescription>
                  </Alert>
                  <div className="text-sm text-muted-foreground text-center">
                    If you're already a member of Heyhire, please sign in to continue.
                  </div>
                  <a
                    href="/auth/signin"
                    className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                  >
                    Sign In to Heyhire
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      );
    }

    const { email, orgName } = invitation;

    // Render invitation details page
    return (
      <div className="flex min-h-svh flex-col p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-medium">
            <Image
              src={heyhireLogo}
              alt="Heyhire"
              width={100}
              height={25}
            />
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg">
            <Card className="w-full shadow-none ring-0">
              <CardHeader>
                <CardTitle className="text-xl text-center">Join {orgName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    You've been invited to join <strong>{orgName}</strong>. This invitation was sent to <strong>{email}</strong>.
                  </AlertDescription>
                </Alert>
                <div className="text-sm text-muted-foreground text-center">
                  Please sign in with the Google account associated with {email} to accept this invitation.
                </div>
                <a
                  href={`/auth/signin?callbackUrl=/auth/accept-invitation/${id}`}
                  className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                  Sign In to Accept Invitation
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  try {
    // Accept the invitation using Better Auth
    await auth.api.acceptInvitation({
      body: {
        invitationId: id,
      },
      headers: await headers(),
    });

    const activeOrganization = await auth.api.getFullOrganization({
      headers: await headers(),
    })

    // Redirect to organization page on success
    redirect(activeOrganization ? `/${activeOrganization.id}/organization?invitation=accepted` : "/");
  } catch (error: any) {
    log.error("AcceptInvitationPage", "Error accepting invitation", { error });

    // Check if the error is specifically about wrong recipient
    const errorMessage = error?.message || error?.body?.message || '';
    if (errorMessage.includes("You are not the recipient of the invitation")) {
      // Render error page for wrong user
      return (
        <div className="flex min-h-svh flex-col p-6 md:p-10">
          <div className="flex justify-center gap-2 md:justify-start">
            <a href="/" className="flex items-center gap-2 font-medium">
              <Image
                src={heyhireLogo}
                alt="Heyhire"
                width={100}
                height={25}
              />
            </a>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-lg">
              <Card className="w-full shadow-none ring-0">
                <CardHeader>
                  <CardTitle className="text-xl text-center">Invitation Error</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertDescription>
                      This invitation was sent to a different email address than the one you're currently signed in with.
                    </AlertDescription>
                  </Alert>
                  <div className="text-sm text-muted-foreground text-center">
                    Please sign out and sign in with the Google account that received the invitation.
                  </div>
                  <SignOutButton invitationId={id} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      );
    }

    const activeOrganization = await auth.api.getFullOrganization({
      headers: await headers(),
    })

    // For other errors, redirect as before
    redirect(activeOrganization ? `/${activeOrganization.id}/organization?invitation=error` : "/");
  }
}

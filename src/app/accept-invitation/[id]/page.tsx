import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
    // Redirect to sign in with return URL
    redirect(`/auth/signin?callbackUrl=/accept-invitation/${id}`);
  }

  try {
    // Accept the invitation using Better Auth
    await auth.api.acceptInvitation({
      body: {
        invitationId: id,
      },
      headers: await headers(),
    });

    // Redirect to organization page on success
    redirect("/organization?invitation=accepted");
  } catch (error) {
    console.error("Error accepting invitation:", error);
    // Redirect with error message
    redirect("/organization?invitation=error");
  }
}


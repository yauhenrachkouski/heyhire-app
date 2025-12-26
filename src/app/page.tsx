import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function RootPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return redirect("/auth/signin")
  }

  const activeOrganization = await auth.api.getFullOrganization({
    headers: await headers(),
  })

  if (!activeOrganization) {
    return redirect("/onboarding")
  }

  return redirect(`/${activeOrganization.id}`)
}

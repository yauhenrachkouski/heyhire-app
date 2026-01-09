import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { SettingsSidebar } from "@/components/account/settings-sidebar"
import { getUserRole } from "@/lib/request-access"
import { isReadOnlyRole } from "@/lib/roles"

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ org: string }>
}) {
  const { org } = await params

  // Check if user has read-only role - redirect them away from settings
  const role = await getUserRole(org)
  if (isReadOnlyRole(role)) {
    redirect(`/${org}/search`)
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:py-8 md:px-6">
      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <aside className="w-full shrink-0 md:w-48">
          <SettingsSidebar />
        </aside>
        <main className="flex-1 min-w-0 max-w-3xl space-y-10">{children}</main>
      </div>
    </div>
  )
}

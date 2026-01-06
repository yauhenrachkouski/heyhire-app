import type { ReactNode } from "react"

import { SettingsSidebar } from "@/components/account/settings-sidebar"

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:py-8 md:px-6">
      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        <aside className="w-full shrink-0 md:w-48">
          <SettingsSidebar />
        </aside>
        <main className="flex-1 min-w-0 max-w-3xl space-y-6">{children}</main>
      </div>
    </div>
  )
}

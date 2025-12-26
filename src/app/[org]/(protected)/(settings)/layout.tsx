import type { ReactNode } from "react"

export default function SettingsLayout({
  children,
  header,
}: {
  children: ReactNode
  header: ReactNode
}) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8 md:px-0 space-y-8">
      {header}
      <div className="space-y-6">{children}</div>
    </div>
  )
}

import { PreviewDashboardLayout } from "@/components/preview/preview-dashboard-layout"

export default async function PreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return <PreviewDashboardLayout token={token}>{children}</PreviewDashboardLayout>
}

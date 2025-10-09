import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { PersistentSidebarProvider } from "@/providers/sidebar-provider"

export default async function DashboardLayout({
  children,
  breadcrumbs,
}: {
  children: React.ReactNode
  breadcrumbs: React.ReactNode
}) {


  return (
    <PersistentSidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-border">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:h-4 mr-2"
          />
            {breadcrumbs}
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SidebarInset>
    </PersistentSidebarProvider>
  )
} 
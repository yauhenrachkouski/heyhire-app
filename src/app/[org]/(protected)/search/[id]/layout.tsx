"use client";

import * as React from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          "--sidebar-width": "600px",
          "--sidebar-width-mobile": "100%",
        } as React.CSSProperties
      }
      className="min-h-0" // override min-h-svh to fit in parent layout
    >
      {/* Important: avoid overflow-hidden here, it breaks position: sticky inside */}
      <SidebarInset className="min-h-0">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}


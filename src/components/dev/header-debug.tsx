"use client"

import { useEffect, useRef } from "react"
import { useSidebar } from "@/components/ui/sidebar"

export function HeaderDebugLogger() {
  const { state, open, isMobile } = useSidebar()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const log = () => {
        const header = document.querySelector('header')
        const height = header?.getBoundingClientRect().height
        const allSidebars = document.querySelectorAll('[data-slot="sidebar"]')
        const collapsibleElements = document.querySelectorAll('[data-collapsible="icon"]')
        
        fetch('http://127.0.0.1:7242/ingest/0cd1b653-bec9-4bbb-b583-c1c514b1bb69', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'header-debug.tsx',
            message: 'Header Runtime State',
            data: {
              sidebarState: state,
              isOpen: open,
              isMobile,
              headerHeightPx: height,
              headerClasses: header?.className,
              sidebarCount: allSidebars.length,
              collapsibleIconCount: collapsibleElements.length,
              collapsibleStates: Array.from(collapsibleElements).map(el => ({
                dataState: el.getAttribute('data-state'),
                dataCollapsible: el.getAttribute('data-collapsible'),
                dataSlot: el.getAttribute('data-slot')
              }))
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            hypothesisId: '3'
          })
        }).catch(err => console.error('Log failed', err))
    }

    log()
    const interval = setInterval(log, 500)
    return () => clearInterval(interval)
  }, [state, open, isMobile])

  return null
}

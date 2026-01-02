"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/icon"
import Link from "next/link"

interface SupportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SupportModal({ open, onOpenChange }: SupportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Support & Feedback</DialogTitle>
          <DialogDescription>
            We're here to help. Don't hesitate to reach out to us.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          {/* WhatsApp Section */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Icon name="message-circle" className="size-5 text-green-600" />
                <h3 className="font-semibold">WhatsApp</h3>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-sm">
                  Write our co-founder{" "}
                  <Link
                    href="https://linkedin.com/in/yauhenrachkouski"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline underline-offset-2 underline inline"
                  >
                    Eugene
                  </Link>
                  {" "}to get instant help
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              asChild
            >
              <a
                href="https://wa.me/48572121572"
                target="_blank"
                rel="noopener noreferrer"
              >
                Start chat
              </a>
            </Button>
          </div>

          {/* Email Section */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon name="mail" className="size-4 text-amber-600" />
                <h3 className="font-medium">Support email</h3>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              asChild
            >
              <a
                href="mailto:support@heyhire.ai"
              >
                Email
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

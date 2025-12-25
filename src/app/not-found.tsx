import Link from "next/link"
import { IconFolderCode } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default function NotFound() {
  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <Empty className="p-6 sm:p-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconFolderCode />
            </EmptyMedia>
            <EmptyTitle>Page not found</EmptyTitle>
            <EmptyDescription>
              Sorry, we couldn’t find the page you’re looking for. It might have
              been moved, renamed, or removed.
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/">Go Home</Link>
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  )
}

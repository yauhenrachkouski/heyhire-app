import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6">
      <div className="text-center max-w-2xl">
        <div className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-medium">
          <Icon name="alert-triangle" aria-hidden />
          <span className="ml-2">404</span>
        </div>

        <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-muted-foreground">
          Sorry, we couldn’t find the page you’re looking for. It might have been moved, renamed, or removed.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/">
            <Button className="gap-2">
              <Icon name="home" aria-hidden />
              Home
            </Button>
          </Link>
          <Link href="/candidates">
            <Button variant="secondary" className="gap-2">
              <Icon name="users" aria-hidden />
              Candidates
            </Button>
          </Link>
          <Link href="/jobs">
            <Button variant="ghost" className="gap-2">
              <Icon name="briefcase" aria-hidden />
              Jobs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}



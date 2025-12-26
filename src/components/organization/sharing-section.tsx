"use client"

import * as React from "react"
import { IconCheck, IconCopy, IconLinkOff, IconPlus } from "@tabler/icons-react"
import { toast } from "sonner"

import { createShareLink, listShareLinks, revokeShareLink } from "@/actions/share-links"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ShareLink = Awaited<ReturnType<typeof listShareLinks>>[number]

export function SharingSection({
  organizationId,
  initialLinks,
}: {
  organizationId: string
  initialLinks: ShareLink[]
}) {
  const [links, setLinks] = React.useState<ShareLink[]>(initialLinks)
  const [maxViews, setMaxViews] = React.useState<string>("")
  const [expiresAt, setExpiresAt] = React.useState<string>("")
  const [isPending, startTransition] = React.useTransition()

  const refresh = React.useCallback(() => {
    startTransition(async () => {
      const next = await listShareLinks(organizationId)
      setLinks(next)
    })
  }, [organizationId])

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const parsedMaxViews =
          maxViews.trim() === "" ? undefined : Number.parseInt(maxViews, 10)
        const parsedExpiresAt =
          expiresAt.trim() === "" ? undefined : new Date(expiresAt)

        const { token } = await createShareLink({
          organizationId,
          maxViews: parsedMaxViews,
          expiresAt: parsedExpiresAt,
        })

        const url = `${window.location.origin}/p/${token}`
        await navigator.clipboard.writeText(url)
        toast("Share link created", {
          description: "Copied to clipboard",
        })

        refresh()
      } catch (e) {
        toast.error("Failed to create share link", {
          description: e instanceof Error ? e.message : "Unknown error",
        })
      }
    })
  }

  const handleCopy = async (id: string) => {
    const url = `${window.location.origin}/p/${id}`
    await navigator.clipboard.writeText(url)
    toast("Copied", { description: url })
  }

  const handleRevoke = (id: string) => {
    startTransition(async () => {
      try {
        await revokeShareLink(id)
        toast("Share link revoked")
        refresh()
      } catch (e) {
        toast.error("Failed to revoke share link", {
          description: e instanceof Error ? e.message : "Unknown error",
        })
      }
    })
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Sharing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxViews">Max views (optional)</Label>
            <Input
              id="maxViews"
              inputMode="numeric"
              placeholder="e.g. 50"
              value={maxViews}
              onChange={(e) => setMaxViews(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiresAt">Expires at (optional)</Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={handleCreate} disabled={isPending}>
            <IconPlus />
            Create share link
          </Button>
        </div>

        <div className="space-y-2">
          {links.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No share links yet.
            </div>
          ) : (
            <div className="space-y-2">
              {links.map((l) => {
                const url = `/p/${l.id}`
                const revoked = !!l.revokedAt
                return (
                  <div
                    key={l.id}
                    className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{url}</div>
                      <div className="text-xs text-muted-foreground">
                        Views: {l.viewCount}
                        {typeof l.maxViews === "number" ? ` / ${l.maxViews}` : ""}
                        {l.expiresAt ? ` • Expires: ${new Date(l.expiresAt).toLocaleString()}` : ""}
                        {revoked ? " • Revoked" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleCopy(l.id)}
                        disabled={revoked || isPending}
                      >
                        <IconCopy />
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => handleRevoke(l.id)}
                        disabled={revoked || isPending}
                      >
                        <IconLinkOff />
                        Revoke
                      </Button>
                      {revoked && (
                        <div className="text-xs text-muted-foreground">
                          <IconCheck className="inline size-4" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}





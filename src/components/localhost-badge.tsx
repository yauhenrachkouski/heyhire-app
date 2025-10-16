import { Badge } from '@/components/ui/badge'

interface LocalhostBadgeProps {
  isLocalhost: boolean
}

export function LocalhostBadge({ isLocalhost }: LocalhostBadgeProps) {
  if (!isLocalhost) return null

  return (
    <div className="fixed top-3 right-3 z-50">
      <Badge variant="destructive">Localhost</Badge>
    </div>
  )
}

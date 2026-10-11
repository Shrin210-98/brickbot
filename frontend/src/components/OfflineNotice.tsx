import { WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

// Shown at /offline and in place of a load error while the browser is offline.
// Listings already viewed are served from the service worker cache (docs/pwa.md).
export function OfflineNotice({ heading: Heading = 'h2' }: { heading?: 'h1' | 'h2' }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden />
      <Heading className="text-2xl font-semibold">You're offline</Heading>
      <p className="max-w-sm text-muted-foreground">Your saved listings still work.</p>
      <Button className="h-11 px-6" nativeButton={false} render={<Link to="/listings" />}>
        Browse listings
      </Button>
    </div>
  )
}

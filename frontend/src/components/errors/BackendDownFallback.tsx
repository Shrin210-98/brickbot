import { Phone, WifiOff } from 'lucide-react'
import { useProfile } from '@/api/profile'
import { WhatsAppGlyph } from '@/components/whatsapp/WhatsAppGlyph'
import { cn } from '@/lib/utils'
import { whatsappLink } from '@/lib/whatsapp'

export type BackendDownContext = 'featured' | 'listings' | 'detail' | 'chat' | 'contact' | 'admin'

interface Copy {
  heading: string
  message: (name: string) => string
  cta: 'whatsapp' | 'both' | 'none'
}

const COPY: Record<BackendDownContext, Copy> = {
  featured: {
    heading: 'Featured listings are being updated.',
    message: (name) => `Contact ${name} for what's available today.`,
    cta: 'whatsapp',
  },
  listings: {
    heading: 'Listings are being refreshed.',
    message: () => "Get in touch and I'll share what's available today.",
    cta: 'both',
  },
  detail: {
    heading: "This listing isn't available right now.",
    message: () => "Reach out and I'll share more details.",
    cta: 'both',
  },
  contact: {
    heading: "Can't send right now.",
    message: (name) => `Reach ${name} directly on WhatsApp.`,
    cta: 'whatsapp',
  },
  chat: {
    heading: 'Chat is taking a break.',
    message: (name) => `Reach ${name} on WhatsApp for instant help.`,
    cta: 'whatsapp',
  },
  admin: {
    heading: 'Backend is offline.',
    message: () => 'Start the Cloudflare Tunnel to use the admin panel.',
    cta: 'none',
  },
}

// The header's contact group, with labels: a tinted pill holding borderless
// segments split by a hairline.
const GROUP = 'flex w-fit items-center rounded-lg bg-secondary/40 p-1'
const SEGMENT =
  'inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9'
const DIVIDER = 'h-6.5 w-px bg-input'

// Shown in place of backend data when the API can't be reached (see
// isBackendDown), so a visitor always has a way to reach the salesman.
// compact drops the heading for inline spots like the chat panel.
export function BackendDownFallback({ context, compact = false }: { context: BackendDownContext; compact?: boolean }) {
  const { data: profile } = useProfile()
  const copy = COPY[context]
  const name = profile?.full_name.split(/\s+/)[0] || 'us'
  const whatsapp = profile && copy.cta !== 'none' ? whatsappLink(profile.whatsapp_number) : null
  const phone = copy.cta === 'both' ? profile?.phone : undefined

  const ctas = (whatsapp || phone) && (
    <div className={GROUP}>
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={cn(SEGMENT, 'group/wa')}>
          <WhatsAppGlyph className="size-5 text-sage-green transition-colors group-hover/wa:text-sage-green-hover" />
          Chat on WhatsApp
        </a>
      )}
      {whatsapp && phone && <span className={DIVIDER} aria-hidden />}
      {phone && (
        <a href={`tel:${phone}`} aria-label={profile ? `Call ${profile.full_name}` : 'Call'} className={SEGMENT}>
          <Phone className="size-4" /> Call
        </a>
      )}
    </div>
  )

  if (compact) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <WifiOff className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="flex-1 text-sm text-muted-foreground">{copy.message(name)}</p>
        {ctas}
      </div>
    )
  }

  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <WifiOff className="size-5 text-muted-foreground" aria-hidden />
      <h2 className="font-display text-lg text-foreground">{copy.heading}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{copy.message(name)}</p>
      {ctas && <div className="mt-2">{ctas}</div>}
    </div>
  )
}

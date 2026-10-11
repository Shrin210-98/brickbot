import { Phone } from 'lucide-react'
import { useProfile } from '@/api/profile'
import { WhatsAppGlyph } from '@/components/whatsapp/WhatsAppGlyph'
import { formatPhone } from '@/lib/format'
import { cn } from '@/lib/utils'
import { whatsappLink } from '@/lib/whatsapp'

// One half of the header group: no border or fill of its own, a tint on hover.
// Below sm the group is WhatsApp only, sized to a 44px target.
const SEGMENT =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:size-11'
const GROUP = 'flex shrink-0 items-center rounded-lg bg-secondary/40 p-1 max-sm:p-0'
// About 60% of the 44px group.
const DIVIDER = 'hidden h-6.5 w-px bg-input sm:block'

// Header: WhatsApp and Call merged into one group, divided by a hairline.
// Without a phone it collapses to WhatsApp alone. Until the first profile
// arrives, an invisible copy holds the space so nothing shifts.
export function ContactButtons() {
  const { data: profile } = useProfile()

  if (profile === undefined) {
    return (
      <div className={cn(GROUP, 'h-11 invisible')} aria-hidden>
        <span className={SEGMENT}>
          <WhatsAppGlyph className="size-5" />
        </span>
        <span className={DIVIDER} />
        <span className={cn(SEGMENT, 'max-sm:hidden')}>
          <Phone className="size-4" /> Call
        </span>
      </div>
    )
  }

  const whatsapp = whatsappLink(profile.whatsapp_number)
  const phone = profile.phone
  if (!whatsapp && !phone) return null

  return (
    <div className={cn(GROUP, 'h-11')}>
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className={cn(SEGMENT, 'group/wa')}>
          <WhatsAppGlyph className="size-5 text-sage-green transition-colors group-hover/wa:text-sage-green-hover" />
        </a>
      )}
      {whatsapp && phone && <span className={DIVIDER} aria-hidden />}
      {phone && (
        <a href={`tel:${phone}`} aria-label={`Call ${profile.full_name}`} className={cn(SEGMENT, 'max-sm:hidden')}>
          <Phone className="size-4" /> Call
        </a>
      )}
    </div>
  )
}

// Mobile Sheet menu: the same two actions as full-width square rows.
const ROW =
  'flex items-center gap-3 px-5 py-3 text-base font-medium text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset'

export function ContactRows() {
  const { data: profile } = useProfile()
  const whatsapp = profile ? whatsappLink(profile.whatsapp_number) : null
  const phone = profile?.phone
  if (!whatsapp && !phone) return null

  return (
    <div className="flex flex-col">
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={cn(ROW, 'group/wa', phone && 'border-b border-border')}>
          <WhatsAppGlyph className="size-5 text-sage-green transition-colors group-hover/wa:text-sage-green-hover" /> Chat on WhatsApp
        </a>
      )}
      {phone && (
        <a href={`tel:${phone}`} className={ROW}>
          {/* A 20px slot like the glyph's, so both labels line up. */}
          <span className="flex size-5 items-center justify-center">
            <Phone className="size-4" />
          </span>
          Call {formatPhone(phone)}
        </a>
      )}
    </div>
  )
}

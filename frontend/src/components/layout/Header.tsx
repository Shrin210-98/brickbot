import { useEffect, useState } from 'react'
import { Menu, Phone } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useProfile } from '@/api/profile'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { WhatsAppGlyph } from '@/components/whatsapp/WhatsAppGlyph'
import { formatPhone } from '@/lib/format'
import { cn } from '@/lib/utils'
import { whatsappLink } from '@/lib/whatsapp'
import { InstallAppMenuItem } from './InstallApp'
import { NAV_ITEMS, siteName } from './nav'

const SCROLL_THRESHOLD = 16

// WhatsApp and Call: matching outlined boxes, monochrome icons.
const CONTACT_BOX =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border p-2 text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50'
// The same treatment as full-width rows in the mobile menu.
const CONTACT_ROW =
  'flex h-11 w-full items-center gap-3 rounded-lg border border-border px-3 text-base font-medium text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50'

function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(() => window.scrollY > SCROLL_THRESHOLD)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return scrolled
}

export function Header() {
  const { data: profile } = useProfile()
  const { pathname } = useLocation()
  const scrolled = useScrolled()
  const [menuOpen, setMenuOpen] = useState(false)

  const brand = siteName(profile)
  const whatsapp = profile ? whatsappLink(profile.whatsapp_number) : null
  const phone = profile?.phone
  // Transparent only while at the top of Home; solid everywhere else.
  const solid = scrolled || pathname !== '/'
  const isActive = (label: string) => label === 'Listings' && pathname.startsWith('/listings')

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b transition-colors duration-200',
        solid ? 'border-border bg-background/95 backdrop-blur' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="min-w-0 truncate py-2 font-display text-xl font-semibold tracking-tight">
          {brand}
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                isActive(item.label) ? 'text-primary' : 'text-foreground/80',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {/* Until the first profile arrives, empty boxes hold the space so nothing shifts. */}
          {profile === undefined ? (
            <span className={cn(CONTACT_BOX, 'invisible')} aria-hidden />
          ) : (
            whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className={CONTACT_BOX}>
                <WhatsAppGlyph className="size-5" />
              </a>
            )
          )}
          {profile === undefined ? (
            <span className={cn(CONTACT_BOX, 'invisible hidden sm:inline-flex')} aria-hidden />
          ) : (
            phone && (
              <a href={`tel:${phone}`} aria-label={`Call ${formatPhone(phone)}`} className={cn(CONTACT_BOX, 'hidden sm:inline-flex')}>
                <Phone className="size-5" />
              </a>
            )
          )}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label="Open menu" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle className="font-display text-xl">{brand}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col px-2" aria-label="Mobile">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'rounded-md px-3 py-3 text-base font-medium hover:bg-secondary',
                      isActive(item.label) && 'text-primary',
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              {(whatsapp || phone) && (
                <div className="flex flex-col gap-2 px-5">
                  {whatsapp && (
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={CONTACT_ROW}>
                      <WhatsAppGlyph className="size-5" /> WhatsApp
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`} className={CONTACT_ROW}>
                      <Phone className="size-5" /> Call {formatPhone(phone)}
                    </a>
                  )}
                </div>
              )}
              <InstallAppMenuItem />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

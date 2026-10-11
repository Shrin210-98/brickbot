import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useProfile } from '@/api/profile'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ContactButtons, ContactRows } from './ContactButtons'
import { InstallAppMenuItem } from './InstallApp'
import { NAV_ITEMS, siteName } from './nav'

const SCROLL_THRESHOLD = 16

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
          <ContactButtons />
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
              <ContactRows />
              <InstallAppMenuItem />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

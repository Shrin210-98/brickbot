import { Building2 } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useProfile } from '@/api/profile'
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton'
import { cn } from '@/lib/utils'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm font-medium transition-colors hover:text-foreground', isActive ? 'text-foreground' : 'text-muted-foreground')

export function PublicLayout() {
  const { data: profile } = useProfile()
  const brand = profile?.name || 'BrickBot'

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Building2 className="size-5" />
            {brand}
          </Link>
          <nav className="flex items-center gap-6">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/listings" className={navLinkClass}>
              Listings
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {brand}
        </div>
      </footer>
      <WhatsAppButton />
    </div>
  )
}

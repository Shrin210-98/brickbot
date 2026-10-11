import { Mail, MessageCircle, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProfile } from '@/api/profile'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/format'
import { whatsappLink } from '@/lib/whatsapp'
import { NAV_ITEMS, siteName } from './nav'

export function Footer() {
  const { data: profile } = useProfile()
  const brand = siteName(profile)
  const whatsapp = profile ? whatsappLink(profile.whatsapp_number) : null

  const stats = [
    profile?.years_experience != null && `${profile.years_experience} years`,
    profile?.deals_closed != null && `${profile.deals_closed} deals`,
    profile?.service_areas.length && profile.service_areas.slice(0, 2).join(' & '),
  ].filter(Boolean)

  return (
    <footer className="border-t bg-secondary">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3 md:py-10">
        <div className="flex flex-col gap-3">
          <p className="font-display text-2xl font-semibold">{brand}</p>
          {profile?.tagline && <p className="text-muted-foreground">{profile.tagline}</p>}
          {stats.length > 0 && <p className="text-sm text-muted-foreground">{stats.join(' · ')}</p>}
        </div>

        <nav className="flex flex-col md:gap-3" aria-label="Footer">
          <p className="text-sm font-semibold tracking-wider text-foreground uppercase">Explore</p>
          {NAV_ITEMS.map((item) => (
            <Link key={item.label} to={item.to} className="py-2.5 text-muted-foreground transition-colors hover:text-primary md:py-0">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold tracking-wider text-foreground uppercase">Contact</p>
          {whatsapp && (
            <Button
              className="h-11 self-start bg-[#25D366] px-4 text-white hover:bg-[#1ebe5b]"
              nativeButton={false}
              render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}
            >
              <MessageCircle data-icon="inline-start" /> Chat on WhatsApp
            </Button>
          )}
          {profile?.phone && (
            <a href={`tel:${profile.phone}`} className="flex min-h-11 items-center gap-2 text-muted-foreground hover:text-primary md:min-h-0">
              <Phone className="size-4" /> {formatPhone(profile.phone)}
            </a>
          )}
          {profile?.email && (
            <a href={`mailto:${profile.email}`} className="flex min-h-11 items-center gap-2 text-muted-foreground hover:text-primary md:min-h-0">
              <Mail className="size-4" /> {profile.email}
            </a>
          )}
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-5 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {brand}
          {profile?.license_no && <> · RERA {profile.license_no}</>}
        </div>
      </div>
    </footer>
  )
}

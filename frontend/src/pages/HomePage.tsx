import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Compass, KeyRound, ListChecks, MapPin, MessageCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useFeaturedListings } from '@/api/listings'
import { useProfile } from '@/api/profile'
import { images } from '@/assets/images'
import { ListingsCarousel } from '@/components/blocks/ListingsCarousel'
import { TestimonialsCarousel } from '@/components/blocks/TestimonialsCarousel'
import { ApiErrorState } from '@/components/errors/ApiErrorState'
import { InquiryForm } from '@/components/inquiry/InquiryForm'
import { siteName } from '@/components/layout/nav'
import { EmptyState } from '@/components/listings/EmptyState'
import { ListingGrid } from '@/components/listings/ListingGrid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { whatsappLink } from '@/lib/whatsapp'
import type { Profile } from '@/types/api'

const STEP_ICONS = [Compass, ListChecks, MapPin, KeyRound]

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function Section({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn('py-20 md:py-28', className)}>
      <div className="mx-auto max-w-6xl px-4">{children}</div>
    </section>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium tracking-wider text-primary uppercase">{children}</p>
}

// Tries the profile photo, then the placeholder portrait, then falls back to
// initials once every image has failed to load.
function Portrait({ profile }: { profile: Profile }) {
  const frame = 'aspect-[4/5] w-full max-w-[400px] rounded-2xl'
  const sources = [profile.photo_url, images.people.agent].filter((s): s is string => !!s)
  const [failed, setFailed] = useState(0)
  const src = sources[failed]
  if (src) {
    return (
      <img
        src={src}
        alt={profile.full_name}
        onError={() => setFailed((n) => n + 1)}
        className={cn(frame, 'object-cover shadow-sm')}
      />
    )
  }
  return (
    <div
      className={cn(frame, 'flex items-center justify-center bg-primary font-display text-8xl text-primary-foreground')}
      aria-hidden
    >
      {initials(profile.full_name)}
    </div>
  )
}

function heroSubhead(profile: Profile | null): string {
  const areas = profile?.service_areas.slice(0, 3) ?? []
  if (areas.length > 0) return `Helping families buy and sell in ${areas.join(', ')}.`
  return 'Homes, plots and commercial spaces for sale and rent.'
}

function Hero({ profile }: { profile: Profile | null }) {
  const whatsapp = profile ? whatsappLink(profile.whatsapp_number) : null
  return (
    // The image and overlay are absolute against the section, so they bleed
    // to its edges while the content keeps Section's max-w-6xl wrapper.
    <Section id="hero" className="relative isolate overflow-hidden pt-12 md:pt-20">
      <img
        src={images.hero.home}
        alt=""
        aria-hidden
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background" />
      <div className="relative grid items-center gap-12 md:grid-cols-[1fr_auto] md:gap-16">
        <div className="flex flex-col gap-5">
          {profile?.tagline && <Eyebrow>{profile.tagline}</Eyebrow>}
          <h1 className="text-[2.5rem]/[1.1] sm:text-5xl/[1.1] md:text-[3.5rem]/[1.1]">
            {profile?.full_name ?? siteName(profile)}
          </h1>
          {profile?.headline && (
            <p className="font-display text-xl/[1.3] text-muted-foreground md:text-[1.75rem]/[1.3]">{profile.headline}</p>
          )}
          <p className="line-clamp-2 max-w-xl text-muted-foreground">
            {heroSubhead(profile)}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button className="h-11 w-full px-6 text-base sm:w-auto" nativeButton={false} render={<Link to="/listings" />}>
              Browse Listings <ArrowRight data-icon="inline-end" />
            </Button>
            {whatsapp && (
              <Button
                variant="outline"
                className="h-11 w-full px-6 text-base sm:w-auto"
                nativeButton={false}
                render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}
              >
                <MessageCircle data-icon="inline-start" /> Chat on WhatsApp
              </Button>
            )}
          </div>
        </div>
        {profile && (
          <div className="flex justify-center md:justify-end">
            <Portrait key={profile.photo_url} profile={profile} />
          </div>
        )}
      </div>
    </Section>
  )
}

function Credential({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border bg-card p-5">
      <p className="font-display text-2xl font-semibold break-words text-primary md:text-3xl">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function About({ profile }: { profile: Profile }) {
  const firstName = profile.full_name.split(/\s+/)[0] || profile.full_name
  const credentials = [
    profile.years_experience != null && { value: `${profile.years_experience} years`, label: 'in Mumbai real estate' },
    profile.deals_closed != null && { value: `${profile.deals_closed}+ deals`, label: 'closed for families' },
    profile.license_no && { value: profile.license_no, label: 'MahaRERA registered' },
  ].filter((c): c is { value: string; label: string } => !!c)

  return (
    <Section id="about" className="bg-secondary">
      <div className="flex flex-col gap-16">
        <div className="grid gap-12 md:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-6">
            <Eyebrow>About</Eyebrow>
            <h2 className="text-3xl/[1.2] md:text-[2.5rem]/[1.2]">About {firstName}</h2>
            {profile.bio && <p className="text-lg whitespace-pre-line text-foreground/80">{profile.bio}</p>}
            {credentials.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-3">
                {credentials.map((c) => (
                  <Credential key={c.value} {...c} />
                ))}
              </div>
            )}
          </div>
          {profile.specialties.length > 0 && (
            <div className="flex flex-col gap-4 md:pt-24">
              <p className="font-display text-xl font-semibold">Specialties</p>
              <div className="flex flex-wrap gap-2">
                {profile.specialties.map((s) => (
                  <Badge key={s} variant="outline" className="h-auto bg-background px-3 py-1.5 text-sm">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {profile.process_steps.length > 0 && (
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h3>How I Work</h3>
              <p className="text-muted-foreground">A simple process, on your timeline.</p>
            </div>
            <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {profile.process_steps.map((step, i) => {
                const Icon = STEP_ICONS[i % STEP_ICONS.length]
                return (
                  <li key={i}>
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardContent className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <span className="font-display text-3xl font-semibold text-primary">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Icon className="size-5" />
                          </span>
                        </div>
                        <p className="text-lg font-semibold">{step.title}</p>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </CardContent>
                    </Card>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </Section>
  )
}

// 8c: redesigned featured listings.
function FeaturedListings() {
  const featured = useFeaturedListings()
  return (
    <Section id="listings">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl/[1.2]">Featured Listings</h2>
          <Button variant="link" className="h-11 md:h-8" nativeButton={false} render={<Link to="/listings" />}>
            See all listings
          </Button>
        </div>
        {featured.isError ? (
          <ApiErrorState
            error={featured.error}
            title="Couldn't load featured listings"
            onRetry={() => void featured.refetch()}
          />
        ) : featured.isPending || featured.data.items.length === 0 ? (
          <ListingGrid
            items={featured.data?.items}
            isLoading={featured.isPending}
            skeletonCount={3}
            empty={<EmptyState title="No featured listings yet" description="Featured properties will appear here once they're published." />}
          />
        ) : (
          <ListingsCarousel items={featured.data.items} />
        )}
      </div>
    </Section>
  )
}

// Scrolls to location.hash (or the top) on every navigation to Home, so header
// links work from other routes and when clicked again. Re-runs once the profile
// has loaded, because the sections above the target change height.
function useScrollToHash(ready: boolean) {
  const { hash, key } = useLocation()
  useEffect(() => {
    if (!ready) return
    if (!hash) {
      window.scrollTo({ top: 0 })
      return
    }
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [hash, key, ready])
}

export function HomePage() {
  const { data: profile, isPending } = useProfile()
  useScrollToHash(!isPending)

  return (
    <>
      <title>{`${siteName(profile)} | ${profile?.full_name ?? 'Properties'}`}</title>
      {isPending ? (
        <Section id="hero">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-14 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        </Section>
      ) : (
        <>
          <Hero profile={profile ?? null} />
          {profile && <About profile={profile} />}
        </>
      )}
      <FeaturedListings />
      {/* 8c: testimonials */}
      <Section id="testimonials" className="bg-secondary">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Eyebrow>Testimonials</Eyebrow>
            <h2 className="text-3xl/[1.2]">What clients say</h2>
          </div>
          <TestimonialsCarousel />
        </div>
      </Section>
      {/* 8c: redesigned contact section */}
      <Section id="contact">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <h2 className="text-3xl/[1.2]">Get in Touch</h2>
          <Card>
            <CardContent>
              <InquiryForm />
            </CardContent>
          </Card>
        </div>
      </Section>
    </>
  )
}

import { ArrowRight, Mail, MessageCircle, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useFeaturedListings } from '@/api/listings'
import { useProfile } from '@/api/profile'
import { EmptyState } from '@/components/listings/EmptyState'
import { ListingGrid } from '@/components/listings/ListingGrid'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { whatsappLink } from '@/lib/whatsapp'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function Hero() {
  const { data: profile, isPending } = useProfile()

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    )
  }

  const whatsapp = profile ? whatsappLink(profile.whatsapp_number) : null

  return (
    <section className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:gap-10">
      {profile && (
        <Avatar className="size-28">
          {profile.photo_url && <AvatarImage src={profile.photo_url} alt={profile.name} />}
          <AvatarFallback className="text-2xl">{initials(profile.name)}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {profile ? profile.name : 'Find your next property'}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {profile?.bio || 'Browse homes, plots and commercial spaces available for sale and rent.'}
        </p>
        {!!profile?.service_areas.length && (
          <div className="flex flex-wrap gap-2">
            {profile.service_areas.map((area) => (
              <Badge key={area} variant="secondary">
                {area}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button nativeButton={false} render={<Link to="/listings" />}>
            Browse listings <ArrowRight data-icon="inline-end" />
          </Button>
          {whatsapp && (
            <Button variant="outline" nativeButton={false} render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}>
              <MessageCircle data-icon="inline-start" /> WhatsApp
            </Button>
          )}
          {profile?.contact.phone && (
            <Button variant="ghost" nativeButton={false} render={<a href={`tel:${profile.contact.phone}`} />}>
              <Phone data-icon="inline-start" /> {profile.contact.phone}
            </Button>
          )}
          {profile?.contact.email && (
            <Button variant="ghost" nativeButton={false} render={<a href={`mailto:${profile.contact.email}`} />}>
              <Mail data-icon="inline-start" /> Email
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

export function HomePage() {
  const featured = useFeaturedListings()
  const { data: profile } = useProfile()

  return (
    <div className="flex flex-col gap-10">
      <title>{profile?.name ? `${profile.name} | Properties` : 'BrickBot | Properties'}</title>
      <Hero />
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Featured listings</h2>
          <Button variant="link" nativeButton={false} render={<Link to="/listings" />}>
            View all
          </Button>
        </div>
        {featured.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn't load featured listings</AlertTitle>
            <AlertDescription>{featured.error.message}</AlertDescription>
          </Alert>
        ) : (
          <ListingGrid
            items={featured.data?.items}
            isLoading={featured.isPending}
            skeletonCount={3}
            empty={
              <EmptyState
                title="No featured listings yet"
                description="Featured properties will appear here once they're published."
              />
            }
          />
        )}
      </section>
    </div>
  )
}

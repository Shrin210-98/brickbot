import { Building2 } from 'lucide-react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel'
import type { ListingMedia } from '@/types/api'

// Embla handles swipe on touch screens; the arrows are for mouse and keyboard.
export function ListingGallery({ media, title }: { media: ListingMedia[]; title: string }) {
  if (media.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Building2 className="size-16" />
      </div>
    )
  }

  return (
    <Carousel className="overflow-hidden rounded-xl" opts={{ loop: media.length > 1 }}>
      <CarouselContent>
        {media.map((m, i) => (
          <CarouselItem key={m.id}>
            <div className="aspect-[16/9] bg-muted">
              {m.media_type === 'video' ? (
                <video src={m.url} controls preload="metadata" className="size-full object-contain" />
              ) : (
                <img
                  src={m.url}
                  alt={`${title}, photo ${i + 1} of ${media.length}`}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  className="size-full object-cover"
                />
              )}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {media.length > 1 && (
        <>
          <CarouselPrevious className="left-3 size-11 sm:size-8" />
          <CarouselNext className="right-3 size-11 sm:size-8" />
        </>
      )}
    </Carousel>
  )
}

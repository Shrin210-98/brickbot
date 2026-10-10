import { useEffect, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Tailwind only picks up literal class names, so slide widths come from fixed
// maps. Each width is a little under an even share so the next slide peeks in.
const MOBILE_BASIS: Record<number, string> = { 1: 'basis-[85%]', 2: 'basis-[48%]' }
const DESKTOP_BASIS: Record<number, string> = { 2: 'lg:basis-[48%]', 3: 'lg:basis-[32%]', 4: 'lg:basis-[24%]' }

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function prefersReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches
}

interface CarouselProps {
  items: ReactNode[]
  label: string
  className?: string
  desktopSlides?: number
  mobileSlides?: number
}

export function Carousel({ items, label, className, desktopSlides = 3, mobileSlides = 1 }: CarouselProps) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion)
  const [viewportRef, api] = useEmblaCarousel({
    loop: false,
    align: 'start',
    ...(reducedMotion && { duration: 0 }),
  })
  const [snaps, setSnaps] = useState<number[]>([])
  const [selected, setSelected] = useState(0)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    if (!api) return
    const sync = () => {
      setSnaps(api.scrollSnapList())
      setSelected(api.selectedScrollSnap())
      setCanPrev(api.canScrollPrev())
      setCanNext(api.canScrollNext())
    }
    sync()
    api.on('select', sync).on('reInit', sync)
    return () => {
      api.off('select', sync).off('reInit', sync)
    }
  }, [api])

  // Embla has no keyboard support of its own.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      api?.scrollPrev()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      api?.scrollNext()
    }
  }

  const slideBasis = cn(MOBILE_BASIS[mobileSlides], desktopSlides > 1 && 'sm:basis-[48%]', DESKTOP_BASIS[desktopSlides])

  return (
    <section aria-roledescription="carousel" aria-label={label} className={cn('flex flex-col gap-4', className)}>
      <div
        ref={viewportRef}
        tabIndex={0}
        aria-label={`${label}, use the arrow keys to scroll`}
        onKeyDown={onKeyDown}
        className="overflow-hidden rounded-xl py-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="-ml-4 flex touch-pan-y">
          {items.map((item, i) => (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${items.length}`}
              className={cn('grid min-w-0 shrink-0 grow-0 pl-4', slideBasis)}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
      {snaps.length > 1 && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center">
            {snaps.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === selected}
                onClick={() => api?.scrollTo(i)}
                className="group flex size-6 items-center justify-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'size-2.5 rounded-full transition-colors',
                    i === selected ? 'bg-primary' : 'bg-foreground/20 group-hover:bg-foreground/40',
                  )}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon-lg" aria-label="Previous slide" disabled={!canPrev} onClick={() => api?.scrollPrev()}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-lg" aria-label="Next slide" disabled={!canNext} onClick={() => api?.scrollNext()}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

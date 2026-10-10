import { Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TESTIMONIALS } from '@/content/testimonials'
import { cn } from '@/lib/utils'
import { Carousel } from './Carousel'

// Carousel defaults give basis-[85%] sm:basis-[48%] lg:basis-[32%]; the slides
// are grid cells, so h-full cards come out equal height.
export function TestimonialsCarousel() {
  const slides = TESTIMONIALS.map((t) => (
    <Card key={t.name} className="h-full">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex gap-0.5 text-primary" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={cn('size-4', i < t.rating ? 'fill-current' : 'opacity-30')} />
          ))}
        </div>
        <p className="flex-1 text-base leading-relaxed">{t.quote}</p>
        <div className="flex items-center gap-3">
          <img src={t.avatar} alt="" loading="lazy" className="size-12 rounded-full object-cover" />
          <div>
            <p className="font-semibold">{t.name}</p>
            <p className="text-sm text-muted-foreground">{t.role}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  ))
  return <Carousel label="Client testimonials" items={slides} />
}

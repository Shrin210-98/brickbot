// Single source for every image URL in the app. Dev placeholders from
// Picsum (stable seeds) and Pravatar (fixed ids); see docs/credits.md.
export const images = {
  hero: { home: 'https://picsum.photos/seed/brickbot-hero/1920/1080' },
  listings: {
    bandraWest: 'https://picsum.photos/seed/brickbot-listing-bandra/1200/800',
    khar: 'https://picsum.photos/seed/brickbot-listing-khar/1200/800',
    santacruz: 'https://picsum.photos/seed/brickbot-listing-santacruz/1200/800',
    interiors: 'https://picsum.photos/seed/brickbot-listing-interiors/1200/800',
    exterior: 'https://picsum.photos/seed/brickbot-listing-exterior/1200/800',
    living: 'https://picsum.photos/seed/brickbot-listing-living/1200/800',
  },
  people: {
    agent: 'https://i.pravatar.cc/400?img=12',
    testimonial1: 'https://i.pravatar.cc/400?img=20',
    testimonial2: 'https://i.pravatar.cc/400?img=32',
    testimonial3: 'https://i.pravatar.cc/400?img=45',
    testimonial4: 'https://i.pravatar.cc/400?img=60',
  },
  og: { default: 'https://picsum.photos/seed/brickbot-og/1200/630' },
} as const

export type Images = typeof images

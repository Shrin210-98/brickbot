import { images } from '@/assets/images'

export interface Testimonial {
  name: string
  role: string
  quote: string
  avatar: string
  rating: number // 1..5
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Anjali Mehta',
    role: 'First-time buyer, Bandra West',
    quote:
      'We had no idea how society transfers or home loans worked. Ravi walked us through every step and told us plainly which flats were overpriced. We moved in three months later.',
    avatar: images.people.testimonial1,
    rating: 5,
  },
  {
    name: 'Rohit Iyer',
    role: 'Sold in Khar',
    quote:
      "He priced our flat honestly instead of promising a number he couldn't get. It sold in six weeks, and he sorted the NOC and paperwork with the society himself.",
    avatar: images.people.testimonial2,
    rating: 5,
  },
  {
    name: 'Priya Nair',
    role: 'Rented in Santacruz East',
    quote:
      'I needed a 2 BHK near the airport on short notice. Ravi shortlisted four that actually matched our budget and came along for every visit after office hours.',
    avatar: images.people.testimonial3,
    rating: 5,
  },
  {
    name: 'Sameer Kapoor',
    role: 'NRI buyer, Pali Hill',
    quote:
      'Buying from Dubai felt risky. Ravi sent video walkthroughs, checked the title documents with our lawyer and kept us updated on WhatsApp until registration.',
    avatar: images.people.testimonial4,
    rating: 5,
  },
]

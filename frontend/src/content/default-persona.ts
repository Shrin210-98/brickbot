// Mirror of backend/seed/profile.json. Update both together.
import type { Profile } from '@/types/api'

// The last-resort profile when /api/profile fails and nothing is cached
// (api/profile.ts), so the name and the WhatsApp/Call buttons never vanish.
// Fields the seed doesn't set use the API's defaults (India / INR / sqft).
export const DEFAULT_PERSONA: Profile = {
  id: 0,
  full_name: 'Ravi Sharma',
  agency_name: 'BrickBot Realty',
  tagline: 'Your neighbour in Mumbai real estate',
  headline: 'Family homes, first-time buyers and society resales in Bandra and Khar.',
  bio: "I've helped Mumbai families buy, sell and rent homes for over a decade. Most of my clients are first-time buyers and families moving within the western suburbs, so I spend a lot of time explaining society paperwork, home-loan steps and what a fair price really looks like. I live in Bandra West, I pick up my own phone, and I'll tell you honestly when a flat isn't right for you.",
  photo_url: null,
  phone: '+919876543210',
  whatsapp_number: '919876543210',
  email: 'ravi@example.com',
  service_areas: ['Bandra West', 'Khar', 'Santacruz', 'Andheri West'],
  license_no: 'A51900012345',
  socials: {},
  years_experience: 12,
  deals_closed: 340,
  specialties: ['First-time buyers', 'Society resales', 'Family homes', 'Home-loan guidance', 'Rentals', 'NRI clients'],
  process_steps: [
    {
      title: 'Understand',
      description:
        'We sit down over chai and talk budget, neighbourhood, schools and commute, so I know what home means for you.',
    },
    {
      title: 'Shortlist',
      description:
        'I send a short, honest list of flats that fit, with society details and fair-price notes for each.',
    },
    {
      title: 'Visit',
      description:
        'We see them together on your schedule, evenings and weekends included. I point out what brochures leave out.',
    },
    {
      title: 'Keys',
      description:
        'I handle negotiation, the agreement, society NOC and registration until the keys are in your hand.',
    },
  ],
  country_code: 'IN',
  currency: 'INR',
  area_unit: 'sqft',
  chat_enabled: true,
}

import type { To } from 'react-router-dom'

// Header and footer links. Section links point at anchors on the Home page;
// HomePage scrolls to location.hash on every navigation, so they work from any
// route and when clicked again on Home.
export const NAV_ITEMS: { label: string; to: To }[] = [
  { label: 'Home', to: { pathname: '/' } },
  { label: 'About', to: { pathname: '/', hash: '#about' } },
  { label: 'Listings', to: { pathname: '/listings' } },
  { label: 'Testimonials', to: { pathname: '/', hash: '#testimonials' } },
  { label: 'Contact', to: { pathname: '/', hash: '#contact' } },
]

export function siteName(profile: { agency_name?: string; full_name?: string } | null | undefined): string {
  return profile?.agency_name || profile?.full_name || 'BrickBot'
}

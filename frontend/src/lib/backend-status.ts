import { useProfile } from '@/api/profile'
import { ApiError, isNetworkError } from '@/lib/api'

// The backend can't be reached: no response at all, or a 5xx. Behind Vercel
// and the Cloudflare Tunnel a stopped PC answers 502/530, not a TypeError.
// 4xx are real answers from a running backend and keep their own copy.
export function isBackendDown(err: unknown): boolean {
  return isNetworkError(err) || (err instanceof ApiError && err.status >= 500)
}

// Piggybacks on the profile query, which never errors: it resolves to the
// cached or default persona when /api/profile fails. Down means it settled on
// one of those. The cached copy shown while the first request is in flight
// doesn't count. A 404 (profile not seeded) also reads as down.
export function useBackendStatus(): { isDown: boolean } {
  const { source, isPlaceholderData } = useProfile()
  return { isDown: source !== undefined && source !== 'live' && !isPlaceholderData }
}

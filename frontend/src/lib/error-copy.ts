import { ApiError, isOffline } from '@/lib/api'

// Friendly copy for a failed API call. Never shows the raw message or status.
export function apiErrorMessage(err: unknown): string {
  if (isOffline(err)) return "Can't reach the server. Check your connection and try again."
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return "You don't have access to this."
    if (err.status === 404) return "We couldn't find that."
    if (err.status === 429) return 'Too many requests. Try again in a moment.'
    if (err.status >= 500) return 'The server is having trouble. Please try again in a moment.'
  }
  return 'Something went wrong.'
}

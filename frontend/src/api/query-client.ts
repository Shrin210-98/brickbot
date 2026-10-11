import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Always fetch, even offline: the service worker may answer from its
      // cache (docs/pwa.md). TanStack's default would pause the query instead.
      networkMode: 'always',
      // 4xx responses won't change on retry. Offline, show that at once rather
      // than after the retry backoff.
      retry: (count, err) => navigator.onLine && !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
})

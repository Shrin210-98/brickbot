import { useQuery } from '@tanstack/react-query'
import { apiFetch, isNotFound } from '@/lib/api'
import { DEFAULT_MARKET, type Market } from '@/lib/format'
import type { Profile } from '@/types/api'

// Resolves to null until the profile has been seeded (404).
export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async ({ signal }) => {
      try {
        return await apiFetch<Profile>('/api/profile', { signal })
      } catch (err) {
        if (isNotFound(err)) return null
        throw err
      }
    },
    staleTime: 5 * 60_000,
  })
}

export function useMarket(): Market {
  const { data } = useProfile()
  return data ?? DEFAULT_MARKET
}

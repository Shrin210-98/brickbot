import { useQuery } from '@tanstack/react-query'
import { DEFAULT_PERSONA } from '@/content/default-persona'
import { apiFetch } from '@/lib/api'
import { DEFAULT_MARKET, type Market } from '@/lib/format'
import type { Profile } from '@/types/api'

// Where the profile came from: the API, this browser's last good copy, or the
// bundled DEFAULT_PERSONA.
export type ProfileSource = 'live' | 'cached' | 'default'

export interface ResolvedProfile {
  profile: Profile
  source: ProfileSource
}

type ProfileStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const PROFILE_CACHE_KEY = 'brickbot.profile.v1'
const SCHEMA_VERSION = 1
const LIVE_STALE_MS = 5 * 60_000

interface CachedProfile {
  schemaVersion: number
  fetchedAt: number
  data: Profile
}

function browserStorage(): ProfileStorage | null {
  try {
    return localStorage
  } catch {
    return null
  }
}

// The cached profile, or null. A copy from another schema version is dropped.
export function readCachedProfile(storage: ProfileStorage | null): Profile | null {
  try {
    const raw = storage?.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw) as Partial<CachedProfile> | null
    const data = cached?.data
    if (cached?.schemaVersion === SCHEMA_VERSION && typeof data?.full_name === 'string' && typeof data.whatsapp_number === 'string') {
      return data
    }
    storage?.removeItem(PROFILE_CACHE_KEY)
  } catch {
    // Unparseable or storage blocked: behave as if nothing is cached.
  }
  return null
}

function writeCachedProfile(storage: ProfileStorage | null, profile: Profile, now: number) {
  try {
    const entry: CachedProfile = { schemaVersion: SCHEMA_VERSION, fetchedAt: now, data: profile }
    storage?.setItem(PROFILE_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // Quota or storage blocked: the next failure falls back to the default.
  }
}

// live → cached → default. Never rejects, so the contact buttons always have a
// profile. A 404 (profile not seeded) falls back the same way as an outage.
export async function resolveProfile(
  load: () => Promise<Profile>,
  storage: ProfileStorage | null,
  now = Date.now(),
): Promise<ResolvedProfile> {
  try {
    const profile = await load()
    writeCachedProfile(storage, profile, now)
    return { profile, source: 'live' }
  } catch {
    const cached = readCachedProfile(storage)
    return cached ? { profile: cached, source: 'cached' } : { profile: DEFAULT_PERSONA, source: 'default' }
  }
}

// The salesman's profile. data is undefined only on a first visit while the
// first request is in flight; afterwards it is always a Profile, with source
// saying where it came from. A cached copy shows immediately as placeholder.
// Fallbacks count as stale at once, so a remount, refocus or reconnect retries
// the API; a live profile stays fresh for 5 minutes.
export function useProfile() {
  const query = useQuery<ResolvedProfile>({
    queryKey: ['profile'],
    queryFn: ({ signal }) => resolveProfile(() => apiFetch<Profile>('/api/profile', { signal }), browserStorage()),
    placeholderData: (): ResolvedProfile | undefined => {
      const cached = readCachedProfile(browserStorage())
      return cached ? { profile: cached, source: 'cached' } : undefined
    },
    staleTime: (q) => (q.state.data?.source === 'live' ? LIVE_STALE_MS : 0),
  })
  return {
    data: query.data?.profile,
    source: query.data?.source,
    isPending: query.isPending,
    // The cached copy shown while the first request is still in flight.
    isPlaceholderData: query.isPlaceholderData,
  }
}

export function useMarket(): Market {
  const { data } = useProfile()
  return data ?? DEFAULT_MARKET
}

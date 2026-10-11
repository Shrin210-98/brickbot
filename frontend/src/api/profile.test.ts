import { describe, expect, it } from 'vitest'
import { PROFILE_CACHE_KEY, readCachedProfile, resolveProfile } from '@/api/profile'
import { DEFAULT_PERSONA } from '@/content/default-persona'
import type { Profile } from '@/types/api'

const LIVE: Profile = { ...DEFAULT_PERSONA, id: 1, full_name: 'Asha Rao', whatsapp_number: '919800000000' }
const down = () => Promise.reject(new TypeError('Failed to fetch'))

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

const entry = (schemaVersion: number, data: unknown) => JSON.stringify({ schemaVersion, fetchedAt: 1, data })

describe('resolveProfile', () => {
  it('returns the live profile and caches it', async () => {
    const storage = memoryStorage()
    await expect(resolveProfile(async () => LIVE, storage, 1234)).resolves.toEqual({ profile: LIVE, source: 'live' })
    expect(JSON.parse(storage.map.get(PROFILE_CACHE_KEY)!)).toEqual({ schemaVersion: 1, fetchedAt: 1234, data: LIVE })
  })

  it('falls back to the cached profile when the API fails', async () => {
    const storage = memoryStorage({ [PROFILE_CACHE_KEY]: entry(1, LIVE) })
    await expect(resolveProfile(down, storage)).resolves.toEqual({ profile: LIVE, source: 'cached' })
  })

  it('falls back to the default persona with nothing cached, or no storage at all', async () => {
    await expect(resolveProfile(down, memoryStorage())).resolves.toEqual({ profile: DEFAULT_PERSONA, source: 'default' })
    await expect(resolveProfile(down, null)).resolves.toEqual({ profile: DEFAULT_PERSONA, source: 'default' })
  })

  it('treats a 404 (profile not seeded) like an outage', async () => {
    const notSeeded = () => Promise.reject(new Error('404'))
    await expect(resolveProfile(notSeeded, memoryStorage())).resolves.toMatchObject({ source: 'default' })
  })

  it('still returns live data when the cache write throws', async () => {
    const storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    }
    await expect(resolveProfile(async () => LIVE, storage)).resolves.toMatchObject({ source: 'live' })
  })
})

describe('readCachedProfile', () => {
  it('drops a cache from another schema version', () => {
    const storage = memoryStorage({ [PROFILE_CACHE_KEY]: entry(2, LIVE) })
    expect(readCachedProfile(storage)).toBeNull()
    expect(storage.map.has(PROFILE_CACHE_KEY)).toBe(false)
  })

  it('ignores unparseable or malformed entries', () => {
    expect(readCachedProfile(memoryStorage({ [PROFILE_CACHE_KEY]: '{not json' }))).toBeNull()
    expect(readCachedProfile(memoryStorage({ [PROFILE_CACHE_KEY]: entry(1, { full_name: 7 }) }))).toBeNull()
  })

  it('survives storage that throws on read', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {},
      removeItem: () => {},
    }
    expect(readCachedProfile(blocked)).toBeNull()
  })
})

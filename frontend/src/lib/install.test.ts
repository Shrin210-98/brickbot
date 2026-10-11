import { describe, expect, it } from 'vitest'
import { DISMISS_DAYS, dismissedRecently, isIosSafari } from './install'

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.0.0 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
}

describe('isIosSafari', () => {
  it('matches Safari on iPhone and iPad', () => {
    expect(isIosSafari(UA.iphoneSafari, 5)).toBe(true)
    expect(isIosSafari(UA.ipadSafari, 5)).toBe(true)
  })
  it('rejects other iOS browsers, desktop Safari and Android', () => {
    expect(isIosSafari(UA.iphoneChrome, 5)).toBe(false)
    expect(isIosSafari(UA.ipadSafari, 0)).toBe(false)
    expect(isIosSafari(UA.androidChrome, 5)).toBe(false)
  })
})

describe('dismissedRecently', () => {
  const now = Date.UTC(2026, 9, 11)
  const day = 24 * 60 * 60 * 1000
  it('is false when never dismissed or the value is junk', () => {
    expect(dismissedRecently(null, now)).toBe(false)
    expect(dismissedRecently('soon', now)).toBe(false)
  })
  it(`hides the affordance for ${DISMISS_DAYS} days`, () => {
    expect(dismissedRecently(String(now - day), now)).toBe(true)
    expect(dismissedRecently(String(now - (DISMISS_DAYS - 1) * day), now)).toBe(true)
    expect(dismissedRecently(String(now - DISMISS_DAYS * day), now)).toBe(false)
  })
})

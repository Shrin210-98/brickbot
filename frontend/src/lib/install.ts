export const DISMISS_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// Safari on iPhone/iPad. iPadOS reports itself as a Mac, so touch points tell
// them apart. Chrome, Firefox, Edge and Opera on iOS add their own tokens.
export function isIosSafari(ua: string, maxTouchPoints: number): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

// stored is the localStorage value: the dismissal time in ms, or null.
export function dismissedRecently(stored: string | null, now: number): boolean {
  if (stored === null) return false
  const at = Number(stored)
  return Number.isFinite(at) && now - at < DISMISS_DAYS * DAY_MS
}

import { useSyncExternalStore } from 'react'
import { dismissedRecently, isIosSafari } from '@/lib/install'

// Chrome/Android fires beforeinstallprompt; it isn't in the DOM typings.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'brickbot.install_dismissed_at'

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function readDismissed(): boolean {
  try {
    return dismissedRecently(localStorage.getItem(DISMISS_KEY), Date.now())
  } catch {
    return false
  }
}

// Module-level store: beforeinstallprompt can fire before React mounts the header.
let deferred: BeforeInstallPromptEvent | null = null
let installed = false
let dismissed = readDismissed()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // We show our own button instead of Chrome's mini-infobar.
  deferred = e as BeforeInstallPromptEvent
  emit()
})
window.addEventListener('appinstalled', () => {
  installed = true
  deferred = null
  emit()
})

function dismiss() {
  dismissed = true
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // Private mode: the affordance still hides for this page load.
  }
  emit()
}

// 'prompt': Chrome can show its install dialog. 'ios': Safari, where we can
// only explain Share → Add to Home Screen. null: nothing to offer.
export type InstallMode = 'prompt' | 'ios' | null

function snapshot(): InstallMode {
  if (installed || dismissed || isStandalone()) return null
  if (deferred) return 'prompt'
  return isIosSafari(navigator.userAgent, navigator.maxTouchPoints) ? 'ios' : null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallPrompt() {
  const mode = useSyncExternalStore(subscribe, snapshot)

  const install = async () => {
    const event = deferred
    if (!event) return
    deferred = null // A prompt event can be used once.
    await event.prompt()
    const { outcome } = await event.userChoice
    // Accepted: appinstalled hides it. Declined: don't ask again for a while.
    if (outcome === 'dismissed') dismiss()
    else emit()
  }

  return { mode, install, dismiss }
}

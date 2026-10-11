import { useState } from 'react'
import { Download, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

const IOS_HINT = "Add to Home Screen: tap Share, then 'Add to Home Screen'."

function IosHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Share className="mt-0.5 size-4 shrink-0" aria-hidden /> {IOS_HINT}
      </p>
      <Button variant="outline" className="h-11 self-start" onClick={onDismiss}>
        Got it
      </Button>
    </div>
  )
}

// Header icon from md up. Hidden when installed, unsupported, or dismissed in
// the last 30 days; it never opens anything by itself.
export function InstallAppIcon() {
  const { mode, install, dismiss } = useInstallPrompt()
  if (mode === null) return null

  const label = 'Install app'
  if (mode === 'prompt') {
    return (
      <Button variant="ghost" size="icon" className="hidden size-11 md:inline-flex" aria-label={label} title={label} onClick={install}>
        <Download />
      </Button>
    )
  }
  // iPad Safari: no prompt API, so explain the Share sheet instead.
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="hidden size-11 md:inline-flex" aria-label={label} title={label} />}
      >
        <Download />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <IosHint onDismiss={dismiss} />
      </PopoverContent>
    </Popover>
  )
}

// Text button at the bottom of the mobile Sheet menu.
export function InstallAppMenuItem() {
  const { mode, install, dismiss } = useInstallPrompt()
  const [hint, setHint] = useState(false)
  if (mode === null) return null

  return (
    <div className="flex flex-col gap-3 px-5">
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-11 flex-1"
          aria-expanded={mode === 'ios' ? hint : undefined}
          onClick={mode === 'prompt' ? install : () => setHint((h) => !h)}
        >
          <Download data-icon="inline-start" /> Install app
        </Button>
        {mode === 'prompt' && (
          <Button variant="ghost" className="h-11" onClick={dismiss}>
            Not now
          </Button>
        )}
      </div>
      {mode === 'ios' && hint && <IosHint onDismiss={dismiss} />}
    </div>
  )
}

import { useState } from 'react'
import { Download, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

// "Install app" at the bottom of the mobile Sheet menu. It's the only one:
// desktop browsers already offer install from the address bar. Hidden when
// installed, unsupported, or dismissed in the last 30 days.
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

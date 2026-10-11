import { useEffect } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiErrorMessage } from '@/lib/error-copy'
import { cn } from '@/lib/utils'

interface ApiErrorStateProps {
  error: unknown
  onRetry?: () => void
  title?: string
  // One inline row, smaller icon, no title.
  compact?: boolean
  className?: string
}

// The friendly face of a failed API call: copy from apiErrorMessage, plus a
// "Try again" button when the caller can refetch. The raw error goes to the
// console in dev only.
export function ApiErrorState({ error, onRetry, title = 'Something went wrong', compact = false, className }: ApiErrorStateProps) {
  useEffect(() => {
    if (import.meta.env.DEV) console.error(error)
  }, [error])

  const message = apiErrorMessage(error)
  const retry = onRetry && (
    <Button variant="default" className={compact ? 'h-11 md:h-8' : 'h-11 px-6'} onClick={() => onRetry()}>
      <RotateCcw data-icon="inline-start" /> Try again
    </Button>
  )

  if (compact) {
    return (
      <div role="alert" className={cn('flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3', className)}>
        <AlertCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="flex-1 text-sm text-muted-foreground">{message}</p>
        {retry}
      </div>
    )
  }

  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center', className)}>
      <AlertCircle className="size-10 text-muted-foreground" aria-hidden />
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <p className="max-w-sm text-muted-foreground">{message}</p>
      {retry}
    </div>
  )
}

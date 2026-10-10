import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/hooks/useChat'
import { ListingCards } from './ListingCards'
import { MessageBubble } from './MessageBubble'

const SUGGESTIONS = ['Flats in Bandra West', '2BHK under 3cr', 'Rentals in Khar']

// Within this many pixels of the bottom counts as following the conversation.
const STICK_PX = 80

export function MessageList({
  messages,
  streaming,
  restoring,
  onNavigate,
  onSuggest,
}: {
  messages: ChatMessage[]
  streaming: boolean
  restoring: boolean
  onNavigate: () => void
  onSuggest: (text: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const lastTop = useRef(0)
  const count = useRef(messages.length)

  // Keep the newest content in view, unless the visitor scrolled up to read.
  // New messages glide in; streamed text jumps, since smooth scrolling on every
  // delta stutters. Reduced motion always jumps.
  useEffect(() => {
    const el = ref.current
    const added = messages.length !== count.current
    count.current = messages.length
    if (!el || !(following.current || added)) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: el.scrollHeight, behavior: added && !reduce ? 'smooth' : 'auto' })
    following.current = true
  }, [messages])

  return (
    <div
      ref={ref}
      role="log"
      aria-label="Conversation"
      aria-busy={streaming}
      tabIndex={0}
      onScroll={(e) => {
        // Only an upward scroll stops following, so our own smooth scroll down never does.
        const el = e.currentTarget
        if (el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX) following.current = true
        else if (el.scrollTop < lastTop.current) following.current = false
        lastTop.current = el.scrollTop
      }}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
    >
      {messages.length === 0 ? (
        restoring ? (
          <p className="m-auto text-sm text-muted-foreground">Loading your conversation…</p>
        ) : (
          <div className="m-auto flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">Try asking:</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <Button variant="outline" size="sm" className="rounded-full" disabled={streaming} onClick={() => onSuggest(s)}>
                    {s}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        messages.map((m, i) => (
          <div key={m.id} className="flex flex-col gap-2">
            {m.history && i === 0 && <p className="text-center text-xs text-muted-foreground">Earlier conversation</p>}
            <MessageBubble message={m} />
            {m.listings && m.listings.length > 0 && <ListingCards listings={m.listings} onNavigate={onNavigate} />}
            {m.history && messages[i + 1] && !messages[i + 1].history && <hr className="mt-1 border-dashed" />}
          </div>
        ))
      )}
    </div>
  )
}

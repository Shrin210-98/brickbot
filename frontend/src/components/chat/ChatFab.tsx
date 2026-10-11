import { useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { CHAT_PANEL_ID, ChatPanel } from './ChatPanel'

// Floating chat launcher, the only floating button: WhatsApp lives in the
// header and the chat panel (docs/design.md, Mobile & PWA). It owns the
// conversation, so closing the panel or following a listing card keeps it.
// Below lg it sits above a page's fixed bottom bar ([data-bottom-bar]) and
// clear of the iOS home indicator.
export function ChatFab() {
  const [open, setOpen] = useState(false)
  const fab = useRef<HTMLButtonElement>(null)
  const chat = useChat()

  return (
    <>
      <ChatPanel open={open} onOpenChange={setOpen} chat={chat} returnFocus={fab} />
      <button
        ref={fab}
        type="button"
        aria-label={open ? 'Close chat' : 'Open chat'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? CHAT_PANEL_ID : undefined}
        onClick={() => setOpen((o) => !o)}
        className="fixed right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 max-lg:[body:has([data-bottom-bar])_&]:bottom-[calc(5.25rem+env(safe-area-inset-bottom))] flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        <MessageSquare className="size-6" />
      </button>
    </>
  )
}

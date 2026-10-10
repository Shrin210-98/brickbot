import { useState } from 'react'
import { MessageSquare } from 'lucide-react'

// Floating chat launcher. The panel is a placeholder until the chatbot is wired up.
export function ChatFab() {
  const [open, setOpen] = useState(false)
  return (
    <>
      {open && (
        <div
          id="chat-panel"
          className="fixed right-4 bottom-22 z-40 rounded-xl border bg-card px-5 py-4 text-sm text-card-foreground shadow-lg"
        >
          Chat coming soon
        </div>
      )}
      <button
        type="button"
        aria-label="Open chat"
        aria-expanded={open}
        aria-controls="chat-panel"
        onClick={() => setOpen((o) => !o)}
        className="fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MessageSquare className="size-6" />
      </button>
    </>
  )
}

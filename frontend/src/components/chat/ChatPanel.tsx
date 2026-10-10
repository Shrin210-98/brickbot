import { useRef, type RefObject } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UseChat } from '@/hooks/useChat'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'

export const CHAT_PANEL_ID = 'chat-panel'

// The chat window: full screen on phones, a panel above the launcher from sm
// up. A modal dialog, so focus is trapped, Escape and outside clicks close it,
// and focus returns to returnFocus (the launcher). The conversation lives in
// chat, owned by ChatFab, so it survives closing the panel and navigating.
export function ChatPanel({
  open,
  onOpenChange,
  chat,
  returnFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chat: UseChat
  returnFocus: RefObject<HTMLElement | null>
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  const streaming = chat.status === 'streaming'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Popup
          id={CHAT_PANEL_ID}
          initialFocus={input}
          finalFocus={returnFocus}
          className="fixed inset-0 z-50 flex flex-col bg-background text-foreground shadow-xl transition duration-200 ease-out data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0 motion-reduce:transition-none sm:inset-auto sm:right-4 sm:bottom-22 sm:h-[min(40rem,calc(100dvh-7rem))] sm:w-[25rem] sm:overflow-hidden sm:rounded-xl sm:border"
        >
          <header className="flex items-center justify-between gap-2 border-b py-3 pr-2 pl-4">
            <Dialog.Title className="font-display text-lg font-semibold">Chat with BrickBot</Dialog.Title>
            <Dialog.Close render={<Button variant="ghost" size="icon" aria-label="Close chat" />}>
              <XIcon />
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">
            Ask about listings. Replies come from the salesman's current listings.
          </Dialog.Description>

          <MessageList messages={chat.messages} streaming={streaming} onNavigate={() => onOpenChange(false)} />

          {chat.status === 'error' && chat.error && (
            <p role="alert" className="border-t px-4 py-2 text-sm text-destructive">
              {chat.error}
            </p>
          )}
          <ChatInput inputRef={input} streaming={streaming} onSend={(text) => void chat.send(text)} onStop={chat.reset} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

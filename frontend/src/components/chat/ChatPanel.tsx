import { useRef, useState, type RefObject } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { MessageCircle, RotateCcw, Trash2, XIcon } from 'lucide-react'
import { useProfile } from '@/api/profile'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { UseChat } from '@/hooks/useChat'
import { whatsappLink } from '@/lib/whatsapp'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'

export const CHAT_PANEL_ID = 'chat-panel'

// The chat window: full screen on phones, a panel above the launcher from sm
// up. Its header links to WhatsApp, so the launcher is the only floating button. A modal dialog, so focus is trapped, Escape and outside clicks close it,
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
  const { data: profile } = useProfile()
  const whatsapp = profile ? whatsappLink(profile.whatsapp_number) : null
  const streaming = chat.status === 'streaming'
  const [confirming, setConfirming] = useState(false)
  // Set on confirm: the Clear button is then disabled, so focus goes to the textarea.
  const cleared = useRef(false)
  // Mid-reply, Stop is the action; clearing waits until the reply ends.
  const canClear = chat.hasMessages && !streaming
  const last = chat.messages.at(-1)
  // Retry only when the visitor's message got no reply at all.
  const canRetry = chat.status === 'error' && last?.role === 'user'
  // Chips and Retry disappear once used; hand focus back to the textarea.
  const sendAndFocus = (send: () => Promise<void>) => {
    void send()
    input.current?.focus()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Popup
          id={CHAT_PANEL_ID}
          initialFocus={input}
          finalFocus={returnFocus}
          className="fixed inset-0 z-50 flex flex-col bg-background text-foreground shadow-xl transition duration-200 ease-out data-ending-style:translate-y-4 data-ending-style:opacity-0 data-starting-style:translate-y-4 data-starting-style:opacity-0 motion-reduce:transition-none max-sm:pt-[env(safe-area-inset-top)] sm:inset-auto sm:right-4 sm:bottom-22 sm:h-[min(40rem,calc(100dvh-7rem))] sm:w-[25rem] sm:overflow-hidden sm:rounded-xl sm:border"
        >
          <header className="flex items-center justify-between gap-2 border-b py-3 pr-2 pl-4">
            {/* TODO: a "Demo" pill once an /api/chat/info endpoint reports demo mode. */}
            <Dialog.Title className="font-display text-lg font-semibold">Chat with BrickBot</Dialog.Title>
            <div className="flex items-center gap-1">
              {whatsapp && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Chat on WhatsApp instead"
                  title="Chat on WhatsApp instead"
                  className="size-11 text-[#25D366] hover:text-[#1ebe5b] sm:size-8"
                  nativeButton={false}
                  render={<a href={whatsapp} target="_blank" rel="noopener noreferrer" />}
                >
                  <MessageCircle />
                </Button>
              )}
              <AlertDialog
                open={confirming}
                onOpenChange={(next) => {
                  if (next && !canClear) return
                  if (next) cleared.current = false
                  setConfirming(next)
                }}
              >
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Clear conversation"
                      title="Clear conversation"
                      disabled={!canClear}
                      className="size-11 text-muted-foreground sm:size-8"
                    />
                  }
                >
                  <Trash2 />
                </AlertDialogTrigger>
                <AlertDialogContent finalFocus={() => (cleared.current ? input.current : true)}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear this conversation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your messages will be removed from this browser. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => {
                        chat.reset()
                        cleared.current = true
                        setConfirming(false)
                      }}
                    >
                      Clear
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Dialog.Close render={<Button variant="ghost" size="icon" className="size-11 sm:size-8" aria-label="Close chat" />}>
                <XIcon />
              </Dialog.Close>
            </div>
          </header>
          <Dialog.Description className="sr-only">
            Ask about listings. Replies come from the salesman's current listings.
          </Dialog.Description>

          <MessageList
            messages={chat.messages}
            streaming={streaming}
            restoring={chat.restoring}
            onNavigate={() => onOpenChange(false)}
            onSuggest={(text) => sendAndFocus(() => chat.send(text))}
          />

          {chat.status === 'error' && chat.error && (
            <div className="flex items-center justify-between gap-3 border-t px-4 py-2">
              <p role="alert" className="text-sm text-destructive">
                {chat.error}
              </p>
              {canRetry && (
                <Button variant="outline" size="sm" onClick={() => sendAndFocus(chat.retry)}>
                  <RotateCcw data-icon="inline-start" /> Retry
                </Button>
              )}
            </div>
          )}
          <ChatInput inputRef={input} streaming={streaming} onSend={(text) => void chat.send(text)} onStop={chat.abort} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

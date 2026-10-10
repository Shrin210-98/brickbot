import { useRef, useState, type RefObject } from 'react'
import { SendHorizontal, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Matches the server's limit on `content` (docs/api.md).
const MAX_LENGTH = 2000
// About four rows of text-sm before the textarea scrolls.
const MAX_HEIGHT_PX = 112

export function ChatInput({
  streaming,
  onSend,
  onStop,
  inputRef,
}: {
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
  inputRef?: RefObject<HTMLTextAreaElement | null>
}) {
  const [value, setValue] = useState('')
  const local = useRef<HTMLTextAreaElement>(null)
  const box = inputRef ?? local

  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }

  const submit = () => {
    const text = value.trim()
    if (streaming || text === '') return
    onSend(text)
    setValue('')
    if (box.current) box.current.style.height = 'auto'
    // Send swaps to Stop (and back); keep focus in the textarea, not on a vanished button.
    box.current?.focus()
  }

  return (
    <form
      className="flex items-end gap-2 border-t p-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <textarea
        id="chat-input"
        ref={box}
        rows={1}
        value={value}
        maxLength={MAX_LENGTH}
        // Read-only rather than disabled while a reply streams, so focus stays here.
        readOnly={streaming}
        aria-describedby="chat-input-hint"
        placeholder={streaming ? 'BrickBot is replying…' : 'Ask about a flat…'}
        onChange={(e) => {
          setValue(e.target.value)
          resize(e.target)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        className={cn(
          'min-h-9 flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          streaming && 'text-muted-foreground',
        )}
      />
      <span id="chat-input-hint" className="sr-only">
        Enter sends, Shift+Enter adds a new line.
      </span>
      {streaming ? (
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Stop the reply"
          onClick={() => {
            onStop()
            box.current?.focus()
          }}
        >
          <Square className="fill-current" />
        </Button>
      ) : (
        <Button type="submit" size="icon-lg" aria-label="Send message" disabled={value.trim() === ''}>
          <SendHorizontal />
        </Button>
      )}
    </form>
  )
}

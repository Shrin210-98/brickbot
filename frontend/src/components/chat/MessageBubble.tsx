import { useState } from 'react'
import { CircleCheck, Loader2 } from 'lucide-react'
import { useProfile } from '@/api/profile'
import type { ChatMessage } from '@/hooks/useChat'
import { cn } from '@/lib/utils'
import type { ChatToolName } from '@/types/api'

const TOOL_HINTS: Record<ChatToolName, string> = {
  search_listings: 'Searching listings…',
  get_listing: 'Looking up details…',
  create_lead: 'Sharing your details…',
}

// Staggered so the typing dots bounce in turn.
const DOT_DELAYS = ['[animation-delay:0ms]', '[animation-delay:150ms]', '[animation-delay:300ms]']

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { data: profile } = useProfile()
  const agent = profile?.full_name.split(' ')[0] || 'the agent'
  const isUser = message.role === 'user'
  // A tool counts as running from its `tool` event until the reply's text grows
  // again: the model only writes once it has read the tool result. Remember the
  // text length when each tool started (state updated during render).
  const [mark, setMark] = useState({ tool: message.tool, len: message.text.length })
  if (mark.tool !== message.tool) setMark({ tool: message.tool, len: message.text.length })
  const running = Boolean(message.pending && message.tool) && message.text.length === mark.len
  // Dots stand in for text until the first delta, unless a tool hint says more.
  const typing = message.pending && message.text === '' && !running

  return (
    <div className={cn('flex max-w-[85%] flex-col gap-1', isUser ? 'items-end self-end' : 'items-start self-start')}>
      {(message.text !== '' || typing) && (
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap',
            isUser ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground',
          )}
        >
          {typing ? (
            <span className="flex h-5 items-center gap-1" role="status" aria-label="BrickBot is typing">
              {DOT_DELAYS.map((delay) => (
                <span
                  key={delay}
                  className={cn('size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none', delay)}
                />
              ))}
            </span>
          ) : (
            <>
              {message.text}
              {message.pending && (
                <span
                  aria-hidden
                  className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-current motion-reduce:animate-none"
                />
              )}
            </>
          )}
        </div>
      )}
      {running && message.tool && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
          {TOOL_HINTS[message.tool]}
        </p>
      )}
      {message.leadCreated && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <CircleCheck className="size-3.5" aria-hidden />
          Details shared with {agent}.
        </p>
      )}
    </div>
  )
}

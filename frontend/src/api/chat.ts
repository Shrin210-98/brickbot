import { skipToken, useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch, apiPost } from '@/lib/api'
import { streamSSE } from '@/lib/sse'
import type { ChatMessageCreate, ChatSession, ChatSessionCreate, ChatStreamEvent, ChatTranscript } from '@/types/api'

const messagesPath = (sessionId: string) => `/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`

export function createChatSession(visitorId: string): Promise<ChatSession> {
  return apiPost<ChatSession>('/api/chat/sessions', { visitor_id: visitorId } satisfies ChatSessionCreate)
}

export function useCreateChatSession() {
  return useMutation({ mutationFn: createChatSession })
}

export function useChatTranscript(sessionId: string | null, visitorId: string) {
  return useQuery({
    queryKey: ['chat', 'transcript', sessionId, visitorId],
    queryFn:
      sessionId === null
        ? skipToken
        : async ({ signal }) => {
            const params = new URLSearchParams({ visitor_id: visitorId })
            const res = await apiFetch<ChatTranscript>(`${messagesPath(sessionId)}?${params}`, { signal })
            return res.items
          },
  })
}

// Sends a visitor message and streams the reply (docs/chatbot.md → SSE contract).
// Rejects like streamSSE; an `error` event is delivered to onEvent, not thrown.
export function streamChatMessage(
  sessionId: string,
  body: ChatMessageCreate,
  onEvent: (e: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamSSE<ChatStreamEvent['data']>(messagesPath(sessionId), body, {
    onEvent: (event, data) => onEvent({ event, data } as ChatStreamEvent),
    signal,
  })
}

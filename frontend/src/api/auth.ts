import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch, apiPost } from '@/lib/api'
import type { LoginRequest, Me } from '@/types/api'

const ME_KEY = ['auth', 'me']

// Resolves to null when there is no valid session cookie (401).
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await apiFetch<Me>('/api/auth/me', { signal })
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginRequest) => apiPost<void>('/api/auth/login', body),
    // Awaited so the guard sees the new session before the caller navigates.
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_KEY }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<void>('/api/auth/logout'),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['admin'] })
      qc.setQueryData(ME_KEY, null)
    },
  })
}

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/lib/api'

// The API sends fragments keyed by JSON name ("phone": "must be a valid phone number").
// Prefix the humanised field name so the message reads on its own.
function fieldMessage(field: string, fragment: string): string {
  const label = field.replaceAll('_', ' ')
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${fragment}`
}

// Copies a 422's per-field errors onto the form fields it knows about.
// Returns false when nothing was applied, so the caller can show a general error.
export function applyFieldErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  known: readonly Path<T>[],
): boolean {
  if (!(err instanceof ApiError) || err.status !== 422 || !err.fields) return false
  let applied = false
  for (const [field, fragment] of Object.entries(err.fields)) {
    if (!(known as readonly string[]).includes(field)) continue
    setError(field as Path<T>, { type: 'server', message: fieldMessage(field, fragment) })
    applied = true
  }
  return applied
}

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { toApiError } from '@/api/errors'

/**
 * Maps API validation errors (ApiError.fields) onto form fields and focuses the first one.
 * Returns the general message when no field matches, so the form can show it on top.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  known: ReadonlyArray<Path<T>>,
): string | null {
  const apiError = toApiError(error)
  let matched = false
  for (const [field, message] of Object.entries(apiError.fields)) {
    if ((known as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message }, { shouldFocus: !matched })
      matched = true
    }
  }
  return matched ? null : apiError.message
}

/** Only internal paths are accepted as post-login destination (prevents open redirect). */
export function safeRedirect(target: string | undefined, fallback = '/') {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return fallback
  if (target.startsWith('/entrar') || target.startsWith('/cadastro')) return fallback
  return target
}

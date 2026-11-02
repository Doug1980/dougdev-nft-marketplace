import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import type { LoginInput, RegisterInput, Session } from '@/api/contracts'
import { authApi, cartApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { announce } from '@/lib/announcer'
import { qk } from '@/lib/query'
import { sessionStore } from '@/lib/session-store'

/** Drops every private, cart and quote entry (logout, expiry, user switch). */
export function clearPrivateCache(qc: QueryClient) {
  qc.removeQueries({ queryKey: qk.privateAll })
  qc.removeQueries({ queryKey: qk.cartAll })
  qc.removeQueries({ queryKey: qk.quoteAll })
}

async function establishSession(qc: QueryClient, session: Session) {
  const previousUserId = sessionStore.userId()
  if (previousUserId && previousUserId !== session.user.id) clearPrivateCache(qc)

  // Guest items move into the account cart. The merge runs with the new token *before* the session switch,
  // so the account cart query starts with the merged cart and no stale GET can overwrite it.
  const guestCartId = sessionStore.guestCartId()
  let merged = false
  try {
    qc.setQueryData(qk.cart(`user:${session.user.id}`), await cartApi.merge(guestCartId, session.token))
    merged = true
  } catch {
    // Cart reloads normally; the guest id is kept for a later merge.
  }

  sessionStore.set(session)
  if (merged) {
    sessionStore.setGuestCartId(null)
    qc.removeQueries({ queryKey: qk.cart('guest') })
  }
  announce(`Você entrou como ${session.user.displayName}.`)
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (session) => establishSession(qc, session),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: (session) => establishSession(qc, session),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout()
      } catch {
        // Local logout happens even if the API call fails.
      }
    },
    onSettled: () => {
      sessionStore.clear('logout')
      clearPrivateCache(qc)
      announce('Você saiu da sua conta.')
    },
  })
}

/** Revalidates a persisted session on boot. Transient failures keep the local session. */
export async function restoreSession() {
  if (!sessionStore.token()) return
  try {
    const info = await authApi.session()
    sessionStore.updateUser(info.user)
  } catch (error) {
    if (toApiError(error).status === 401) sessionStore.clear('expired')
  }
}

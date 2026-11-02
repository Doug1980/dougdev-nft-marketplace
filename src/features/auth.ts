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

  const guestCartId = sessionStore.guestCartId()
  sessionStore.set(session)
  // Guest items move into the account cart.
  try {
    const merged = await cartApi.merge(guestCartId)
    sessionStore.setGuestCartId(null)
    qc.removeQueries({ queryKey: qk.cart('guest') })
    qc.setQueryData(qk.cart(`user:${session.user.id}`), merged)
  } catch {
    // Cart reloads normally; the guest id is kept for a later merge.
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

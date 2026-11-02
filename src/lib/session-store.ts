/**
 * Session source of truth outside React, shared by Axios, the socket and the router.
 * Persists only token, user and expiry; never the password.
 */
import { useSyncExternalStore } from 'react'
import type { Session, User } from '@/api/contracts'

export type SessionState =
  | { status: 'anonymous'; reason: 'expired' | 'logout' | null }
  | { status: 'authenticated'; token: string; user: User; expiresAt: string }

const SESSION_KEY = 'kurio:session'
const GUEST_CART_KEY = 'kurio:guest-cart'

function read(): SessionState {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return { status: 'anonymous', reason: null }
    const parsed = JSON.parse(raw) as Partial<Session>
    if (!parsed.token || !parsed.user || !parsed.expiresAt) return { status: 'anonymous', reason: null }
    return { status: 'authenticated', token: parsed.token, user: parsed.user, expiresAt: parsed.expiresAt }
  } catch {
    return { status: 'anonymous', reason: null }
  }
}

let state: SessionState = read()
const listeners = new Set<() => void>()
const emit = () => {
  for (const listener of listeners) listener()
}

function storage(action: () => void) {
  try {
    action()
  } catch {
    // Storage unavailable (private mode): state stays in memory.
  }
}

export const sessionStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  token: () => (state.status === 'authenticated' ? state.token : null),
  userId: () => (state.status === 'authenticated' ? state.user.id : null),

  set(session: Session) {
    state = { status: 'authenticated', token: session.token, user: session.user, expiresAt: session.expiresAt }
    storage(() => localStorage.setItem(SESSION_KEY, JSON.stringify(session)))
    emit()
  },
  updateUser(user: User) {
    if (state.status === 'authenticated') sessionStore.set({ token: state.token, expiresAt: state.expiresAt, user })
  },
  clear(reason: 'expired' | 'logout' | null) {
    if (state.status === 'anonymous' && state.reason === reason) return
    state = { status: 'anonymous', reason }
    storage(() => localStorage.removeItem(SESSION_KEY))
    emit()
  },

  guestCartId(): string | null {
    try {
      return localStorage.getItem(GUEST_CART_KEY)
    } catch {
      return null
    }
  },
  setGuestCartId(id: string | null) {
    storage(() => (id ? localStorage.setItem(GUEST_CART_KEY, id) : localStorage.removeItem(GUEST_CART_KEY)))
  },
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

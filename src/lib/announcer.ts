/** Global aria-live announcements for async feedback (mutations and realtime changes). */
import { useSyncExternalStore } from 'react'

type Announcement = { id: number; text: string; politeness: 'polite' | 'assertive' }

let current: Announcement = { id: 0, text: '', politeness: 'polite' }
const listeners = new Set<() => void>()

export function announce(text: string, politeness: Announcement['politeness'] = 'polite') {
  current = { id: current.id + 1, text, politeness }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAnnouncement() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  )
}

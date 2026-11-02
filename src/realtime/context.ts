import { createContext, useContext, useEffect } from 'react'
import type { RealtimeClient, RealtimeStatus } from './client'

export const RealtimeContext = createContext<{ client: RealtimeClient; status: RealtimeStatus } | null>(null)

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider')
  return ctx
}

/** Subscribes to the given NFTs for the component lifecycle. */
export function useNftSubscription(nftIds: string[]) {
  const { client } = useRealtime()
  const key = [...new Set(nftIds)].sort().join(',')
  useEffect(() => {
    if (!key) return
    return client.subscribe(key.split(','))
  }, [client, key])
}

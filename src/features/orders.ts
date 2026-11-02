import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { CreateOrderInput, Order } from '@/api/contracts'
import { orderApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { qk } from '@/lib/query'
import { useSession } from '@/lib/session-store'
import { useRealtime } from '@/realtime/context'

const MAX_ORDER_RETRIES = 3
const PENDING_POLL_MS = 5000

/**
 * Purchase attempt persisted per user: idempotency key + payload.
 * Repeated clicks, retries after timeout and page reloads reuse the same key and recover the same order.
 */
type OrderAttempt = { key: string; payloadHash: string; payload: CreateOrderInput; orderId: string | null }

const storageKey = (userId: string) => `kurio:order-attempt:${userId}`

export const orderAttempts = {
  load(userId: string): OrderAttempt | null {
    try {
      const raw = localStorage.getItem(storageKey(userId))
      return raw ? (JSON.parse(raw) as OrderAttempt) : null
    } catch {
      return null
    }
  },
  save(userId: string, attempt: OrderAttempt) {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(attempt))
    } catch {
      // Storage unavailable: idempotency still holds for in-memory retries.
    }
  },
  clear(userId: string) {
    try {
      localStorage.removeItem(storageKey(userId))
    } catch {
      // Ignore.
    }
  },
  /** Same payload reuses the stored key; a different payload is a new purchase with a new key. */
  forPayload(userId: string, payload: CreateOrderInput): OrderAttempt {
    const payloadHash = JSON.stringify([
      payload.quoteId,
      payload.quoteFingerprint,
      payload.walletId,
      payload.walletSessionId,
      payload.network,
      payload.buyer,
    ])
    const existing = orderAttempts.load(userId)
    if (existing?.payloadHash === payloadHash) return existing
    const attempt: OrderAttempt = { key: crypto.randomUUID(), payloadHash, payload, orderId: null }
    orderAttempts.save(userId, attempt)
    return attempt
  },
}

export function useSubmitOrder() {
  const qc = useQueryClient()
  const session = useSession()
  const userId = session.status === 'authenticated' ? session.user.id : null
  return useMutation({
    mutationFn: async (payload: CreateOrderInput) => {
      if (!userId) throw new Error('Authenticated session required')
      const attempt = orderAttempts.forPayload(userId, payload)
      const order = await orderApi.create(payload, attempt.key)
      orderAttempts.save(userId, { ...attempt, orderId: order.id })
      return order
    },
    // Safe to retry: the idempotency key guarantees the same order server-side.
    retry: (count, error) => {
      const apiError = toApiError(error)
      return (apiError.code === 'TIMEOUT' || apiError.code === 'NETWORK_ERROR' || apiError.status >= 500) && count < MAX_ORDER_RETRIES
    },
    retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 3000),
    onSuccess: (order) => {
      if (userId) qc.setQueryData(qk.order(userId, order.id), order)
    },
  })
}

/** Resumes an interrupted attempt (reload mid-submit): same payload, same key. */
export async function resumeAttempt(userId: string): Promise<Order | null> {
  const attempt = orderAttempts.load(userId)
  if (!attempt) return null
  if (attempt.orderId) return orderApi.get(attempt.orderId)
  const order = await orderApi.create(attempt.payload, attempt.key)
  orderAttempts.save(userId, { ...attempt, orderId: order.id })
  return order
}

export function useOrder(orderId: string) {
  const session = useSession()
  const userId = session.status === 'authenticated' ? session.user.id : null
  const { client } = useRealtime()
  const query = useQuery({
    queryKey: qk.order(userId ?? 'anonymous', orderId),
    queryFn: ({ signal }) => orderApi.get(orderId, { signal }),
    enabled: userId !== null,
    // Fallback while pending, in case the socket is down.
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? PENDING_POLL_MS : false),
  })

  const order = query.data
  useEffect(() => {
    if (!order) return
    client.observeVersion(`order:${order.id}`, order.version)
    if (order.status !== 'pending' && userId && orderAttempts.load(userId)?.orderId === order.id) orderAttempts.clear(userId)
  }, [client, order, userId])

  return query
}

export function usePendingOrders() {
  const session = useSession()
  const userId = session.status === 'authenticated' ? session.user.id : null
  return useQuery({
    queryKey: qk.pendingOrders(userId ?? 'anonymous'),
    queryFn: ({ signal }) => orderApi.listPending({ signal }),
    enabled: userId !== null,
    staleTime: 5_000,
  })
}

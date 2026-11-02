import { QueryClient } from '@tanstack/react-query'
import type { CatalogQuery, NetworkId } from '@/api/contracts'
import { toApiError } from '@/api/errors'

const MAX_RETRIES = 2

/**
 * Cache policy:
 *  - public data (catalog, detail): staleTime 30s, gcTime 5min; realtime events patch the cache in place;
 *  - private data: keyed by user (`['private', userId, ...]`) and removed on logout/user switch;
 *  - retries only for transient failures (network, timeout, 5xx) with exponential backoff; 4xx never retried;
 *  - mutations are not retried, except order creation (idempotent, see features/orders).
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          const apiError = toApiError(error)
          return apiError.isTransient && failureCount < MAX_RETRIES
        },
        retryDelay: (attempt) => Math.min(600 * 2 ** attempt, 4000),
      },
      mutations: { retry: false },
    },
  })
}

export type CartOwner = `user:${string}` | 'guest'

/** Query key factory. Every parameter that changes the response is part of the key. */
export const qk = {
  catalog: (query: CatalogQuery) => ['catalog', query] as const,
  catalogAll: ['catalog'] as const,
  nft: (idOrSlug: string) => ['nft', idOrSlug] as const,
  nftAll: ['nft'] as const,
  cart: (owner: CartOwner) => ['cart', owner] as const,
  cartAll: ['cart'] as const,
  quote: (owner: CartOwner, network: NetworkId, context: 'cart' | 'checkout') => ['quote', owner, network, context] as const,
  quoteAll: ['quote'] as const,
  privateAll: ['private'] as const,
  favorites: (userId: string) => ['private', userId, 'favorites'] as const,
  profile: (userId: string) => ['private', userId, 'profile'] as const,
  wallets: (userId: string) => ['private', userId, 'wallets'] as const,
  order: (userId: string, orderId: string) => ['private', userId, 'order', orderId] as const,
  pendingOrders: (userId: string) => ['private', userId, 'orders', 'pending'] as const,
}

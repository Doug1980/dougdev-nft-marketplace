/**
 * Typed transport. Every response is parsed against its contract before reaching the cache.
 * `signal` lets TanStack Query abort stale requests.
 */
import { type ZodType, z } from 'zod'
import {
  type AddCartItemInput,
  type CatalogQuery,
  type CreateOrderInput,
  cart,
  catalogPage,
  favorites,
  type LoginInput,
  type NetworkId,
  nftDetail,
  order,
  type PasswordChangeInput,
  type ProfileInput,
  quote,
  type RegisterInput,
  session,
  sessionInfo,
  user,
  type WalletInput,
  wallet,
  walletSession,
} from './contracts'
import { ApiError } from './errors'
import { http } from './http'

type Options = { signal?: AbortSignal }

function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  console.error('[contract]', result.error.issues)
  throw new ApiError({ status: 0, code: 'CONTRACT_ERROR', message: 'Resposta do servidor fora do contrato esperado.' })
}

/** Multi-value filters travel as comma-separated lists: ?categories=musica,fotografia */
export function catalogSearchParams(query: CatalogQuery) {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.tab && query.tab !== 'all') params.set('tab', query.tab)
  if (query.categories?.length) params.set('categories', query.categories.join(','))
  if (query.networks?.length) params.set('networks', query.networks.join(','))
  if (query.minPrice) params.set('minPrice', query.minPrice)
  if (query.maxPrice) params.set('maxPrice', query.maxPrice)
  if (query.sort) params.set('sort', query.sort)
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  return params
}

export const authApi = {
  login: async (input: LoginInput) => parse(session, (await http.post('/auth/login', input)).data),
  register: async (input: RegisterInput) => parse(session, (await http.post('/auth/register', input)).data),
  session: async (opts?: Options) => parse(sessionInfo, (await http.get('/auth/session', opts)).data),
  logout: async () => {
    await http.post('/auth/logout')
  },
}

export const nftApi = {
  list: async (query: CatalogQuery, opts?: Options) =>
    parse(catalogPage, (await http.get('/nfts', { params: catalogSearchParams(query), signal: opts?.signal })).data),
  detail: async (idOrSlug: string, opts?: Options) =>
    parse(nftDetail, (await http.get(`/nfts/${encodeURIComponent(idOrSlug)}`, opts)).data),
}

export const favoritesApi = {
  list: async (opts?: Options) => parse(favorites, (await http.get('/favorites', opts)).data),
  add: async (nftId: string) => parse(favorites, (await http.put(`/favorites/${encodeURIComponent(nftId)}`)).data),
  remove: async (nftId: string) => parse(favorites, (await http.delete(`/favorites/${encodeURIComponent(nftId)}`)).data),
}

export const cartApi = {
  get: async (opts?: Options) => parse(cart, (await http.get('/cart', opts)).data),
  add: async (input: AddCartItemInput) => parse(cart, (await http.post('/cart/items', input)).data),
  update: async (itemId: string, patch: { quantity?: number; acknowledgePrice?: boolean }) =>
    parse(cart, (await http.patch(`/cart/items/${itemId}`, patch)).data),
  remove: async (itemId: string) => parse(cart, (await http.delete(`/cart/items/${itemId}`)).data),
  applyCoupon: async (code: string) => parse(cart, (await http.put('/cart/coupon', { code })).data),
  removeCoupon: async () => parse(cart, (await http.delete('/cart/coupon')).data),
  merge: async (guestCartId: string | null) => parse(cart, (await http.post('/cart/merge', { guestCartId })).data),
}

export const quoteApi = {
  create: async (input: { network: NetworkId; context: 'cart' | 'checkout' }, opts?: Options) =>
    parse(quote, (await http.post('/quotes', input, opts)).data),
}

export const orderApi = {
  create: async (input: CreateOrderInput, idempotencyKey: string) =>
    parse(order, (await http.post('/orders', input, { headers: { 'Idempotency-Key': idempotencyKey } })).data),
  get: async (orderId: string, opts?: Options) => parse(order, (await http.get(`/orders/${encodeURIComponent(orderId)}`, opts)).data),
  listPending: async (opts?: Options) =>
    parse(z.object({ items: z.array(order) }), (await http.get('/orders', { params: { status: 'pending' }, signal: opts?.signal })).data)
      .items,
}

export const profileApi = {
  get: async (opts?: Options) => parse(user, (await http.get('/profile', opts)).data),
  update: async (input: ProfileInput) => parse(user, (await http.patch('/profile', input)).data),
  setAvatar: async (dataUrl: string) => parse(user, (await http.put('/profile/avatar', { dataUrl })).data),
  removeAvatar: async () => parse(user, (await http.delete('/profile/avatar')).data),
  changePassword: async (input: PasswordChangeInput) => {
    await http.post('/profile/password', input)
  },
}

export const walletApi = {
  list: async (opts?: Options) => parse(z.object({ items: z.array(wallet) }), (await http.get('/wallets', opts)).data).items,
  create: async (input: WalletInput) => parse(wallet, (await http.post('/wallets', input)).data),
  update: async (walletId: string, input: WalletInput) => parse(wallet, (await http.put(`/wallets/${walletId}`, input)).data),
  connect: async (walletId: string, network: NetworkId) =>
    parse(walletSession, (await http.post('/wallet-sessions', { walletId, network })).data),
  disconnect: async (sessionId: string) => {
    await http.delete(`/wallet-sessions/${sessionId}`)
  },
}

import { delay, HttpResponse } from 'msw'
import { z } from 'zod'
import { addCartItemInput, createOrderInput, networkId } from '@/api/contracts'
import { eth } from '@/lib/money'
import { COUPONS } from '../db/seed'
import { type DbCart, type DbOrder, db } from '../db/store'
import {
  computeQuote,
  fnv1a,
  orderLinesFrom,
  publicOrder,
  publicQuote,
  scheduleSettlement,
  settleOrder,
  toCart,
  updateEdition,
} from '../domain'
import { apiError, readAuth, readJson, requireAuth, route, validationError, zodFields } from '../http'
import { blockRealtime, dropAllConnections } from '../realtime'

const ORDER_SETTLE_MS = 3000
const FAST_ORDER_SETTLE_MS = 1200
const TIMEOUT_SCENARIO_DELAY_MS = 10_000

/** Authenticated users get their own cart; guests are identified by the X-Cart-Id header. */
function resolveCart(request: Request): { cart: DbCart; userId: string | null } | Response {
  const auth = readAuth(request)
  if (auth.kind === 'expired') return apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  if (auth.kind === 'ok') return { cart: db.cartForUser(auth.userId), userId: auth.userId }
  return { cart: db.guestCart(request.headers.get('x-cart-id')), userId: null }
}

function cartResponse(cart: DbCart, status = 200) {
  db.commit()
  return HttpResponse.json(toCart(cart), { status })
}

/** Max units per order line: limited by stock and by the edition's per-order cap. */
function limitFor(nftId: string, editionId: string) {
  const edition = db.nft(nftId)?.editions.find((e) => e.id === editionId)
  return edition ? Math.min(edition.available, edition.maxPerOrder) : 0
}

const patchItemInput = z.object({
  quantity: z.number().int().min(1, 'Quantidade mínima é 1').optional(),
  acknowledgePrice: z.boolean().optional(),
})

export const commerceHandlers = [
  // ---------- Favorites ----------
  route('get', '/favorites', ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    return HttpResponse.json({ nftIds: db.state.favorites[auth.userId] ?? [] })
  }),

  ...(['put', 'delete'] as const).map((method) =>
    route<{ nftId: string }>(method, '/favorites/:nftId', ({ request, params }) => {
      const auth = requireAuth(request)
      if (auth instanceof Response) return auth
      if (db.state.scenario === 'favorites-fail') return apiError(500, 'INTERNAL_ERROR', 'Não foi possível atualizar seus favoritos.')
      if (!db.nft(params.nftId)) return apiError(404, 'NOT_FOUND', 'NFT não encontrado.')
      const ids = new Set(db.state.favorites[auth.userId] ?? [])
      if (method === 'put') ids.add(params.nftId)
      else ids.delete(params.nftId)
      db.state.favorites[auth.userId] = [...ids]
      db.commit()
      return HttpResponse.json({ nftIds: [...ids] })
    }),
  ),

  // ---------- Cart ----------
  route('get', '/cart', ({ request }) => {
    const resolved = resolveCart(request)
    if (resolved instanceof Response) return resolved
    return cartResponse(resolved.cart)
  }),

  route('post', '/cart/items', async ({ request }) => {
    const resolved = resolveCart(request)
    if (resolved instanceof Response) return resolved
    const parsed = addCartItemInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))

    const { nftId, editionId, quantity } = parsed.data
    const nft = db.nft(nftId)
    const edition = nft?.editions.find((e) => e.id === editionId)
    if (!nft || !edition) return apiError(404, 'NOT_FOUND', 'NFT ou edição não encontrados.')
    if (edition.available === 0) return apiError(409, 'EDITION_UNAVAILABLE', `A edição ${edition.label} está esgotada.`)

    const { cart } = resolved
    const existing = cart.items.find((i) => i.nftId === nft.id && i.editionId === editionId)
    const next = (existing?.quantity ?? 0) + quantity
    const limit = limitFor(nft.id, editionId)
    if (next > limit) {
      return apiError(409, 'AVAILABILITY_CONFLICT', `Limite de ${limit} unidade(s) para a edição ${edition.label}.`, {
        details: { max: limit, inCart: existing?.quantity ?? 0 },
      })
    }
    if (existing) existing.quantity = next
    else cart.items.push({ id: db.nextId('ci'), nftId: nft.id, editionId, quantity, addedPrice: edition.price })
    cart.version += 1
    return cartResponse(cart, 201)
  }),

  route<{ itemId: string }>('patch', '/cart/items/:itemId', async ({ request, params }) => {
    const resolved = resolveCart(request)
    if (resolved instanceof Response) return resolved
    const parsed = patchItemInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))

    const { cart } = resolved
    const item = cart.items.find((i) => i.id === params.itemId)
    if (!item) return apiError(404, 'NOT_FOUND', 'Item não está mais no carrinho.')
    if (parsed.data.quantity !== undefined) {
      const limit = limitFor(item.nftId, item.editionId)
      if (parsed.data.quantity > limit) {
        return apiError(409, 'AVAILABILITY_CONFLICT', `Disponível: até ${limit} unidade(s).`, {
          details: { max: limit, inCart: item.quantity },
        })
      }
      item.quantity = parsed.data.quantity
    }
    if (parsed.data.acknowledgePrice) {
      const edition = db.nft(item.nftId)?.editions.find((e) => e.id === item.editionId)
      if (edition) item.addedPrice = edition.price
    }
    cart.version += 1
    return cartResponse(cart)
  }),

  route<{ itemId: string }>('delete', '/cart/items/:itemId', ({ request, params }) => {
    const resolved = resolveCart(request)
    if (resolved instanceof Response) return resolved
    const { cart } = resolved
    cart.items = cart.items.filter((i) => i.id !== params.itemId)
    if (!cart.items.length) cart.couponCode = null
    cart.version += 1
    return cartResponse(cart)
  }),

  route('put', '/cart/coupon', async ({ request }) => {
    const resolved = resolveCart(request)
    if (resolved instanceof Response) return resolved
    const code = (await readJson<{ code?: string }>(request))?.code?.trim().toUpperCase() ?? ''
    if (!code) return validationError({ code: 'Informe um código promocional.' })

    const coupon = COUPONS[code]
    if (!coupon)
      return apiError(422, 'COUPON_INVALID', 'Código promocional inválido.', { fields: { code: 'Código promocional inválido.' } })
    if (coupon.expired)
      return apiError(422, 'COUPON_EXPIRED', 'Este código promocional expirou.', { fields: { code: 'Este código promocional expirou.' } })

    const { cart } = resolved
    if (!cart.items.length) return validationError({ code: 'Adicione itens antes de aplicar um cupom.' })
    cart.couponCode = code
    cart.version += 1
    return cartResponse(cart)
  }),

  route('delete', '/cart/coupon', ({ request }) => {
    const resolved = resolveCart(request)
    if (resolved instanceof Response) return resolved
    resolved.cart.couponCode = null
    resolved.cart.version += 1
    return cartResponse(resolved.cart)
  }),

  /** On sign-in, guest items move into the user's cart, respecting edition limits. */
  route('post', '/cart/merge', async ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const guestCartId = (await readJson<{ guestCartId?: string }>(request))?.guestCartId
    const userCart = db.cartForUser(auth.userId)
    const guest = guestCartId ? db.state.carts.find((c) => c.id === guestCartId && c.ownerId === null) : undefined

    if (guest) {
      for (const guestItem of guest.items) {
        const limit = limitFor(guestItem.nftId, guestItem.editionId)
        const existing = userCart.items.find((i) => i.nftId === guestItem.nftId && i.editionId === guestItem.editionId)
        if (existing) existing.quantity = Math.min(limit, existing.quantity + guestItem.quantity)
        else if (limit > 0) userCart.items.push({ ...guestItem, id: db.nextId('ci'), quantity: Math.min(limit, guestItem.quantity) })
      }
      userCart.couponCode ??= guest.couponCode
      db.state.carts = db.state.carts.filter((c) => c.id !== guest.id)
      userCart.version += 1
    }
    return cartResponse(userCart)
  }),

  // ---------- Quote ----------
  route('post', '/quotes', async ({ request }) => {
    const resolved = resolveCart(request)
    if (resolved instanceof Response) return resolved
    const body = await readJson<{ network?: string; context?: string }>(request)
    const network = networkId.safeParse(body?.network ?? 'ethereum')
    if (!network.success) return validationError({ network: 'Rede inválida.' })

    const { cart, userId } = resolved
    const quote = computeQuote(cart, network.data, userId)
    db.commit()

    // One-shot business scenarios fired when the checkout opens.
    const scenario = db.state.scenario
    const first = cart.items[0]
    const triggerKey = `checkout-change:${cart.id}`
    if (
      body?.context === 'checkout' &&
      first &&
      (scenario === 'price-change' || scenario === 'sold-out') &&
      !db.state.triggered.includes(triggerKey)
    ) {
      db.state.triggered.push(triggerKey)
      db.commit()
      setTimeout(() => {
        const edition = db.nft(first.nftId)?.editions.find((e) => e.id === first.editionId)
        if (!edition) return
        if (scenario === 'price-change') updateEdition(first.nftId, first.editionId, { price: eth.add(edition.price, '0.12') })
        else updateEdition(first.nftId, first.editionId, { available: 0 })
      }, 1200)
    }
    return HttpResponse.json(publicQuote(quote))
  }),

  // ---------- Orders ----------
  route('post', '/orders', async ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const key = request.headers.get('idempotency-key')
    if (!key || key.length < 8) return validationError({ idempotencyKey: 'Cabeçalho Idempotency-Key obrigatório.' })

    const parsed = createOrderInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))
    const input = parsed.data
    const payloadHash = fnv1a(JSON.stringify(input))

    // Same key + same payload -> same order. Same key + different payload -> conflict.
    const existing = db.state.orders.find((o) => o.userId === auth.userId && o.idempotencyKey === key)
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta tentativa de compra já foi usada com outro conteúdo.')
      if (existing.status === 'pending' && existing.settleAt <= Date.now()) settleOrder(existing.id)
      return HttpResponse.json(publicOrder(existing))
    }

    const wallet = db.state.wallets.find((w) => w.id === input.walletId && w.userId === auth.userId)
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    const walletSession = db.state.walletSessions.find((s) => s.id === input.walletSessionId && s.userId === auth.userId)
    if (!walletSession?.active || walletSession.walletId !== wallet.id) {
      return apiError(403, 'FORBIDDEN', 'A carteira foi desconectada. Conecte-a novamente para confirmar.')
    }

    // Revalidate price, availability, coupon and fees against the quote the user reviewed.
    const cart = db.cartForUser(auth.userId)
    const fresh = computeQuote(cart, input.network, auth.userId)
    db.commit()
    if (!fresh.lines.length) return validationError({ cart: 'Seu carrinho está vazio.' }, 'Seu carrinho está vazio.')
    if (fresh.fingerprint !== input.quoteFingerprint || fresh.issues.length) {
      return apiError(409, 'QUOTE_STALE', 'Os valores mudaram desde a sua revisão. Confira e confirme novamente.', {
        details: { quote: publicQuote(fresh) },
      })
    }
    if (fresh.coupon && fresh.coupon.status !== 'applied') {
      return apiError(
        422,
        fresh.coupon.status === 'expired' ? 'COUPON_EXPIRED' : 'COUPON_INVALID',
        'Remova o cupom inválido para continuar.',
      )
    }

    const scenario = db.state.scenario
    const now = Date.now()
    const order: DbOrder = {
      id: db.nextId('ord'),
      userId: auth.userId,
      status: 'pending',
      version: 1,
      idempotencyKey: key,
      lines: orderLinesFrom(fresh),
      subtotal: fresh.subtotal,
      discount: fresh.discount,
      networkFee: fresh.networkFee,
      total: fresh.total,
      couponCode: fresh.coupon?.code ?? null,
      network: input.network,
      wallet: { id: wallet.id, label: wallet.nickname, address: wallet.address, walletType: wallet.walletType },
      txHash: null,
      explorerUrl: null,
      rejectionReason: null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      payloadHash,
      quoteId: fresh.id,
      settleAt: now + (scenario === 'fast' ? FAST_ORDER_SETTLE_MS : ORDER_SETTLE_MS),
      outcome: scenario === 'payment-declined' ? 'rejected' : 'confirmed',
      cartId: cart.id,
    }
    db.state.orders.push(order)
    db.commit()
    scheduleSettlement(order)

    if (scenario === 'socket-drop') {
      // Keep the socket down until after settlement so the client must reconcile via REST.
      blockRealtime(order.settleAt - now + 2500)
      dropAllConnections()
    }
    if (scenario === 'order-timeout') {
      // The order already exists; the response arrives after the client timeout (8s).
      await delay(TIMEOUT_SCENARIO_DELAY_MS)
    }
    return HttpResponse.json(publicOrder(order), { status: 201 })
  }),

  route('get', '/orders', ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const status = new URL(request.url).searchParams.get('status')
    const items = db.state.orders
      .filter((o) => o.userId === auth.userId)
      .map((o) => (o.status === 'pending' && o.settleAt <= Date.now() ? (settleOrder(o.id) ?? o) : o))
      .filter((o) => !status || o.status === status)
      .map(publicOrder)
    return HttpResponse.json({ items })
  }),

  route<{ orderId: string }>('get', '/orders/:orderId', ({ request, params }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const order = db.state.orders.find((o) => o.id === params.orderId)
    // Another user's order answers 404 to avoid leaking its existence.
    if (!order || order.userId !== auth.userId) return apiError(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (order.status === 'pending' && order.settleAt <= Date.now()) settleOrder(order.id)
    return HttpResponse.json(publicOrder(order))
  }),
]

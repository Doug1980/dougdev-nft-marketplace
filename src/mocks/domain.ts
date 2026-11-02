/**
 * Business rules of the simulated backend: serialization, catalog query, quote,
 * order snapshot and settlement. REST handlers only translate HTTP to these functions.
 */
import type { Cart, CatalogPage, CatalogQuery, NetworkId, NftDetail, NftSummary, OrderLine, Quote, QuoteIssue, User } from '@/api/contracts'
import { CATEGORY_LABELS, NETWORK_LABELS } from '@/api/contracts'
import { eth } from '@/lib/money'
import { COUPONS, type DbNft, type DbUser, NETWORK_FEES } from './db/seed'
import { type DbCart, type DbOrder, type DbQuote, db } from './db/store'
import { emitNftUpdated, emitOrderUpdated } from './realtime'

/** FNV-1a: small deterministic hash for fingerprints and fake tx hashes. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function hexFrom(seed: string, length: number) {
  let out = ''
  for (let i = 0; out.length < length; i++) out += fnv1a(`${seed}:${i}`)
  return out.slice(0, length)
}

// ---------- Serialization ----------
/** The 1/50 edition price is the listing price. */
export function listingPrice(nft: DbNft) {
  return nft.editions.find((e) => e.id === '1-50')?.price ?? '0'
}

export function toSummary(nft: DbNft): NftSummary {
  return {
    id: nft.id,
    slug: nft.slug,
    name: nft.name,
    tokenId: nft.tokenId,
    image: nft.image,
    imageAlt: nft.imageAlt,
    category: nft.category,
    network: nft.network,
    price: listingPrice(nft),
    compareAtPrice: nft.compareAtPrice,
    badge: nft.badge,
    isNew: nft.isNew,
    trendingScore: nft.trendingScore,
    listedAt: nft.listedAt,
    totalAvailable: nft.editions.reduce((acc, e) => acc + e.available, 0),
    version: nft.version,
  }
}

export function toDetail(nft: DbNft): NftDetail {
  const network = NETWORK_LABELS[nft.network]
  return {
    ...toSummary(nft),
    collection: nft.collection,
    description: nft.description,
    longDescription: [
      `${nft.name} é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na ${network}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
    ],
    gallery: [1, 2, 3, 4].map((i) => ({ src: nft.image, alt: `${nft.name}, vista ${i} de 4` })),
    attributes: nft.attributes,
    rating: nft.rating,
    reviewsCount: nft.reviewsCount,
    contract: nft.contract,
    royalties: 'Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.',
    editions: nft.editions,
  }
}

export function toUser(user: DbUser): User {
  const { passwordHash: _hash, passwordSalt: _salt, ...rest } = user
  return rest
}

/** Cart lines always expose the live price; addedPrice reveals changes since the item was added. */
export function toCart(cart: DbCart): Cart {
  return {
    id: cart.id,
    ownerId: cart.ownerId,
    couponCode: cart.couponCode,
    version: cart.version,
    items: cart.items.flatMap((item) => {
      const nft = db.nft(item.nftId)
      const edition = nft?.editions.find((e) => e.id === item.editionId)
      if (!nft || !edition) return []
      return [
        {
          id: item.id,
          nftId: nft.id,
          slug: nft.slug,
          name: nft.name,
          tokenId: nft.tokenId,
          image: nft.image,
          imageAlt: nft.imageAlt,
          editionId: edition.id,
          editionLabel: edition.label,
          quantity: item.quantity,
          unitPrice: edition.price,
          addedPrice: item.addedPrice,
          available: edition.available,
          maxPerOrder: edition.maxPerOrder,
          nftVersion: nft.version,
        },
      ]
    }),
  }
}

// ---------- Catalog ----------
export function queryCatalog(query: CatalogQuery & { page: number; pageSize: number }): CatalogPage {
  const all = db.state.nfts
  const term = query.q?.trim().toLowerCase()

  const base = all.filter((n) => {
    if (term && !`${n.name} ${n.collection} ${n.tokenId}`.toLowerCase().includes(term)) return false
    if (query.tab === 'new' && !n.isNew) return false
    if (query.tab === 'trending' && n.trendingScore < 500) return false
    return true
  })
  const inPrice = (n: DbNft) =>
    (!query.minPrice || eth.cmp(listingPrice(n), query.minPrice) >= 0) && (!query.maxPrice || eth.cmp(listingPrice(n), query.maxPrice) <= 0)
  const inCategory = (n: DbNft) => !query.categories?.length || query.categories.includes(n.category)
  const inNetwork = (n: DbNft) => !query.networks?.length || query.networks.includes(n.network)

  const sorted = base
    .filter((n) => inPrice(n) && inCategory(n) && inNetwork(n))
    .sort((a, b) => {
      switch (query.sort) {
        case 'price-asc':
          return eth.cmp(listingPrice(a), listingPrice(b)) || a.name.localeCompare(b.name)
        case 'price-desc':
          return eth.cmp(listingPrice(b), listingPrice(a)) || a.name.localeCompare(b.name)
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return b.listedAt.localeCompare(a.listedAt)
      }
    })

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const page = Math.min(query.page, totalPages)

  // Faceted counts: each option counts results considering the other active filters.
  const categories = (Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((id) => ({
    id,
    label: CATEGORY_LABELS[id],
    count: base.filter((n) => n.category === id && inPrice(n) && inNetwork(n)).length,
  }))
  const networks = (Object.keys(NETWORK_LABELS) as NetworkId[]).map((id) => ({
    id,
    label: NETWORK_LABELS[id],
    count: base.filter((n) => n.network === id && inPrice(n) && inCategory(n)).length,
  }))
  const prices = all.map(listingPrice).sort(eth.cmp)
  const featured = db.nft('nft_sage-nomad-009')

  return {
    items: sorted.slice((page - 1) * query.pageSize, page * query.pageSize).map(toSummary),
    page,
    pageSize: query.pageSize,
    total,
    totalPages,
    facets: { categories, networks, priceRange: { min: prices[0] ?? '0', max: prices.at(-1) ?? '0' } },
    featured: featured ? toSummary(featured) : null,
  }
}

// ---------- Quote ----------
export function computeQuote(cart: DbCart, network: NetworkId, userId: string | null): DbQuote {
  const issues: QuoteIssue[] = []
  const lines: Quote['lines'] = []

  for (const item of cart.items) {
    const nft = db.nft(item.nftId)
    const edition = nft?.editions.find((e) => e.id === item.editionId)
    if (!nft || !edition) continue
    if (edition.available === 0) {
      issues.push({ itemId: item.id, kind: 'sold_out', message: `${nft.name} (${edition.label}) esgotou.` })
      continue
    }
    let quantity = item.quantity
    if (quantity > edition.available) {
      issues.push({
        itemId: item.id,
        kind: 'quantity_reduced',
        message: `Restam apenas ${edition.available} de ${nft.name} (${edition.label}).`,
      })
      quantity = edition.available
    }
    if (!eth.eq(item.addedPrice, edition.price)) {
      issues.push({
        itemId: item.id,
        kind: 'price_changed',
        message: `O preço de ${nft.name} mudou de ${item.addedPrice} para ${edition.price} ETH.`,
      })
    }
    lines.push({
      itemId: item.id,
      nftId: nft.id,
      editionId: edition.id,
      quantity,
      unitPrice: edition.price,
      lineTotal: eth.mul(edition.price, quantity),
    })
  }

  const subtotal = eth.add(...lines.map((l) => l.lineTotal))
  let discount = '0'
  let coupon: Quote['coupon'] = null
  if (cart.couponCode) {
    const def = COUPONS[cart.couponCode]
    if (!def) coupon = { code: cart.couponCode, status: 'invalid', label: 'Cupom inválido' }
    else if (def.expired) coupon = { code: cart.couponCode, status: 'expired', label: 'Cupom expirado' }
    else {
      discount = eth.pct(subtotal, def.percent)
      coupon = { code: cart.couponCode, status: 'applied', label: def.label }
    }
  }
  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  const total = eth.add(eth.sub(subtotal, discount), networkFee)
  const createdAt = new Date()

  const quote: DbQuote = {
    id: db.nextId('qt'),
    fingerprint: fnv1a(JSON.stringify({ lines, subtotal, discount, networkFee, total, coupon: coupon?.code ?? null, network })),
    network,
    lines,
    subtotal,
    discount,
    networkFee,
    total,
    coupon,
    issues,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 5 * 60_000).toISOString(),
    cartId: cart.id,
    userId,
  }
  // Keep only recent quotes per cart to bound storage.
  db.state.quotes = [...db.state.quotes.filter((q) => q.cartId !== cart.id).slice(-20), quote]
  return quote
}

export function publicQuote({ cartId: _cart, userId: _user, ...quote }: DbQuote): Quote {
  return quote
}

// ---------- Catalog changes (emit events) ----------
export function updateEdition(nftId: string, editionId: string, patch: { price?: string; available?: number }) {
  const nft = db.nft(nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  if (!nft || !edition) return null
  const previous = structuredClone(nft)
  if (patch.price !== undefined) edition.price = eth.normalize(patch.price)
  if (patch.available !== undefined) edition.available = Math.max(0, patch.available)
  nft.version += 1
  db.commit()
  emitNftUpdated(nft, previous)
  return nft
}

// ---------- Orders ----------
/** Freezes name, image and prices into the order (receipt snapshot). */
export function orderLinesFrom(quote: DbQuote): OrderLine[] {
  return quote.lines.flatMap((line) => {
    const nft = db.nft(line.nftId)
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) return []
    return [
      {
        itemId: line.itemId,
        nftId: nft.id,
        name: nft.name,
        tokenId: nft.tokenId,
        image: nft.image,
        imageAlt: nft.imageAlt,
        editionId: edition.id,
        editionLabel: edition.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      },
    ]
  })
}

const settleTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function scheduleSettlement(order: DbOrder) {
  if (order.status !== 'pending' || settleTimers.has(order.id)) return
  const timer = setTimeout(
    () => {
      settleTimers.delete(order.id)
      settleOrder(order.id)
    },
    Math.max(0, order.settleAt - Date.now()),
  )
  settleTimers.set(order.id, timer)
}

/** Settles the order on the simulated network. Idempotent: terminal orders never change. */
export function settleOrder(orderId: string) {
  const order = db.state.orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'pending') return order

  let outcome = order.outcome
  let reason = outcome === 'rejected' ? 'Pagamento recusado pela carteira na rede. Nenhum valor foi debitado.' : null
  if (outcome === 'confirmed') {
    const short = order.lines.find((line) => {
      const edition = db.nft(line.nftId)?.editions.find((e) => e.id === line.editionId)
      return !edition || edition.available < line.quantity
    })
    if (short) {
      outcome = 'rejected'
      reason = `Disponibilidade insuficiente para ${short.name} no momento da liquidação.`
    }
  }

  order.status = outcome
  order.version += 1
  order.updatedAt = new Date().toISOString()
  order.rejectionReason = reason

  if (outcome === 'confirmed') {
    order.txHash = `0x${hexFrom(order.id, 64)}`
    // Simulated explorer (internal route): the hash does not exist on a real network.
    order.explorerUrl = `/explorador/tx/${order.txHash}`
    for (const line of order.lines) {
      const nft = db.nft(line.nftId)
      const edition = nft?.editions.find((e) => e.id === line.editionId)
      if (!nft || !edition) continue
      const previous = structuredClone(nft)
      edition.available -= line.quantity
      nft.version += 1
      emitNftUpdated(nft, previous)
    }
    // Remove only the purchased quantities from the cart.
    const cart = db.cart(order.cartId)
    if (cart) {
      for (const line of order.lines) {
        const item = cart.items.find((i) => i.id === line.itemId)
        if (item) item.quantity -= line.quantity
      }
      cart.items = cart.items.filter((i) => i.quantity > 0)
      if (!cart.items.length) cart.couponCode = null
      cart.version += 1
    }
  }

  db.commit()
  emitOrderUpdated(order)
  return order
}

/** Timers do not survive a page reload; reschedule every pending order on boot. */
export function resumePendingOrders() {
  for (const order of db.state.orders) if (order.status === 'pending') scheduleSettlement(order)
}

export function publicOrder({ payloadHash: _p, quoteId: _q, settleAt: _s, outcome: _o, cartId: _c, ...order }: DbOrder) {
  return order
}

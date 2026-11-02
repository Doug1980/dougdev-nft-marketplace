/**
 * Shared contracts between transport (Axios), mocks (MSW) and UI.
 * Every API response is parsed with these schemas before reaching the cache.
 * ETH amounts travel as decimal strings to preserve precision.
 */
import { z } from 'zod'

// ---------- Primitives ----------
export const ethAmount = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Valor ETH deve ser uma string decimal')
export type EthAmount = z.infer<typeof ethAmount>

const email = z.string().trim().min(1, 'Informe o e-mail').pipe(z.email('E-mail inválido'))

export const networkId = z.enum(['ethereum', 'polygon', 'solana'])
export type NetworkId = z.infer<typeof networkId>

export const walletType = z.enum(['metamask', 'walletconnect', 'coinbase'])
export type WalletType = z.infer<typeof walletType>

export const categoryId = z.enum([
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
])
export type CategoryId = z.infer<typeof categoryId>

// ---------- Errors ----------
export const errorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'AVAILABILITY_CONFLICT',
  'EDITION_UNAVAILABLE',
  'QUOTE_STALE',
  'IDEMPOTENCY_CONFLICT',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'WALLET_REJECTED',
  'INVALID_CREDENTIALS',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
])
export type ErrorCode = z.infer<typeof errorCode>

export const apiErrorBody = z.object({
  error: z.object({
    code: errorCode,
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBody>

// ---------- NFTs ----------
export const editionId = z.enum(['1-1', '1-10', '1-50', 'open'])
export type EditionId = z.infer<typeof editionId>

export const edition = z.object({
  id: editionId,
  label: z.string(),
  price: ethAmount,
  available: z.number().int().min(0),
  maxPerOrder: z.number().int().min(1),
})
export type Edition = z.infer<typeof edition>

export const nftSummary = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  category: categoryId,
  network: networkId,
  price: ethAmount,
  compareAtPrice: ethAmount.nullable(),
  badge: z.enum(['raro']).nullable(),
  isNew: z.boolean(),
  trendingScore: z.number(),
  listedAt: z.string(),
  totalAvailable: z.number().int().min(0),
  version: z.number().int(),
})
export type NftSummary = z.infer<typeof nftSummary>

export const nftDetail = nftSummary.extend({
  collection: z.string(),
  description: z.string(),
  longDescription: z.array(z.string()),
  gallery: z.array(z.object({ src: z.string(), alt: z.string() })),
  attributes: z.array(z.string()),
  rating: z.number(),
  reviewsCount: z.number().int(),
  contract: z.string(),
  royalties: z.string(),
  editions: z.array(edition),
})
export type NftDetail = z.infer<typeof nftDetail>

export const catalogSort = z.enum(['recent', 'price-asc', 'price-desc', 'name'])
export type CatalogSort = z.infer<typeof catalogSort>

export const catalogTab = z.enum(['all', 'new', 'trending'])
export type CatalogTab = z.infer<typeof catalogTab>

export const catalogQuery = z.object({
  q: z.string().optional(),
  tab: catalogTab.optional(),
  categories: z.array(categoryId).optional(),
  networks: z.array(networkId).optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sort: catalogSort.optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(48).optional(),
})
export type CatalogQuery = z.infer<typeof catalogQuery>

export const catalogPage = z.object({
  items: z.array(nftSummary),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    categories: z.array(z.object({ id: categoryId, label: z.string(), count: z.number().int() })),
    networks: z.array(z.object({ id: networkId, label: z.string(), count: z.number().int() })),
    priceRange: z.object({ min: ethAmount, max: ethAmount }),
  }),
  featured: nftSummary.nullable(),
})
export type CatalogPage = z.infer<typeof catalogPage>

// ---------- Session & account ----------
export const user = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  displayName: z.string(),
  ensName: z.string(),
  walletNickname: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof user>

export const session = z.object({ token: z.string(), expiresAt: z.string(), user })
export type Session = z.infer<typeof session>

export const sessionInfo = z.object({ expiresAt: z.string(), user })
export type SessionInfo = z.infer<typeof sessionInfo>

const username = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres')
  .max(24, 'Use no máximo 24 caracteres')
  .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, ponto ou _')

const ensName = z
  .string()
  .trim()
  .min(3, 'Informe o nome ENS')
  .regex(/^[a-z0-9-]+$/i, 'Use letras, números ou hífen')

export const passwordRule = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

export const loginInput = z.object({
  email,
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginInput = z.infer<typeof loginInput>

export const registerInput = z
  .object({
    username,
    email,
    password: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme a senha'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
export type RegisterInput = z.infer<typeof registerInput>

// ---------- Profile ----------
export const profileInput = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição').max(40, 'Máximo de 40 caracteres'),
  username,
  email,
  ensName,
  walletNickname: z.string().trim().min(2, 'Informe o apelido da carteira').max(32, 'Máximo de 32 caracteres'),
})
export type ProfileInput = z.infer<typeof profileInput>

export const passwordChangeInput = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type PasswordChangeInput = z.infer<typeof passwordChangeInput>

export const avatarInput = z.object({
  dataUrl: z.string().regex(/^data:image\/(png|jpe?g|webp|gif);base64,/, 'Formato de imagem não suportado'),
})

// ---------- Wallets ----------
const evmAddress = /^0x[a-fA-F0-9]{40}$/
const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const walletInput = z
  .object({
    slot: z.enum(['primary', 'secondary']),
    displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
    nickname: z.string().trim().min(2, 'Informe o apelido da carteira'),
    network: networkId,
    profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
    address: z.string().trim().min(1, 'Informe o endereço da carteira'),
    secondaryAddress: z.string().trim(),
    walletType,
    referralCode: z
      .string()
      .trim()
      .min(4, 'Código de indicação com ao menos 4 caracteres')
      .regex(/^[A-Z0-9-]+$/i, 'Use letras, números ou hífen'),
    email,
    ensName,
  })
  .superRefine((v, ctx) => {
    // Address format depends on the selected network.
    const pattern = v.network === 'solana' ? solanaAddress : evmAddress
    if (!pattern.test(v.address)) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: v.network === 'solana' ? 'Endereço Solana inválido' : 'Endereço 0x inválido (40 hexadecimais)',
      })
    }
    if (v.secondaryAddress && !pattern.test(v.secondaryAddress) && !/\.eth$/i.test(v.secondaryAddress)) {
      ctx.addIssue({ code: 'custom', path: ['secondaryAddress'], message: 'Use um endereço válido ou um nome .eth' })
    }
  })
export type WalletInput = z.infer<typeof walletInput>

export const wallet = z.object({
  id: z.string(),
  slot: z.enum(['primary', 'secondary']),
  displayName: z.string(),
  nickname: z.string(),
  network: networkId,
  profileName: z.string(),
  address: z.string(),
  secondaryAddress: z.string(),
  walletType,
  referralCode: z.string(),
  email: z.string(),
  ensName: z.string(),
  updatedAt: z.string(),
})
export type Wallet = z.infer<typeof wallet>

export const walletSession = z.object({
  id: z.string(),
  walletId: z.string(),
  network: networkId,
  address: z.string(),
  connectedAt: z.string(),
})
export type WalletSession = z.infer<typeof walletSession>

// ---------- Favorites ----------
export const favorites = z.object({ nftIds: z.array(z.string()) })
export type Favorites = z.infer<typeof favorites>

// ---------- Cart ----------
export const cartItem = z.object({
  id: z.string(),
  nftId: z.string(),
  slug: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  editionId,
  editionLabel: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: ethAmount,
  /** Price when the item was added; differs from unitPrice after a price change. */
  addedPrice: ethAmount,
  available: z.number().int().min(0),
  maxPerOrder: z.number().int().min(1),
  nftVersion: z.number().int(),
})
export type CartItem = z.infer<typeof cartItem>

export const cart = z.object({
  id: z.string(),
  ownerId: z.string().nullable(),
  items: z.array(cartItem),
  couponCode: z.string().nullable(),
  version: z.number().int(),
})
export type Cart = z.infer<typeof cart>

export const addCartItemInput = z.object({
  nftId: z.string(),
  editionId,
  quantity: z.number().int().min(1),
})
export type AddCartItemInput = z.infer<typeof addCartItemInput>

// ---------- Quote ----------
export const quoteIssue = z.object({
  itemId: z.string(),
  kind: z.enum(['price_changed', 'quantity_reduced', 'sold_out']),
  message: z.string(),
})
export type QuoteIssue = z.infer<typeof quoteIssue>

export const quote = z.object({
  id: z.string(),
  /** Hash of lines + totals; order creation must send the same fingerprint the user reviewed. */
  fingerprint: z.string(),
  network: networkId,
  lines: z.array(
    z.object({
      itemId: z.string(),
      nftId: z.string(),
      editionId,
      quantity: z.number().int(),
      unitPrice: ethAmount,
      lineTotal: ethAmount,
    }),
  ),
  subtotal: ethAmount,
  discount: ethAmount,
  networkFee: ethAmount,
  total: ethAmount,
  coupon: z.object({ code: z.string(), status: z.enum(['applied', 'invalid', 'expired']), label: z.string() }).nullable(),
  issues: z.array(quoteIssue),
  createdAt: z.string(),
  expiresAt: z.string(),
})
export type Quote = z.infer<typeof quote>

// ---------- Orders ----------
export const orderStatus = z.enum(['pending', 'confirmed', 'rejected'])
export type OrderStatus = z.infer<typeof orderStatus>

export const buyerInput = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  username: z.string().trim().min(3, 'Informe o nome de usuário'),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
  email,
  ensName,
  referralCode: z.string().trim().min(4, 'Informe o código de indicação'),
  note: z.string().trim().max(280, 'Máximo de 280 caracteres'),
})
export type BuyerInput = z.infer<typeof buyerInput>

export const createOrderInput = z.object({
  quoteId: z.string(),
  quoteFingerprint: z.string(),
  walletId: z.string(),
  walletSessionId: z.string(),
  network: networkId,
  buyer: buyerInput,
})
export type CreateOrderInput = z.infer<typeof createOrderInput>

export const orderLine = z.object({
  itemId: z.string(),
  nftId: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  editionId,
  editionLabel: z.string(),
  quantity: z.number().int(),
  unitPrice: ethAmount,
  lineTotal: ethAmount,
})
export type OrderLine = z.infer<typeof orderLine>

/** Receipt snapshot: values are frozen at creation and never recomputed from the catalog. */
export const order = z.object({
  id: z.string(),
  userId: z.string(),
  status: orderStatus,
  version: z.number().int(),
  idempotencyKey: z.string(),
  lines: z.array(orderLine),
  subtotal: ethAmount,
  discount: ethAmount,
  networkFee: ethAmount,
  total: ethAmount,
  couponCode: z.string().nullable(),
  network: networkId,
  wallet: z.object({ id: z.string(), label: z.string(), address: z.string(), walletType }),
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Order = z.infer<typeof order>

// ---------- Realtime events ----------
/** Stable identity + affected resource + version: lets the client drop duplicates and stale events. */
const realtimeEnvelope = z.object({
  eventId: z.string(),
  resource: z.object({ type: z.enum(['nft', 'order']), id: z.string() }),
  version: z.number().int(),
  occurredAt: z.string(),
})

export const nftUpdatedEvent = realtimeEnvelope.extend({
  type: z.literal('nft.updated'),
  data: z.object({
    nftId: z.string(),
    price: ethAmount,
    compareAtPrice: ethAmount.nullable(),
    totalAvailable: z.number().int(),
    editions: z.array(edition.pick({ id: true, price: true, available: true })),
  }),
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEvent>

export const orderUpdatedEvent = realtimeEnvelope.extend({
  type: z.literal('order.updated'),
  userId: z.string(),
  data: z.object({
    orderId: z.string(),
    status: orderStatus,
    txHash: z.string().nullable(),
    rejectionReason: z.string().nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEvent>

// ---------- UI labels ----------
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABELS: Record<NetworkId, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

export const SORT_LABELS: Record<CatalogSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  name: 'Nome (A-Z)',
}

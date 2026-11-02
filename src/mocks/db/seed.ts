/**
 * Deterministic fixtures: same seed, same catalog, prices and stock.
 * Keeps E2E assertions and visual baselines stable.
 */
import type { CategoryId, Edition, NetworkId, WalletType } from '@/api/contracts'
import { eth } from '@/lib/money'

export type DbNft = {
  id: string
  slug: string
  name: string
  tokenId: string
  image: string
  imageAlt: string
  category: CategoryId
  network: NetworkId
  compareAtPrice: string | null
  badge: 'raro' | null
  isNew: boolean
  trendingScore: number
  listedAt: string
  collection: string
  description: string
  attributes: string[]
  rating: number
  reviewsCount: number
  contract: string
  editions: Edition[]
  version: number
}

export type DbUser = {
  id: string
  username: string
  email: string
  displayName: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
  passwordHash: string
  passwordSalt: string
}

export type DbWallet = {
  id: string
  userId: string
  slot: 'primary' | 'secondary'
  displayName: string
  nickname: string
  network: NetworkId
  profileName: string
  address: string
  secondaryAddress: string
  walletType: WalletType
  referralCode: string
  email: string
  ensName: string
  updatedAt: string
}

const ARTWORKS = {
  emerald: {
    src: '/nfts/emerald-ape.webp',
    alt: 'macaco de pelagem marrom com óculos redondos de lentes verdes, jaqueta college verde e colar com pedra esmeralda',
  },
  violet: {
    src: '/nfts/violet-nomad.webp',
    alt: 'gorila grisalho sorridente com chapéu bucket verde-claro e moletom roxo com capuz',
  },
  ivory: {
    src: '/nfts/ivory-baron.webp',
    alt: 'chimpanzé de pelagem preta com brinco dourado, gola alta verde-escura e blazer creme',
  },
  golden: {
    src: '/nfts/golden-beat.webp',
    alt: 'macaco de pelagem dourada com fones de ouvido verdes e jaqueta bomber creme',
  },
} as const
type ArtKey = keyof typeof ARTWORKS

/** mulberry32 PRNG: tiny, fast and deterministic. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type NftInput = {
  name: string
  art: ArtKey
  price: string
  compareAt?: string
  category: CategoryId
  network: NetworkId
  badge?: 'raro'
  attributes: string[]
  collection: string
}

/** NFTs shown in the Figma frames, with the exact layout prices. */
const CURATED: NftInput[] = [
  {
    name: 'Emerald Ape #042',
    art: 'emerald',
    price: '1.19',
    category: 'arte-digital',
    network: 'ethereum',
    attributes: ['Óculos', 'Esmeralda', 'Raro'],
    collection: 'Kurio Apes',
  },
  {
    name: 'Sage Nomad #009',
    art: 'violet',
    price: '1.69',
    category: 'arte-digital',
    network: 'ethereum',
    attributes: ['Chapéu', 'Sálvia', 'Comum'],
    collection: 'Kurio Apes',
  },
  {
    name: 'Neon Vessel #552',
    art: 'emerald',
    price: '1.99',
    compareAt: '2.29',
    category: 'colecionaveis',
    network: 'ethereum',
    badge: 'raro',
    attributes: ['Óculos', 'Neon', 'Raro'],
    collection: 'Kurio Apes',
  },
  {
    name: 'Cosmic Bloom #118',
    art: 'violet',
    price: '1.29',
    category: 'generativa',
    network: 'polygon',
    attributes: ['Moletom', 'Cósmico', 'Incomum'],
    collection: 'Kurio Nomads',
  },
  {
    name: 'Violet Nomad #314',
    art: 'violet',
    price: '1.39',
    category: 'arte-digital',
    network: 'ethereum',
    attributes: ['Chapéu', 'Violeta', 'Incomum'],
    collection: 'Kurio Nomads',
  },
  {
    name: 'Ivory Baron #088',
    art: 'ivory',
    price: '1.79',
    category: 'arte-digital',
    network: 'ethereum',
    attributes: ['Blazer', 'Marfim', 'Raro'],
    collection: 'Kurio Barons',
  },
  {
    name: 'Golden Beat #207',
    art: 'golden',
    price: '0.99',
    category: 'musica',
    network: 'polygon',
    attributes: ['Fones', 'Dourado', 'Comum'],
    collection: 'Kurio Beats',
  },
  {
    name: 'Silent Grove #031',
    art: 'ivory',
    price: '2.49',
    category: 'fotografia',
    network: 'ethereum',
    attributes: ['Blazer', 'Bosque', 'Raro'],
    collection: 'Kurio Barons',
  },
  {
    name: 'Golden Signal #160',
    art: 'golden',
    price: '0.39',
    category: 'musica',
    network: 'solana',
    attributes: ['Fones', 'Sinal', 'Comum'],
    collection: 'Kurio Beats',
  },
]

const ADJECTIVES = [
  'Amber',
  'Velvet',
  'Lunar',
  'Copper',
  'Jade',
  'Crimson',
  'Frost',
  'Obsidian',
  'Solar',
  'Rustic',
  'Prism',
  'Echo',
  'Mossy',
  'Saffron',
  'Quartz',
  'Tidal',
  'Hollow',
  'Midnight',
]
const NOUNS: Record<ArtKey, string[]> = {
  emerald: ['Ape', 'Monarch', 'Vessel', 'Drifter'],
  violet: ['Nomad', 'Bloom', 'Wanderer', 'Hermit'],
  ivory: ['Baron', 'Curator', 'Envoy', 'Regent'],
  golden: ['Beat', 'Signal', 'Rhythm', 'Static'],
}
const COLLECTION_BY_ART: Record<ArtKey, string> = {
  emerald: 'Kurio Apes',
  violet: 'Kurio Nomads',
  ivory: 'Kurio Barons',
  golden: 'Kurio Beats',
}
const ATTRIBUTES_BY_ART: Record<ArtKey, string[]> = {
  emerald: ['Óculos', 'Jaqueta college'],
  violet: ['Chapéu', 'Moletom'],
  ivory: ['Blazer', 'Gola alta'],
  golden: ['Fones', 'Bomber'],
}
const CATEGORIES: CategoryId[] = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
]
const NETWORKS: NetworkId[] = ['ethereum', 'polygon', 'solana']
const NETWORK_NAMES: Record<NetworkId, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }

const TOTAL_NFTS = 54
const BASE_DATE = Date.UTC(2026, 9, 30, 12, 0, 0)

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Each NFT has four editions; the 1/50 price is the listing price. */
function buildEditions(price: string, rand: () => number, soldOutSingle: boolean): Edition[] {
  return [
    { id: '1-1', label: '1/1', price: eth.mul(price, 3), available: soldOutSingle ? 0 : 1, maxPerOrder: 1 },
    { id: '1-10', label: '1/10', price: eth.mul(price, '1.5'), available: 3 + Math.floor(rand() * 8), maxPerOrder: 3 },
    { id: '1-50', label: '1/50', price, available: 12 + Math.floor(rand() * 38), maxPerOrder: 10 },
    { id: 'open', label: 'ABERTA', price: eth.mul(price, '0.6'), available: 999, maxPerOrder: 20 },
  ]
}

function toNft(index: number, input: NftInput, rand: () => number): DbNft {
  const tokenNumber = input.name.split('#')[1] ?? String(index).padStart(3, '0')
  const art = ARTWORKS[input.art]
  const slug = slugify(input.name)
  return {
    id: `nft_${slug}`,
    slug,
    name: input.name,
    tokenId: `#${tokenNumber.padStart(4, '0')}`,
    image: art.src,
    imageAlt: `${input.name}: ${art.alt}`,
    category: input.category,
    network: input.network,
    compareAtPrice: input.compareAt ?? null,
    badge: input.badge ?? null,
    isNew: index % 4 === 1,
    trendingScore: Math.round(rand() * 1000),
    listedAt: new Date(BASE_DATE - index * 9 * 3_600_000).toISOString(),
    collection: input.collection,
    description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${NETWORK_NAMES[input.network]}, com arte desbloqueável e acesso para colecionadores.`,
    attributes: input.attributes,
    rating: 4 + Math.round(rand() * 10) / 10,
    reviewsCount: 3 + Math.floor(rand() * 40),
    contract: `0x7A42…${Math.floor(rand() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, '0')}`,
    editions: buildEditions(input.price, rand, index % 5 === 3),
    version: 1,
  }
}

export function seedNfts(): DbNft[] {
  const rand = mulberry32(2026)
  const nfts = CURATED.map((input, i) => toNft(i, input, rand))

  // Reference NFT from the layout: 4.8 rating, 19 reviews, 1/1 available.
  const reference = nfts[0]
  if (reference) {
    reference.rating = 4.8
    reference.reviewsCount = 19
    reference.contract = '0x7A42…19E8'
    reference.editions = buildEditions('1.19', rand, false).map((e) => (e.id === '1-50' ? { ...e, available: 50 } : e))
  }

  const arts = Object.keys(ARTWORKS) as ArtKey[]
  for (let i = 0; nfts.length < TOTAL_NFTS; i++) {
    const art = arts[i % arts.length] as ArtKey
    const adjective = ADJECTIVES[(i * 7) % ADJECTIVES.length]
    const noun = NOUNS[art][Math.floor(i / arts.length) % 4]
    const name = `${adjective} ${noun} #${String(100 + ((i * 37) % 900))}`
    if (nfts.some((n) => n.name === name)) continue
    // Price range from the layout filter: 0,02 to 12,30 ETH, skewed towards cheaper items.
    const price = (0.02 + rand() ** 2.2 * 12.28).toFixed(2)
    nfts.push(
      toNft(
        nfts.length,
        {
          name,
          art,
          price,
          compareAt: rand() > 0.85 ? (Number(price) * 1.15).toFixed(2) : undefined,
          category: CATEGORIES[(i * 5 + 2) % CATEGORIES.length] as CategoryId,
          network: NETWORKS[(i * 2 + 1) % NETWORKS.length] as NetworkId,
          badge: rand() > 0.88 ? 'raro' : undefined,
          attributes: [...ATTRIBUTES_BY_ART[art], rand() > 0.7 ? 'Raro' : 'Comum'],
          collection: COLLECTION_BY_ART[art],
        },
        rand,
      ),
    )
  }

  // Pin the range edges so the price filter always has items at both ends.
  const last = nfts.at(-1)
  const secondLast = nfts.at(-2)
  if (last) last.editions = buildEditions('12.30', rand, false)
  if (secondLast) secondLast.editions = buildEditions('0.02', rand, false)
  return nfts
}

/** Shared demo password. Stored only as salted SHA-256 (see store.ts). */
export const MOCK_PASSWORD = 'Kurio@2026'

export const SEED_USERS: Array<Omit<DbUser, 'passwordHash' | 'passwordSalt'> & { salt: string }> = [
  {
    id: 'usr_nova',
    username: 'nova.sato',
    email: 'colecionador@kurio.dev',
    displayName: 'Nova Sato',
    ensName: 'nova',
    walletNickname: 'Principal',
    avatarUrl: null,
    salt: 'b7c1e9',
  },
  {
    id: 'usr_lia',
    username: 'lia.curadora',
    email: 'curadora@kurio.dev',
    displayName: 'Lia Moraes',
    ensName: 'lia',
    walletNickname: 'Cofre',
    avatarUrl: null,
    salt: '4f2a90',
  },
]

export const SEED_WALLETS: DbWallet[] = [
  {
    id: 'wal_nova_primary',
    userId: 'usr_nova',
    slot: 'primary',
    displayName: 'Nova Sato',
    nickname: 'Principal',
    network: 'ethereum',
    profileName: 'nova.kurio',
    address: '0xA91F3c2B7d4E5f60718293a4B5c6D7e8F901E82C',
    secondaryAddress: '',
    walletType: 'metamask',
    referralCode: 'KURIO-NOVA',
    email: 'colecionador@kurio.dev',
    ensName: 'nova',
    updatedAt: new Date(BASE_DATE).toISOString(),
  },
  {
    id: 'wal_nova_secondary',
    userId: 'usr_nova',
    slot: 'secondary',
    displayName: 'Nova Sato',
    nickname: 'Reserva',
    network: 'polygon',
    profileName: 'nova.kurio',
    address: '0x5b2E8c1D4f6A7b9C0d1E2f3A4b5C6d7E8f9A0b1C',
    secondaryAddress: 'nova.kurio.eth',
    walletType: 'coinbase',
    referralCode: 'KURIO-NOVA',
    email: 'colecionador@kurio.dev',
    ensName: 'nova',
    updatedAt: new Date(BASE_DATE).toISOString(),
  },
]

export const COUPONS: Record<string, { percent: number; expired: boolean; label: string }> = {
  KURIO10: { percent: 10, expired: false, label: 'Desconto do lançamento (10%)' },
  GENESIS5: { percent: 5, expired: false, label: 'Desconto gênesis (5%)' },
  VERAO2025: { percent: 15, expired: true, label: 'Campanha de verão 2025' },
}

export const NETWORK_FEES: Record<NetworkId, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

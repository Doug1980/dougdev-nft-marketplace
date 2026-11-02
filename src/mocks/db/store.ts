/**
 * Single source of truth for the simulation. REST handlers and Socket.IO events
 * read and write the same state, so they never diverge.
 * Persisted to localStorage to survive refreshes; reset() restores the seed.
 */
import type { EditionId, NetworkId, Order, Quote } from '@/api/contracts'
import { isScenarioId, SCENARIO_STORAGE_KEY, type ScenarioId } from '../scenarios'
import { MOCK_PASSWORD, SEED_USERS, SEED_WALLETS, seedNfts, type DbNft, type DbUser, type DbWallet } from './seed'

export type DbCartItem = { id: string; nftId: string; editionId: EditionId; quantity: number; addedPrice: string }

export type DbCart = { id: string; ownerId: string | null; items: DbCartItem[]; couponCode: string | null; version: number }

export type DbSession = { token: string; userId: string; expiresAt: number; revoked: boolean }

export type DbQuote = Quote & { cartId: string; userId: string | null }

export type DbOrder = Order & {
  payloadHash: string
  quoteId: string
  /** Epoch ms when the simulated network settles the order. */
  settleAt: number
  outcome: 'confirmed' | 'rejected'
  cartId: string
}

export type DbWalletSession = { id: string; walletId: string; userId: string; network: NetworkId; connectedAt: string; active: boolean }

export type DbState = {
  schema: number
  users: DbUser[]
  sessions: DbSession[]
  nfts: DbNft[]
  carts: DbCart[]
  favorites: Record<string, string[]>
  wallets: DbWallet[]
  walletSessions: DbWalletSession[]
  quotes: DbQuote[]
  orders: DbOrder[]
  seq: number
  eventSeq: number
  scenario: ScenarioId
  /** Per-route attempt counter (flaky scenario). */
  hits: Record<string, number>
  /** One-shot scenario triggers already fired. */
  triggered: string[]
}

const STORAGE_KEY = 'kurio:mockdb'
const SCHEMA = 1
export const SESSION_TTL_MS = 30 * 60_000

export async function hashPassword(password: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function createSeedState(scenario: ScenarioId): Promise<DbState> {
  const users = await Promise.all(
    SEED_USERS.map(async ({ salt, ...user }) => ({
      ...user,
      passwordSalt: salt,
      passwordHash: await hashPassword(MOCK_PASSWORD, salt),
    })),
  )
  return {
    schema: SCHEMA,
    users,
    sessions: [],
    nfts: seedNfts(),
    carts: [],
    favorites: { usr_nova: ['nft_emerald-ape-042'], usr_lia: [] },
    wallets: structuredClone(SEED_WALLETS),
    walletSessions: [],
    quotes: [],
    orders: [],
    seq: 1000,
    eventSeq: 0,
    scenario,
    hits: {},
    triggered: [],
  }
}

function readStoredScenario(): ScenarioId {
  try {
    const value = localStorage.getItem(SCENARIO_STORAGE_KEY)
    return isScenarioId(value) ? value : 'default'
  } catch {
    return 'default'
  }
}

class MockDb {
  state!: DbState

  async init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as DbState) : null
      if (parsed?.schema === SCHEMA) {
        this.state = { ...parsed, scenario: readStoredScenario() }
        return
      }
    } catch {
      // Corrupted or unavailable storage: fall back to the seed.
    }
    this.state = await createSeedState(readStoredScenario())
    this.commit()
  }

  async reset(scenario: ScenarioId = 'default') {
    this.state = await createSeedState(scenario)
    this.setScenario(scenario)
  }

  setScenario(scenario: ScenarioId) {
    this.state.scenario = scenario
    this.state.hits = {}
    this.state.triggered = []
    try {
      localStorage.setItem(SCENARIO_STORAGE_KEY, scenario)
    } catch {
      // Storage unavailable: scenario stays in memory.
    }
    this.commit()
  }

  commit() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch {
      // Quota or private mode: state stays in memory.
    }
  }

  nextId(prefix: string) {
    this.state.seq += 1
    return `${prefix}_${this.state.seq.toString(36)}`
  }

  nextEventId() {
    this.state.eventSeq += 1
    return `evt_${String(this.state.eventSeq).padStart(6, '0')}`
  }

  nft(idOrSlug: string) {
    return this.state.nfts.find((n) => n.id === idOrSlug || n.slug === idOrSlug)
  }

  user(id: string) {
    return this.state.users.find((u) => u.id === id)
  }

  cart(id: string) {
    return this.state.carts.find((c) => c.id === id)
  }

  cartForUser(userId: string): DbCart {
    let cart = this.state.carts.find((c) => c.ownerId === userId)
    if (!cart) {
      cart = { id: this.nextId('cart'), ownerId: userId, items: [], couponCode: null, version: 1 }
      this.state.carts.push(cart)
    }
    return cart
  }

  /** Guest carts are identified by the X-Cart-Id header the client persists. */
  guestCart(guestId: string | null): DbCart {
    let cart = guestId ? this.state.carts.find((c) => c.id === guestId && c.ownerId === null) : undefined
    if (!cart) {
      cart = { id: this.nextId('guest'), ownerId: null, items: [], couponCode: null, version: 1 }
      this.state.carts.push(cart)
    }
    return cart
  }
}

export const db = new MockDb()

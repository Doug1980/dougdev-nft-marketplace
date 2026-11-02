import { test as base, expect, type Page } from '@playwright/test'

export const USERS = {
  nova: { email: 'colecionador@kurio.dev', password: 'Kurio@2026', name: 'Nova Sato' },
  lia: { email: 'curadora@kurio.dev', password: 'Kurio@2026', name: 'Lia Moraes' },
} as const

export type Scenario =
  | 'default'
  | 'fast'
  | 'slow'
  | 'out-of-order'
  | 'empty-catalog'
  | 'offline'
  | 'server-error'
  | 'flaky'
  | 'favorites-fail'
  | 'price-change'
  | 'sold-out'
  | 'order-timeout'
  | 'payment-declined'
  | 'wallet-rejected'
  | 'socket-drop'
  | 'duplicate-events'

/** Simulation control through `/api/__mock` routes (served by MSW inside the page). */
export class MockControl {
  constructor(private page: Page) {}

  private async call<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.page.evaluate(
      async ({ path, body }) => {
        const raw = localStorage.getItem('kurio:session')
        const token = raw ? (JSON.parse(raw) as { token: string }).token : null
        const res = await fetch(`/api/__mock${path}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        return res.json()
      },
      { path, body },
    ) as Promise<T>
  }

  scenario(scenario: Scenario) {
    return this.call('/scenario', { scenario })
  }
  expireSession() {
    return this.call('/session/expire', {})
  }
  updateEdition(nftId: string, editionId: string, patch: { price?: string; available?: number }) {
    return this.call(`/nfts/${nftId}/editions/${editionId}`, patch)
  }
  dropRealtime() {
    return this.call('/realtime/drop', {})
  }
  state() {
    return this.call<{ scenario: string; connections: Array<{ id: number; userId: string | null; nftIds: string[] }> }>('/state')
  }
}

/** Opens the app with the scenario applied and the seed restored. */
export async function boot(page: Page, path = '/', scenario: Scenario = 'fast') {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}resetMocks=1&scenario=${scenario}`)
}

export async function login(page: Page, user: { email: string; password: string } = USERS.nova) {
  await page.getByPlaceholder('contato@email.com').fill(user.email)
  await page.getByPlaceholder('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Signs in through /entrar and returns to the destination. */
export async function signIn(page: Page, user: (typeof USERS)[keyof typeof USERS] = USERS.nova, redirect = '/') {
  await page.goto(`/entrar?redirect=${encodeURIComponent(redirect)}`)
  await login(page, user)
  await page.waitForURL((url) => url.pathname === redirect.split('?')[0])
}

export async function addToCart(page: Page, slug: string, opts: { edition?: string; quantity?: number } = {}) {
  await page.goto(`/nft/${slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  if (opts.edition) await page.getByRole('radio', { name: new RegExp(`^Edição ${opts.edition.replace('/', '\\/')},`) }).click()
  const isMobile = (page.viewportSize()?.width ?? 1440) < 768
  for (let i = 1; i < (opts.quantity ?? 1); i++) {
    await page
      .getByRole('button', { name: /^Aumentar quantidade/ })
      .filter({ visible: true })
      .first()
      .click()
  }
  await page.getByRole('button', { name: isMobile ? 'Comprar NFT' : 'COMPRAR' }).click()
  await page.waitForURL('**/carrinho')
  await expect(page.getByTestId('cart-row').first()).toBeVisible()
}

export async function connectWallet(page: Page) {
  await page.getByRole('button', { name: /Conectar carteira/ }).click()
  await expect(page.getByText(/Carteira conectada \(/)).toBeVisible()
}

export const test = base.extend<{ mock: MockControl }>({
  mock: async ({ page }, use) => {
    await use(new MockControl(page))
  },
})

export { expect }

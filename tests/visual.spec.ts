import { addToCart, boot, connectWallet, expect, signIn, test } from './fixtures'
import type { Page } from '@playwright/test'

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
  // lazy images below the fold never load in a viewport screenshot: wait only for eager ones
  await page.evaluate(() =>
    Promise.all(
      [...document.images].filter((i) => !i.complete && i.loading !== 'lazy').map((i) => new Promise((r) => (i.onload = i.onerror = r))),
    ),
  )
}

test.describe('Visual regression @mobile', () => {
  test('home', async ({ page }) => {
    await boot(page)
    await expect(page.locator('#mercado article').first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png')
  })

  test('detail', async ({ page }) => {
    await boot(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png')
  })

  test('cart', async ({ page }) => {
    await boot(page)
    await addToCart(page, 'emerald-ape-042', { quantity: 2 })
    await addToCart(page, 'violet-nomad-314')
    await expect(page.getByTestId('summary-total').filter({ visible: true })).toHaveText('3.786 ETH')
    await page.mouse.move(0, 0)
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png')
  })

  test('checkout', async ({ page }) => {
    await boot(page)
    await addToCart(page, 'emerald-ape-042')
    await signIn(page, undefined, '/pagamento')
    await connectWallet(page)
    await expect(page.getByTestId('summary-total').filter({ visible: true })).toHaveText('1.206 ETH')
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png')
  })
})

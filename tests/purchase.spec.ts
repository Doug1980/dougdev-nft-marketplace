import { addToCart, boot, connectWallet, expect, login, test } from './fixtures'
import type { Page } from '@playwright/test'

async function ordersCount(page: Page) {
  return page.evaluate(async () => {
    const token = (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token
    const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
    return ((await res.json()) as { items: unknown[] }).items.length
  })
}

async function toCheckout(page: Page) {
  await page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true }).click()
  await page.waitForURL(/\/entrar/)
  await login(page)
  await page.waitForURL('/pagamento')
  await connectWallet(page)
}

test.describe('Purchase', () => {
  test('full purchase from catalog to confirmed receipt @mobile', async ({ page }) => {
    await boot(page)
    await page.locator('#mercado').getByRole('link', { name: 'Ivory Baron #088' }).first().click()
    await expect(page).toHaveURL('/nft/ivory-baron-088')
    await addToCart(page, 'ivory-baron-088', { quantity: 2 })
    await addToCart(page, 'golden-beat-207')
    await toCheckout(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('dialog', { name: 'Revisar pedido' })).toBeVisible()
    await expect(page.getByTestId('review-total')).toHaveText('4.586 ETH') // 3.58 + 0.99 + 0.016
    await page.getByTestId('confirm-order').click()
    await expect(page).toHaveURL(/\/pedidos\/ord_/)
    // pending state may be brief in the fast scenario: accept it or the receipt that follows
    await expect(page.getByText('Aguardando confirmação na rede').or(page.getByText('Seus NFTs agora estão na sua carteira'))).toBeVisible()
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('4.586 ETH')
    await expect(page.getByTestId('tx-id')).toHaveText(/^0x/)

    // the receipt is a snapshot: catalog changes do not alter it
    const url = page.url()
    await page.evaluate(() =>
      fetch('/api/__mock/nfts/nft_ivory-baron-088/editions/1-50', { method: 'POST', body: JSON.stringify({ price: '9.99' }) }),
    )
    await page.goto(url)
    await expect(page.getByTestId('receipt-total')).toHaveText('4.586 ETH')

    // after confirmation, purchased items leave the cart
    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })

  test('declined payment keeps the items', async ({ page, mock }) => {
    await boot(page)
    await addToCart(page, 'golden-beat-207')
    await toCheckout(page)
    await mock.scenario('payment-declined')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-row')).toHaveCount(1)
  })

  test('repeated clicks do not duplicate the order', async ({ page }) => {
    await boot(page)
    await addToCart(page, 'golden-beat-207')
    await toCheckout(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const confirm = page.getByTestId('confirm-order')
    await confirm.dblclick()
    await confirm.click({ force: true }).catch(() => {})
    await expect(page).toHaveURL(/\/pedidos\//)
    expect(await ordersCount(page)).toBe(1)
  })

  test('timeout after order creation recovers the same order via idempotency', async ({ page, mock }) => {
    test.setTimeout(60_000)
    await boot(page)
    await addToCart(page, 'golden-beat-207')
    await toCheckout(page)
    await mock.scenario('order-timeout')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.getByTestId('confirm-order').click()
    // 1st response arrives after the 8 s timeout; the retry with the same key returns the existing order
    await expect(page).toHaveURL(/\/pedidos\//, { timeout: 25_000 })
    expect(await ordersCount(page)).toBe(1)
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 15_000 })
  })

  test('wallet rejection and reconnection', async ({ page, mock }) => {
    await boot(page)
    await addToCart(page, 'golden-beat-207')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await login(page)
    await page.waitForURL('/pagamento')
    await mock.scenario('wallet-rejected')
    await page.getByRole('button', { name: /Conectar carteira/ }).click()
    await expect(page.getByText('A conexão foi recusada na carteira. Aprove a solicitação para continuar.')).toBeVisible()
    await mock.scenario('fast')
    await page.getByRole('button', { name: 'Tentar conectar novamente' }).click()
    await expect(page.getByText(/Carteira conectada \(/)).toBeVisible()
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByRole('button', { name: /Conectar carteira/ })).toBeVisible()
  })
})

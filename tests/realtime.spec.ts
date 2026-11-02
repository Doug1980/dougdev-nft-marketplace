import { addToCart, boot, connectWallet, expect, login, test } from './fixtures'

test.describe('Realtime (Socket.IO via MSW)', () => {
  test('price changes during checkout and confirmation requires a new review', async ({ page, mock }) => {
    await boot(page)
    await addToCart(page, 'golden-beat-207')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await login(page)
    await page.waitForURL('/pagamento')
    await connectWallet(page)
    await expect(page.getByTestId('summary-total')).toHaveText('1.006 ETH')

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const dialog = page.getByRole('dialog', { name: 'Revisar pedido' })
    await expect(dialog.getByTestId('review-total')).toHaveText('1.006 ETH')

    // event emitted by the simulated Socket.IO server (not a direct UI call)
    await mock.updateEdition('nft_golden-beat-207', '1-50', { price: '1.11' })
    await expect(dialog.getByText('Os valores mudaram desde a sua revisão')).toBeVisible()
    await expect(dialog.getByTestId('confirm-order')).toHaveCount(0) // cannot confirm with a stale quote
    await expect(page.getByText(/O preço de Golden Beat #207 mudou/).first()).toBeVisible()

    await dialog.getByRole('button', { name: 'Revisar e aceitar novos valores' }).click()
    await expect(dialog.getByTestId('review-total')).toHaveText('1.126 ETH')
    await dialog.getByTestId('confirm-order').click()
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('1.126 ETH')
  })

  test('edition sells out in the cart and the summary updates', async ({ page, mock }) => {
    await boot(page)
    await addToCart(page, 'golden-beat-207')
    await addToCart(page, 'emerald-ape-042')
    await expect(page.getByTestId('summary-total')).toHaveText('2.196 ETH')
    await mock.updateEdition('nft_golden-beat-207', '1-50', { available: 0 })
    await expect(page.getByText('Esta edição esgotou. Remova o item para finalizar.')).toBeVisible()
    await expect(page.getByTestId('summary-total')).toHaveText('1.206 ETH')
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
    await expect(page.getByTestId('live-assertive')).toContainText('esgotou')
  })

  test('duplicate and stale events do not regress state', async ({ page, mock }) => {
    await boot(page)
    await addToCart(page, 'golden-beat-207')
    await mock.scenario('duplicate-events')
    await mock.updateEdition('nft_golden-beat-207', '1-50', { price: '1.50' })
    await expect(page.getByText(/Preço subiu: era 0.99 ETH, agora 1.50 ETH/)).toBeVisible()
    await page.goto('/nft/golden-beat-207')
    await expect(page.getByText('1.50 ETH').first()).toBeVisible()
    await mock.updateEdition('nft_golden-beat-207', '1-50', { price: '1.60' })
    await expect(page.getByText('1.60 ETH').first()).toBeVisible()
    // after the duplicate delivery + stale event (older version), the latest price remains
    await page.waitForTimeout(800)
    await expect(page.getByText('1.60 ETH').first()).toBeVisible()
    await expect(page.getByText('1.50 ETH')).toHaveCount(0)
  })

  test('connection drop with a pending order, resumed after reconnect and refresh', async ({ page, mock }) => {
    test.setTimeout(60_000)
    await boot(page)
    await addToCart(page, 'golden-beat-207')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await login(page)
    await page.waitForURL('/pagamento')
    await connectWallet(page)
    await mock.scenario('socket-drop')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByText('Aguardando confirmação na rede')).toBeVisible()
    const orderUrl = page.url()

    // reload with a pending order and the socket down: state is recovered via REST
    await page.reload()
    await expect(page).toHaveURL(orderUrl)
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 20_000 })

    // going back to checkout does not create another purchase
    await page.goto('/carrinho')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    const count = await page.evaluate(async () => {
      const token = (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token
      return ((await (await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })).json()) as { items: unknown[] }).items
        .length
    })
    expect(count).toBe(1)
  })

  test('reconnection reconciles the catalog with the REST API', async ({ page, mock }) => {
    await boot(page, '/nft/golden-beat-207')
    await expect(page.getByText('0.99 ETH').first()).toBeVisible()
    await expect.poll(async () => (await mock.state()).connections.some((c) => c.nftIds.includes('nft_golden-beat-207'))).toBe(true)
    await mock.dropRealtime()
    // change happens while the client reconnects; reconciliation fetches the current value
    await page.evaluate(() =>
      fetch('/api/__mock/nfts/nft_golden-beat-207/editions/1-50', { method: 'POST', body: JSON.stringify({ price: '2.22' }) }),
    )
    await expect(page.getByText('2.22 ETH').first()).toBeVisible({ timeout: 10_000 })
  })
})

import { boot, expect, test } from './fixtures'

test.describe('Catalog: search, filters, sorting, pagination and history', () => {
  test('header search is reflected in the URL and results', async ({ page }) => {
    await boot(page)
    await page.getByRole('button', { name: 'Buscar NFTs' }).first().click()
    await page.getByLabel('Termo de busca').fill('Golden')
    const request = page.waitForRequest((r) => r.url().includes('/api/nfts') && r.url().includes('q=Golden'))
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await request
    await expect(page).toHaveURL(/q=Golden/)
    const names = page.locator('#mercado article h3')
    await expect(names.first()).toContainText('Golden')
    for (const name of await names.allTextContents()) expect(name).toMatch(/Golden/)
    await expect(page.getByRole('button', { name: /Remover filtro Busca: "Golden"/ })).toBeVisible()
  })

  test('combined filters send params, reset the page and survive refresh and history', async ({ page }) => {
    await boot(page)
    const market = page.locator('#mercado')
    await market.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)

    const req = page.waitForRequest((r) => /\/api\/nfts\?.*categories=musica/.test(r.url()) && !r.url().includes('page=2'))
    await market.getByRole('button', { name: /^Música/ }).click()
    await req
    await expect(page).not.toHaveURL(/page=2/) // a new filter goes back to page 1

    const req2 = page.waitForRequest((r) => /categories=musica/.test(r.url()) && /networks=polygon/.test(r.url()))
    await market.getByRole('button', { name: /^Polygon/ }).click()
    await req2
    await expect(market.getByRole('button', { name: /^Música/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(market.getByRole('button', { name: /^Polygon/ })).toHaveAttribute('aria-pressed', 'true')
    const filteredCount = await page.getByText(/^\d+ NFTs? encontrados?$/).textContent()

    await page.reload()
    await expect(market.getByRole('button', { name: /^Polygon/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/NFTs? encontrados?$/)).toHaveText(filteredCount!)

    await page.goBack()
    await expect(market.getByRole('button', { name: /^Polygon/ })).toHaveAttribute('aria-pressed', 'false')
    await expect(market.getByRole('button', { name: /^Música/ })).toHaveAttribute('aria-pressed', 'true')
    await page.goForward()
    await expect(market.getByRole('button', { name: /^Polygon/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('sort by lowest price and pagination', async ({ page }) => {
    await boot(page)
    await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price-asc/)
    const prices = page.locator('#mercado article p')
    await expect(prices.first()).toContainText('0.02 ETH')
    await page.locator('#mercado').getByRole('button', { name: 'Próxima página' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('#mercado').getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })

  test('empty result and clearing filters', async ({ page }) => {
    await boot(page, '/?q=inexistente-xyz')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.locator('#mercado').getByRole('button', { name: 'Limpar filtros' }).last().click()
    await expect(page.locator('#mercado article').first()).toBeVisible()
  })

  test('out-of-order responses do not overwrite the current search', async ({ page }) => {
    await boot(page, '/', 'out-of-order')
    const market = page.locator('#mercado')
    await expect(market.locator('article').first()).toBeVisible({ timeout: 10_000 })
    // fast clicks: the old request is canceled/discarded by the query key
    await market.getByRole('button', { name: /^Fotografia/ }).click()
    await market.getByRole('button', { name: /^Solana/ }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('networks')).toContain('solana')
    await expect(page.getByText('Atualizando resultados…')).toBeHidden({ timeout: 10_000 })
    const count = await page.getByText(/^\d+ NFTs? encontrados?$/).textContent()
    const expected = await page.evaluate(
      async () => (await (await fetch('/api/nfts?categories=fotografia&networks=solana&pageSize=9')).json()).total as number,
    )
    expect(count).toContain(String(expected))
  })
})

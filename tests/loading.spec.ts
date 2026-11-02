import { boot, expect, test } from './fixtures'

test.describe('Loading, failures and recovery', () => {
  test('skeletons during slow loading @mobile', async ({ page }) => {
    await boot(page, '/', 'slow')
    await expect(page.getByLabel('Carregando NFTs')).toBeVisible()
    await expect(page.locator('#mercado article').first()).toBeVisible({ timeout: 15_000 })
    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByLabel('Carregando NFT')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 15_000 })
  })

  test('HTTP 500 shows feedback and recovers on retry', async ({ page, mock }) => {
    await boot(page, '/', 'server-error')
    await expect(page.getByText('Erro interno ao carregar os NFTs.')).toBeVisible({ timeout: 15_000 })
    await mock.scenario('fast')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.locator('#mercado article').first()).toBeVisible()
  })

  test('connection failure and recovery', async ({ page, mock }) => {
    await boot(page, '/nft/emerald-ape-042', 'offline')
    await expect(page.getByText('Sem conexão com o servidor. Verifique sua internet.')).toBeVisible({ timeout: 15_000 })
    await mock.scenario('fast')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })

  test('transient failure is recovered by automatic retry', async ({ page }) => {
    await boot(page, '/', 'flaky')
    await expect(page.locator('#mercado article').first()).toBeVisible({ timeout: 15_000 })
  })

  test('empty catalog', async ({ page }) => {
    await boot(page, '/', 'empty-catalog')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
  })
})

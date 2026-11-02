import { boot, expect, test } from './fixtures'

test.describe('NFT detail', () => {
  test('direct access, unavailable edition and quantity limit @mobile', async ({ page }) => {
    await boot(page, '/nft/cosmic-bloom-118')
    await expect(page.getByRole('heading', { level: 1, name: 'Cosmic Bloom #118' })).toBeVisible()
    // seed: the 1/1 edition of this NFT is sold out
    await expect(page.getByRole('radio', { name: /^Edição 1\/1,.*esgotada/ })).toBeDisabled()
    await page.getByRole('radio', { name: /^Edição 1\/10,/ }).click()
    const plus = page
      .getByRole('button', { name: /^Aumentar quantidade/ })
      .filter({ visible: true })
      .first()
    await plus.click()
    await plus.click()
    await expect(plus).toBeDisabled() // max 3 per order on the 1/10 edition
    await expect(page.getByRole('group', { name: 'Cosmic Bloom #118' }).filter({ visible: true }).locator('output')).toHaveText('3')
  })

  test('unknown NFT and unknown route', async ({ page }) => {
    await boot(page, '/nft/nao-existe-999')
    await expect(page.getByText('NFT não encontrado')).toBeVisible()
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })
})

import { boot, expect, test } from './fixtures'

test.describe('Mobile', () => {
  test('search and filters through the drawer @mobile', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'mobile-only flow')
    await boot(page)
    await page.getByRole('searchbox', { name: 'Explorar coleções' }).or(page.getByLabel('Explorar coleções')).fill('Ape')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/q=Ape/)
    await page.getByRole('button', { name: /Filtros e ordenação/ }).click()
    const drawer = page.getByRole('dialog', { name: 'Filtros e ordenação' })
    await drawer.getByRole('button', { name: /^Ethereum/ }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('networks')).toContain('ethereum')
    await drawer.getByRole('button', { name: /^Ver/ }).click()
    await expect(drawer).toBeHidden()
    await expect(page.getByRole('button', { name: /Filtros e ordenação, 1 ativos/ })).toBeVisible()
  })

  test('no horizontal overflow on main screens @mobile', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'verificação do mobile')
    await boot(page)
    for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar', '/cadastro']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
        path,
      ).toBeLessThanOrEqual(0)
    }
  })
})

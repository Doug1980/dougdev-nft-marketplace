import { addToCart, boot, expect, login, test } from './fixtures'

test.describe('Cart', () => {
  test('quantities, removal, coupon and persistence after refresh and login @mobile', async ({ page }) => {
    await boot(page)
    await addToCart(page, 'emerald-ape-042')
    await addToCart(page, 'ivory-baron-088')
    const rows = page.getByTestId('cart-row')
    await expect(rows).toHaveCount(2)

    const total = page.getByTestId('summary-total').filter({ visible: true })
    await expect(total).toHaveText('2.996 ETH') // 1.19 + 1.79 + 0.016

    await page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).filter({ visible: true }).click()
    await expect(total).toHaveText('4.186 ETH')

    await page.getByRole('button', { name: 'Remover Ivory Baron #088 do carrinho' }).filter({ visible: true }).click()
    await expect(rows).toHaveCount(1)
    await expect(total).toHaveText('2.396 ETH')

    const coupon = page.getByRole('textbox', { name: 'Código promocional' }).filter({ visible: true })
    const apply = page.getByRole('button', { name: 'Aplicar' }).filter({ visible: true })
    await coupon.fill('NAOEXISTE')
    await apply.click()
    await expect(page.getByText('Código promocional inválido.').filter({ visible: true })).toBeVisible()
    await coupon.fill('VERAO2025')
    await apply.click()
    await expect(page.getByText('Este código promocional expirou.').filter({ visible: true })).toBeVisible()
    await coupon.fill('kurio10')
    await apply.click()
    await expect(page.getByTestId('summary-discount').filter({ visible: true })).toHaveText('(-) 0.238')
    await expect(total).toHaveText('2.158 ETH') // 2.38 - 0.238 + 0.016

    await page.reload()
    await expect(rows).toHaveCount(1)
    await expect(total).toHaveText('2.158 ETH')

    // guest items are kept after signing in
    await page.goto('/entrar?redirect=%2Fcarrinho')
    await login(page)
    await expect(page).toHaveURL('/carrinho')
    await expect(page.getByTestId('cart-row').getByRole('link', { name: 'Emerald Ape #042' }).filter({ visible: true })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Emerald Ape #042' }).filter({ visible: true }).locator('output')).toHaveText('2')
  })

  test('availability limit per edition', async ({ page }) => {
    await boot(page)
    await addToCart(page, 'emerald-ape-042', { edition: '1/1' })
    await expect(page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).filter({ visible: true })).toBeDisabled()
    await page.goto('/nft/emerald-ape-042')
    await page.getByRole('radio', { name: /^Edição 1\/1,/ }).click()
    await expect(page.getByText(/Você já tem o limite desta edição no carrinho/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'COMPRAR' })).toBeDisabled()
  })
})

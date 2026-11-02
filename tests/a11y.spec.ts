import { boot, expect, test } from './fixtures'

test.describe('Accessibility: keyboard, focus and forms', () => {
  test('skip link and visible focus', async ({ page }) => {
    await boot(page)
    await expect(page.locator('#mercado article').first()).toBeVisible()
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()
  })

  test('dialog traps focus, closes on Esc and returns focus to the trigger', async ({ page }) => {
    await boot(page)
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' }).first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(page.getByLabel('Termo de busca')).toBeFocused()
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('form errors are associated with their fields', async ({ page }) => {
    await boot(page, '/entrar')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = page.getByPlaceholder('contato@email.com')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('Informe o e-mail')
  })

  test('catalog is operable with the keyboard only', async ({ page }) => {
    await boot(page)
    const music = page.locator('#mercado').getByRole('button', { name: /^Música/ })
    await music.focus()
    await page.keyboard.press('Enter')
    await expect(music).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/categories/)
  })
})

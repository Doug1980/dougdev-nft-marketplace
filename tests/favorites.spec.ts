import { boot, expect, signIn, test } from './fixtures'

test.describe('Favorites', () => {
  test('persist for the signed-in user', async ({ page }) => {
    await boot(page)
    await signIn(page, undefined, '/nft/sage-nomad-009')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Favoritado', exact: true })).toHaveAttribute('aria-pressed', 'true')
    // optimistic UI updates first: wait for the server confirmation before reloading
    await expect(page.getByTestId('live-polite')).toContainText('adicionado aos favoritos')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritado', exact: true })).toBeVisible()
    await page.goto('/perfil/favoritos')
    await expect(page.getByRole('heading', { name: 'Sage Nomad #009' })).toBeVisible()
  })

  test('mutation failure rolls back the optimistic update', async ({ page, mock }) => {
    await boot(page)
    await signIn(page, undefined, '/nft/sage-nomad-009')
    await mock.scenario('favorites-fail')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page.getByText(/Não foi possível atualizar "Sage Nomad #009" nos favoritos/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Favoritar', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await mock.scenario('fast')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Favoritado', exact: true })).toBeVisible()
  })

  test('guest is sent to sign-in when favoriting', async ({ page }) => {
    await boot(page, '/nft/sage-nomad-009')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fsage-nomad-009/)
  })
})

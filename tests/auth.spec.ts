import { boot, expect, login, signIn, test, USERS } from './fixtures'

test.describe('Account and session', () => {
  test('sign up with validation, conflict and success', async ({ page }) => {
    await boot(page, '/cadastro')
    await page.getByRole('button', { name: /Criar conta|Criar perfil/ }).click()
    await expect(page.getByText('Use pelo menos 3 caracteres')).toBeVisible()
    await expect(page.getByPlaceholder('Nome de usuário')).toHaveAttribute('aria-invalid', 'true')

    await page.getByPlaceholder('Nome de usuário').fill('novo.colecionador')
    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill(USERS.nova.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill('Senha1234')
    await page.getByPlaceholder('Confirmar senha').fill('Senha1234')
    await page.getByRole('button', { name: /Criar conta|Criar perfil/ }).click()
    await expect(page.getByText('Este e-mail já está cadastrado.')).toBeVisible()

    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('novo@kurio.dev')
    await page.getByRole('button', { name: /Criar conta|Criar perfil/ }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: /Minha conta, novo.colecionador/ })).toBeVisible()
  })

  test('invalid login, return to the previous flow and logout', async ({ page }) => {
    await boot(page, '/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil%2Fcarteiras/)
    await page.getByPlaceholder('contato@email.com').fill(USERS.nova.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill('errada123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
    await login(page)
    await expect(page).toHaveURL('/perfil/carteiras')
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()

    await page.reload() // session restored after refresh
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
  })

  test('session expiry during navigation keeps the destination', async ({ page, mock }) => {
    await boot(page)
    await signIn(page, USERS.nova, '/perfil')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await mock.expireSession()
    // the next private request (this navigation or a background refetch) receives SESSION_EXPIRED;
    // the link may be gone before Playwright clicks it, so the click itself is best effort
    await page
      .getByRole('navigation', { name: 'Meu perfil' })
      .getByRole('link', { name: 'Carteiras' })
      .click({ timeout: 5_000 })
      .catch(() => {})
    await expect(page).toHaveURL(/\/entrar\?redirect=.*perfil.*reason=expired/)
    await expect(page.getByText('Sua sessão expirou. Entre novamente para retomar de onde parou.')).toBeVisible()
    await login(page)
    await expect(page).toHaveURL(/\/perfil/)
  })

  test('switching users clears private data and the previous session socket', async ({ page, mock }) => {
    await boot(page)
    await signIn(page, USERS.nova, '/perfil/favoritos')
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toBeVisible()
    await page.getByRole('button', { name: 'Sair' }).click()
    await signIn(page, USERS.lia, '/perfil/favoritos')
    await expect(page.getByText('Nenhum favorito ainda')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Emerald Ape #042' })).toHaveCount(0)
    await expect.poll(async () => (await mock.state()).connections.map((c) => c.userId)).not.toContain('usr_nova')
  })
})

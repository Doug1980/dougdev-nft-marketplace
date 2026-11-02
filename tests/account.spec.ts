import { boot, expect, login, signIn, test, USERS } from './fixtures'

test.describe('Profile, avatar, password and wallets', () => {
  test('profile edit with validation, conflict and persistence', async ({ page }) => {
    await boot(page)
    await signIn(page, USERS.nova, '/perfil')
    const name = page.getByRole('textbox', { name: /^Nome de exibição/ })
    await expect(name).toHaveValue('Nova Sato')

    await page.getByRole('textbox', { name: /^E-mail/ }).fill('email-invalido')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('E-mail inválido')).toBeVisible()
    await page.getByRole('textbox', { name: /^E-mail/ }).fill(USERS.nova.email)

    await page.getByRole('textbox', { name: /^Nome de usuário/ }).fill('lia.curadora')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()

    await page.getByRole('textbox', { name: /^Nome de usuário/ }).fill('nova.sato')
    await name.fill('Nova S. Colecionadora')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil atualizado.').first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole('textbox', { name: /^Nome de exibição/ })).toHaveValue('Nova S. Colecionadora')
  })

  test('avatar and password change', async ({ page }) => {
    await boot(page)
    await signIn(page, USERS.nova, '/perfil')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    await page.getByTestId('avatar-input').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByRole('img', { name: 'Seu avatar atual' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: 'Seu avatar atual' })).toBeVisible()

    await page.getByLabel('Senha atual').fill('senhaerrada1')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha2026')
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha2026')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha atual incorreta.')).toBeVisible()

    await page.getByLabel('Senha atual').fill(USERS.nova.password)
    await page.getByLabel('Confirmar nova senha').fill('Diferente2026')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('As senhas não coincidem')).toBeVisible()
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha2026')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil e senha atualizados.').first()).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await page.goto('/entrar')
    await login(page, { ...USERS.nova, password: 'NovaSenha2026' })
    await expect(page.getByRole('link', { name: /Minha conta/ })).toBeVisible()
  })

  test('create and edit primary and secondary wallets', async ({ page }) => {
    await boot(page)
    await signIn(page, USERS.lia, '/perfil/carteiras')
    await expect(page.getByText('Você ainda não adicionou uma carteira principal.')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar' }).first().click()
    const primary = page.getByRole('form', { name: 'Carteira principal' })
    await primary.getByRole('textbox', { name: /^Apelido da carteira/ }).fill('Cofre')
    await primary.getByRole('textbox', { name: /^Nome do perfil/ }).fill('lia.kurio')
    await primary.getByRole('textbox', { name: /^Endereço da carteira/ }).fill('0x123')
    await primary.getByRole('textbox', { name: /^Código de indicação/ }).fill('KURIO-LIA')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Endereço 0x inválido (40 hexadecimais)')).toBeVisible()
    await primary.getByRole('textbox', { name: /^Endereço da carteira/ }).fill('0x1111111111111111111111111111111111111111')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva.').first()).toBeVisible()

    await page.getByLabel('Igual à carteira principal').check()
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    await expect(secondary.getByRole('textbox', { name: /^Nome do perfil/ })).toHaveValue('lia.kurio')
    await secondary.getByRole('textbox', { name: /^Endereço da carteira/ }).fill('0x1111111111111111111111111111111111111111')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Este endereço já está cadastrado em outra carteira.')).toBeVisible()
    await secondary.getByRole('textbox', { name: /^Endereço da carteira/ }).fill('0x2222222222222222222222222222222222222222')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.').first()).toBeVisible()

    await page.reload()
    await expect(
      page.getByRole('form', { name: 'Carteira secundária' }).getByRole('textbox', { name: /^Endereço da carteira/ }),
    ).toHaveValue('0x2222222222222222222222222222222222222222')
    // primary wallet edit persists
    await page
      .getByRole('form', { name: 'Carteira principal' })
      .getByRole('textbox', { name: /^Apelido da carteira/ })
      .fill('Cofre Frio')
    await page.getByRole('form', { name: 'Carteira principal' }).getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira principal salva.').first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira principal' }).getByRole('textbox', { name: /^Apelido da carteira/ })).toHaveValue(
      'Cofre Frio',
    )
  })
})

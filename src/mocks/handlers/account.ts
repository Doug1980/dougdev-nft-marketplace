import { HttpResponse } from 'msw'
import { z } from 'zod'
import { avatarInput, networkId, passwordChangeInput, profileInput, type Wallet, walletInput } from '@/api/contracts'
import type { DbWallet } from '../db/seed'
import { db, hashPassword } from '../db/store'
import { toUser } from '../domain'
import { apiError, readJson, requireAuth, route, validationError, zodFields } from '../http'

const MAX_AVATAR_DATA_URL = 2_000_000 // ~1.5 MB image in base64

const toWallet = ({ userId: _user, ...wallet }: DbWallet): Wallet => wallet

export const accountHandlers = [
  // ---------- Profile ----------
  route('get', '/profile', ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const user = db.user(auth.userId)
    return user ? HttpResponse.json(toUser(user)) : apiError(404, 'NOT_FOUND', 'Perfil não encontrado.')
  }),

  route('patch', '/profile', async ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const parsed = profileInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))
    const user = db.user(auth.userId)
    if (!user) return apiError(404, 'NOT_FOUND', 'Perfil não encontrado.')

    const { email, username } = parsed.data
    const fields: Record<string, string> = {}
    const others = db.state.users.filter((u) => u.id !== user.id)
    if (others.some((u) => u.email.toLowerCase() === email.toLowerCase())) fields.email = 'Este e-mail já está em uso por outra conta.'
    if (others.some((u) => u.username.toLowerCase() === username.toLowerCase())) fields.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(fields).length) {
      return apiError(409, fields.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Já existe uma conta com estes dados.', { fields })
    }

    Object.assign(user, parsed.data)
    db.commit()
    return HttpResponse.json(toUser(user))
  }),

  route('put', '/profile/avatar', async ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const parsed = avatarInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))
    if (parsed.data.dataUrl.length > MAX_AVATAR_DATA_URL) return validationError({ dataUrl: 'A imagem deve ter no máximo 1,5 MB.' })
    const user = db.user(auth.userId)
    if (!user) return apiError(404, 'NOT_FOUND', 'Perfil não encontrado.')
    user.avatarUrl = parsed.data.dataUrl
    db.commit()
    return HttpResponse.json(toUser(user))
  }),

  route('delete', '/profile/avatar', ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const user = db.user(auth.userId)
    if (!user) return apiError(404, 'NOT_FOUND', 'Perfil não encontrado.')
    user.avatarUrl = null
    db.commit()
    return HttpResponse.json(toUser(user))
  }),

  route('post', '/profile/password', async ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const parsed = passwordChangeInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))
    const user = db.user(auth.userId)
    if (!user) return apiError(404, 'NOT_FOUND', 'Perfil não encontrado.')
    if ((await hashPassword(parsed.data.currentPassword, user.passwordSalt)) !== user.passwordHash) {
      return validationError({ currentPassword: 'Senha atual incorreta.' })
    }
    user.passwordSalt = crypto.randomUUID().slice(0, 8)
    user.passwordHash = await hashPassword(parsed.data.newPassword, user.passwordSalt)
    db.commit()
    return new HttpResponse(null, { status: 204 })
  }),

  // ---------- Wallets ----------
  route('get', '/wallets', ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    return HttpResponse.json({ items: db.state.wallets.filter((w) => w.userId === auth.userId).map(toWallet) })
  }),

  route('post', '/wallets', async ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const parsed = walletInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))
    const mine = db.state.wallets.filter((w) => w.userId === auth.userId)
    if (mine.some((w) => w.slot === parsed.data.slot))
      return validationError({ slot: 'Já existe uma carteira neste espaço. Edite a existente.' })
    if (mine.some((w) => w.address.toLowerCase() === parsed.data.address.toLowerCase())) {
      return validationError({ address: 'Este endereço já está cadastrado em outra carteira.' })
    }
    const wallet: DbWallet = { ...parsed.data, id: db.nextId('wal'), userId: auth.userId, updatedAt: new Date().toISOString() }
    db.state.wallets.push(wallet)
    db.commit()
    return HttpResponse.json(toWallet(wallet), { status: 201 })
  }),

  route<{ walletId: string }>('put', '/wallets/:walletId', async ({ request, params }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const wallet = db.state.wallets.find((w) => w.id === params.walletId)
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (wallet.userId !== auth.userId) return apiError(403, 'FORBIDDEN', 'Você não tem permissão para editar esta carteira.')
    const parsed = walletInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))
    const duplicate = db.state.wallets.some(
      (w) => w.userId === auth.userId && w.id !== wallet.id && w.address.toLowerCase() === parsed.data.address.toLowerCase(),
    )
    if (duplicate) return validationError({ address: 'Este endereço já está cadastrado em outra carteira.' })
    Object.assign(wallet, parsed.data, { updatedAt: new Date().toISOString() })
    db.commit()
    return HttpResponse.json(toWallet(wallet))
  }),

  // ---------- Simulated wallet connection ----------
  route('post', '/wallet-sessions', async ({ request }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const parsed = z.object({ walletId: z.string(), network: networkId }).safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))
    const wallet = db.state.wallets.find((w) => w.id === parsed.data.walletId && w.userId === auth.userId)
    if (!wallet) return apiError(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (db.state.scenario === 'wallet-rejected') {
      return apiError(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira. Aprove a solicitação para continuar.')
    }
    // Only one active wallet connection per user.
    for (const s of db.state.walletSessions) if (s.userId === auth.userId) s.active = false
    const session = {
      id: db.nextId('wss'),
      walletId: wallet.id,
      userId: auth.userId,
      network: parsed.data.network,
      connectedAt: new Date().toISOString(),
      active: true,
    }
    db.state.walletSessions.push(session)
    db.commit()
    return HttpResponse.json(
      { id: session.id, walletId: wallet.id, network: session.network, address: wallet.address, connectedAt: session.connectedAt },
      { status: 201 },
    )
  }),

  route<{ sessionId: string }>('delete', '/wallet-sessions/:sessionId', ({ request, params }) => {
    const auth = requireAuth(request)
    if (auth instanceof Response) return auth
    const session = db.state.walletSessions.find((s) => s.id === params.sessionId && s.userId === auth.userId)
    if (session) session.active = false
    db.commit()
    return new HttpResponse(null, { status: 204 })
  }),
]

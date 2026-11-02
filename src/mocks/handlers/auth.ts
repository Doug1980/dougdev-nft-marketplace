import { HttpResponse } from 'msw'
import { loginInput, registerInput, type Session } from '@/api/contracts'
import { db, hashPassword, SESSION_TTL_MS } from '../db/store'
import { toUser } from '../domain'
import { apiError, readAuth, readJson, route, validationError, zodFields } from '../http'
import { dropUserConnections } from '../realtime'

function issueSession(userId: string): Session {
  const user = db.user(userId)
  if (!user) throw new Error(`Unknown user ${userId}`)
  const token = `tok_${crypto.randomUUID()}`
  const expiresAt = Date.now() + SESSION_TTL_MS
  db.state.sessions.push({ token, userId, expiresAt, revoked: false })
  db.commit()
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: toUser(user) }
}

export const authHandlers = [
  route('post', '/auth/register', async ({ request }) => {
    const parsed = registerInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))
    const { username, email, password } = parsed.data

    const fields: Record<string, string> = {}
    if (db.state.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) fields.email = 'Este e-mail já está cadastrado.'
    if (db.state.users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
      fields.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(fields).length) {
      return apiError(409, fields.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Já existe uma conta com estes dados.', { fields })
    }

    const salt = crypto.randomUUID().slice(0, 8)
    const id = db.nextId('usr')
    db.state.users.push({
      id,
      username,
      email,
      displayName: username,
      ensName: username.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
      walletNickname: 'Principal',
      avatarUrl: null,
      passwordSalt: salt,
      passwordHash: await hashPassword(password, salt),
    })
    db.state.favorites[id] = []
    return HttpResponse.json(issueSession(id), { status: 201 })
  }),

  route('post', '/auth/login', async ({ request }) => {
    const parsed = loginInput.safeParse(await readJson(request))
    if (!parsed.success) return validationError(zodFields(parsed.error.issues))
    const user = db.state.users.find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase())
    const valid = user && (await hashPassword(parsed.data.password, user.passwordSalt)) === user.passwordHash
    if (!user || !valid) return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
    return HttpResponse.json(issueSession(user.id))
  }),

  route('get', '/auth/session', ({ request }) => {
    const auth = readAuth(request)
    if (auth.kind === 'anonymous') return apiError(401, 'UNAUTHORIZED', 'Nenhuma sessão ativa.')
    if (auth.kind === 'expired') return apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
    const user = db.user(auth.userId)
    if (!user) return apiError(401, 'UNAUTHORIZED', 'Nenhuma sessão ativa.')
    return HttpResponse.json({ expiresAt: new Date(auth.session.expiresAt).toISOString(), user: toUser(user) })
  }),

  route('post', '/auth/logout', ({ request }) => {
    const auth = readAuth(request)
    if (auth.kind === 'ok') {
      auth.session.revoked = true
      for (const ws of db.state.walletSessions) if (ws.userId === auth.userId) ws.active = false
      db.commit()
      dropUserConnections(auth.userId)
    }
    return new HttpResponse(null, { status: 204 })
  }),
]

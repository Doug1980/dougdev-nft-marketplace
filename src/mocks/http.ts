import { type DefaultBodyType, delay, HttpResponse, type HttpResponseResolver, http, type PathParams } from 'msw'
import type { ErrorCode } from '@/api/contracts'
import { env } from '@/lib/env'
import { type DbSession, db } from './db/store'
import { latencyFor } from './scenarios'

export const api = (path: string) => `${env.apiUrl}${path}`

export function apiError(status: number, code: ErrorCode, message: string, extra?: { fields?: Record<string, string>; details?: unknown }) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status })
}

export function validationError(fields: Record<string, string>, message = 'Verifique os campos destacados.') {
  return apiError(422, 'VALIDATION_ERROR', message, { fields })
}

/** Zod issues -> { field: message }, first message per field. */
export function zodFields(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  const fields: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    fields[key] ??= issue.message
  }
  return fields
}

type AuthResult = { kind: 'anonymous' } | { kind: 'expired' } | { kind: 'ok'; session: DbSession; userId: string }

export function readAuth(request: Request): AuthResult {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return { kind: 'anonymous' }
  const token = header.slice('Bearer '.length)
  const session = db.state.sessions.find((s) => s.token === token)
  if (!session || session.revoked || session.expiresAt <= Date.now()) return { kind: 'expired' }
  return { kind: 'ok', session, userId: session.userId }
}

export function requireAuth(request: Request): { userId: string; session: DbSession } | Response {
  const auth = readAuth(request)
  if (auth.kind === 'ok') return auth
  if (auth.kind === 'expired') return apiError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  return apiError(401, 'UNAUTHORIZED', 'Entre na sua conta para continuar.')
}

export async function readJson<T = unknown>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'
type RouteKind = 'catalog' | 'detail' | 'default'

let requestSeq = 0

/** Registers a route and applies the active scenario (latency, network failure, 5xx, transient 503) before the resolver. */
export function route<P extends PathParams = PathParams>(
  method: Method,
  path: string,
  resolver: HttpResponseResolver<P, DefaultBodyType>,
  kind: RouteKind = 'default',
) {
  return http[method]<P>(api(path), async (info) => {
    const scenario = db.state.scenario
    requestSeq += 1
    await delay(latencyFor(scenario, requestSeq))

    if (scenario === 'offline') return HttpResponse.error()
    if (scenario === 'server-error' && kind !== 'default') {
      return apiError(500, 'INTERNAL_ERROR', 'Erro interno ao carregar os NFTs.')
    }
    if (scenario === 'flaky') {
      const key = `${method}:${path}`
      db.state.hits[key] = (db.state.hits[key] ?? 0) + 1
      db.commit()
      if (db.state.hits[key] === 1) return apiError(503, 'SERVICE_UNAVAILABLE', 'Serviço temporariamente indisponível. Tente novamente.')
    }
    return resolver(info)
  })
}

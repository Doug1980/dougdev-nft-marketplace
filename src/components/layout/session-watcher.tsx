import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { clearPrivateCache } from '@/features/auth'
import { announce } from '@/lib/announcer'
import { useSession } from '@/lib/session-store'

const PRIVATE_PREFIXES = ['/pagamento', '/pedidos', '/perfil']
const EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente para continuar de onde parou.'

/**
 * Reacts to session expiry anywhere in the app (the Axios interceptor clears the session on SESSION_EXPIRED).
 * Drops private cache and, on a private screen, goes to sign-in keeping the current URL to come back to.
 * Renders nothing.
 */
export function SessionWatcher() {
  const session = useSession()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location })
  const previousStatus = useRef(session.status)

  useEffect(() => {
    const wasAuthenticated = previousStatus.current === 'authenticated'
    previousStatus.current = session.status
    // Only the transition authenticated -> expired matters (not logout, not first load).
    if (!wasAuthenticated || session.status !== 'anonymous' || session.reason !== 'expired') return

    clearPrivateCache(qc)
    toast.warning(EXPIRED_MESSAGE, { id: 'session-expired' })
    announce(EXPIRED_MESSAGE, 'assertive')
    if (PRIVATE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) {
      void navigate({ to: '/entrar', search: { redirect: location.href, reason: 'expired' }, replace: true })
    }
  }, [session, qc, navigate, location])

  return null
}

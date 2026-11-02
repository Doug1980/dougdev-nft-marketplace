import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'
import { announce } from '@/lib/announcer'
import { useSession } from '@/lib/session-store'
import { applyNftEvent, applyOrderEvent } from './apply-events'
import { RealtimeClient, type RealtimeStatus } from './client'
import { RealtimeContext } from './context'

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const session = useSession()
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [client] = useState(
    () =>
      new RealtimeClient({
        onNftUpdated: (event) => applyNftEvent(qc, event),
        onOrderUpdated: (event) => applyOrderEvent(qc, event),
        onStatus: setStatus,
        onReconnected: () => {
          // Reconciliation: every active query is revalidated against REST.
          void qc.invalidateQueries({ type: 'active' })
          announce('Conexão em tempo real restabelecida. Dados atualizados.')
        },
      }),
  )

  const token = session.status === 'authenticated' ? session.token : null
  const userId = session.status === 'authenticated' ? session.user.id : null

  useEffect(() => {
    client.connect(token, userId)
  }, [client, token, userId])

  useEffect(() => () => client.teardown(), [client])

  return <RealtimeContext.Provider value={{ client, status }}>{children}</RealtimeContext.Provider>
}

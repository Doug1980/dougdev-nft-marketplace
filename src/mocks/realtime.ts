/**
 * Simulated Socket.IO server on top of MSW's `ws` handler + @mswjs/socket.io-binding.
 * The real socket.io-client connects over WebSocket; MSW intercepts it in the browser.
 *
 * Protocol:
 *  - auth: session token in the connection query (`?token=`);
 *  - `subscribe` / `unsubscribe` with `{ nftIds }` scope `nft.updated` per connection;
 *  - `order.updated` is delivered only to the order owner's connections.
 */
import { toSocketIo } from '@mswjs/socket.io-binding'
import { type WebSocketHandlerConnection, ws } from 'msw'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'
import { env } from '@/lib/env'
import type { DbNft } from './db/seed'
import { type DbOrder, db } from './db/store'

type Connection = {
  id: number
  userId: string | null
  nftIds: Set<string>
  io: ReturnType<typeof toSocketIo>
  raw: WebSocketHandlerConnection
  ping: ReturnType<typeof setInterval>
}

const connections = new Map<number, Connection>()
let connectionSeq = 0
/** While in the future, new connections are refused (simulated outage). */
let blockedUntil = 0

// MSW strips the `/socket.io/` path before matching, so the origin is enough.
export const socketLink = ws.link(env.socketUrl)

function resolveUser(url: URL): string | null {
  const token = url.searchParams.get('token')
  if (!token) return null
  const session = db.state.sessions.find((s) => s.token === token && !s.revoked && s.expiresAt > Date.now())
  return session?.userId ?? null
}

export const realtimeHandler = socketLink.addEventListener('connection', (connection) => {
  const { client } = connection
  if (db.state.scenario === 'offline' || Date.now() < blockedUntil) {
    client.close(1011, 'offline')
    return
  }

  const io = toSocketIo(connection)
  const id = ++connectionSeq
  const conn: Connection = {
    id,
    userId: resolveUser(client.url),
    nftIds: new Set(),
    io,
    raw: connection,
    // The binding does not send Engine.IO pings; without them the client drops after pingInterval + pingTimeout.
    ping: setInterval(() => {
      try {
        client.send('2')
      } catch {
        // Connection already closed.
      }
    }, 20_000),
  }
  connections.set(id, conn)

  io.client.on('subscribe', (_event, payload: { nftIds?: string[] }) => {
    for (const nftId of payload?.nftIds ?? []) conn.nftIds.add(nftId)
  })
  io.client.on('unsubscribe', (_event, payload: { nftIds?: string[] }) => {
    for (const nftId of payload?.nftIds ?? []) conn.nftIds.delete(nftId)
  })

  client.addEventListener('close', () => {
    clearInterval(conn.ping)
    connections.delete(id)
  })
})

function deliver(targets: Connection[], event: string, payload: object, stale?: object) {
  const duplicate = db.state.scenario === 'duplicate-events'
  for (const target of targets) {
    target.io.client.emit(event, payload)
    if (duplicate) {
      target.io.client.emit(event, payload)
      if (stale) target.io.client.emit(event, stale)
    }
  }
}

function buildNftEvent(nft: DbNft, eventId: string): NftUpdatedEvent {
  return {
    eventId,
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      nftId: nft.id,
      price: nft.editions.find((e) => e.id === '1-50')?.price ?? '0',
      compareAtPrice: nft.compareAtPrice,
      totalAvailable: nft.editions.reduce((acc, e) => acc + e.available, 0),
      editions: nft.editions.map(({ id, price, available }) => ({ id, price, available })),
    },
  }
}

/** `previous` is replayed as a stale event in the duplicate-events scenario. */
export function emitNftUpdated(nft: DbNft, previous?: DbNft) {
  const event = buildNftEvent(nft, db.nextEventId())
  const stale = previous ? buildNftEvent(previous, db.nextEventId()) : undefined
  db.commit()
  const targets = [...connections.values()].filter((c) => c.nftIds.has(nft.id))
  deliver(targets, 'nft.updated', event, stale)
}

export function emitOrderUpdated(order: DbOrder) {
  const event: OrderUpdatedEvent = {
    eventId: db.nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    userId: order.userId,
    data: { orderId: order.id, status: order.status, txHash: order.txHash, rejectionReason: order.rejectionReason },
  }
  const stale: OrderUpdatedEvent | undefined =
    order.version > 1
      ? {
          ...event,
          eventId: db.nextEventId(),
          version: order.version - 1,
          data: { ...event.data, status: 'pending', txHash: null, rejectionReason: null },
        }
      : undefined
  db.commit()
  const targets = [...connections.values()].filter((c) => c.userId === order.userId)
  deliver(targets, 'order.updated', event, stale)
}

export function blockRealtime(ms: number) {
  blockedUntil = Date.now() + ms
}

/** Drops every connection (socket-drop scenario and the demo panel). */
export function dropAllConnections() {
  for (const c of connections.values()) {
    clearInterval(c.ping)
    c.raw.client.close(1012, 'simulated drop')
  }
  connections.clear()
}

/** Closes a user's connections on logout so stale subscriptions never outlive the session. */
export function dropUserConnections(userId: string) {
  for (const c of [...connections.values()]) {
    if (c.userId !== userId) continue
    clearInterval(c.ping)
    c.raw.client.close(4001, 'session ended')
    connections.delete(c.id)
  }
}

export function connectionStats() {
  return [...connections.values()].map((c) => ({ id: c.id, userId: c.userId, nftIds: [...c.nftIds] }))
}

/**
 * Socket.IO client wrapper.
 *  - one connection per session: switching users tears down the previous socket and listeners;
 *  - ref-counted NFT subscriptions, released when the last consumer unmounts;
 *  - dedupe by eventId and drop by version (no regression, no replayed effects);
 *  - on reconnect, resubscribes and triggers REST reconciliation.
 */
import { io, type Socket } from 'socket.io-client'
import { type NftUpdatedEvent, nftUpdatedEvent, type OrderUpdatedEvent, orderUpdatedEvent } from '@/api/contracts'
import { env } from '@/lib/env'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected'

type Handlers = {
  onNftUpdated: (event: NftUpdatedEvent) => void
  onOrderUpdated: (event: OrderUpdatedEvent) => void
  onReconnected: () => void
  onStatus: (status: RealtimeStatus) => void
}

const MAX_SEEN_EVENTS = 500

export class RealtimeClient {
  private readonly handlers: Handlers
  private socket: Socket | null = null
  private token: string | null | undefined
  private userId: string | null = null
  private refs = new Map<string, number>()
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private hasConnectedBefore = false
  private status: RealtimeStatus = 'idle'

  constructor(handlers: Handlers) {
    this.handlers = handlers
  }

  /** (Re)connects with the current identity. Called whenever the session changes. */
  connect(token: string | null, userId: string | null) {
    if (this.socket && this.token === token) return
    this.teardown()
    this.token = token
    this.userId = userId
    this.setStatus('connecting')

    const socket = io(env.socketUrl, {
      // MSW intercepts WebSocket only; HTTP long-polling would bypass the Socket.IO binding.
      transports: ['websocket'],
      query: token ? { token } : {},
      reconnectionDelay: 400,
      reconnectionDelayMax: 2500,
      timeout: 4000,
    })

    socket.on('connect', () => {
      this.setStatus('connected')
      if (this.refs.size) socket.emit('subscribe', { nftIds: [...this.refs.keys()] })
      if (this.hasConnectedBefore) this.handlers.onReconnected()
      this.hasConnectedBefore = true
    })
    socket.on('disconnect', () => this.setStatus('disconnected'))
    socket.on('connect_error', () => this.setStatus('disconnected'))

    socket.on('nft.updated', (raw: unknown) => {
      const event = nftUpdatedEvent.safeParse(raw)
      if (event.success && this.accept(event.data.eventId, `nft:${event.data.resource.id}`, event.data.version)) {
        this.handlers.onNftUpdated(event.data)
      }
    })
    socket.on('order.updated', (raw: unknown) => {
      const event = orderUpdatedEvent.safeParse(raw)
      // Events from another identity never touch local state.
      if (!event.success || event.data.userId !== this.userId) return
      if (this.accept(event.data.eventId, `order:${event.data.resource.id}`, event.data.version)) {
        this.handlers.onOrderUpdated(event.data)
      }
    })

    this.socket = socket
  }

  /** Accepts an event only if unseen and newer than the last known version of its resource. */
  private accept(eventId: string, resourceKey: string, version: number) {
    if (this.seen.has(eventId)) return false
    this.seen.add(eventId)
    if (this.seen.size > MAX_SEEN_EVENTS) {
      const oldest = this.seen.values().next().value
      if (oldest) this.seen.delete(oldest)
    }
    if (version <= (this.versions.get(resourceKey) ?? 0)) return false
    this.versions.set(resourceKey, version)
    return true
  }

  /** Records a version already known from REST so older events are dropped. */
  observeVersion(resourceKey: string, version: number) {
    if (version > (this.versions.get(resourceKey) ?? 0)) this.versions.set(resourceKey, version)
  }

  /** Ref-counted subscription. Returns the cleanup function. */
  subscribe(nftIds: string[]): () => void {
    const added = nftIds.filter((id) => {
      const count = this.refs.get(id) ?? 0
      this.refs.set(id, count + 1)
      return count === 0
    })
    if (added.length && this.socket?.connected) this.socket.emit('subscribe', { nftIds: added })

    return () => {
      const released = nftIds.filter((id) => {
        const count = (this.refs.get(id) ?? 1) - 1
        if (count > 0) this.refs.set(id, count)
        else this.refs.delete(id)
        return count <= 0
      })
      if (released.length && this.socket?.connected) this.socket.emit('unsubscribe', { nftIds: released })
    }
  }

  private setStatus(status: RealtimeStatus) {
    if (this.status === status) return
    this.status = status
    this.handlers.onStatus(status)
  }

  teardown() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect()
      this.socket = null
    }
    this.seen.clear()
    this.versions.clear()
    this.hasConnectedBefore = false
    this.token = undefined
    this.setStatus('idle')
  }
}

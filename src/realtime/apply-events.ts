import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart, CatalogPage, NftDetail, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { announce } from '@/lib/announcer'
import { formatEth } from '@/lib/money'
import { qk } from '@/lib/query'
import { sessionStore } from '@/lib/session-store'

/** Patches price/stock in place on detail and every cached catalog page; cart and quote are revalidated via REST. */
export function applyNftEvent(qc: QueryClient, event: NftUpdatedEvent) {
  const { data, version } = event

  qc.setQueriesData<NftDetail>({ queryKey: qk.nftAll }, (old) => {
    if (!old || old.id !== data.nftId || old.version >= version) return old
    return {
      ...old,
      version,
      price: data.price,
      compareAtPrice: data.compareAtPrice,
      totalAvailable: data.totalAvailable,
      editions: old.editions.map((edition) => {
        const next = data.editions.find((e) => e.id === edition.id)
        return next ? { ...edition, price: next.price, available: next.available } : edition
      }),
    }
  })

  qc.setQueriesData<CatalogPage>({ queryKey: qk.catalogAll }, (old) => {
    if (!old) return old
    const patch = (item: CatalogPage['items'][number]) =>
      item.id === data.nftId && item.version < version
        ? { ...item, version, price: data.price, compareAtPrice: data.compareAtPrice, totalAvailable: data.totalAvailable }
        : item
    return { ...old, items: old.items.map(patch), featured: old.featured ? patch(old.featured) : null }
  })

  const cartItem = qc
    .getQueriesData<Cart>({ queryKey: qk.cartAll })
    .flatMap(([, cart]) => cart?.items ?? [])
    .find((item) => item.nftId === data.nftId)
  if (cartItem) {
    const edition = data.editions.find((e) => e.id === cartItem.editionId)
    let message: string | null = null
    if (edition?.available === 0) message = `${cartItem.name} (${cartItem.editionLabel}) esgotou.`
    else if (edition && edition.available < cartItem.quantity) message = `Restam apenas ${edition.available} de ${cartItem.name}.`
    else if (edition && edition.price !== cartItem.unitPrice)
      message = `O preço de ${cartItem.name} mudou para ${formatEth(edition.price)}.`
    if (message) {
      toast.warning(message, { id: `nft-${data.nftId}` })
      announce(message, 'assertive')
    }
    void qc.invalidateQueries({ queryKey: qk.cartAll })
    void qc.invalidateQueries({ queryKey: qk.quoteAll })
  }
}

export function applyOrderEvent(qc: QueryClient, event: OrderUpdatedEvent) {
  const userId = sessionStore.userId()
  if (!userId || userId !== event.userId) return

  const key = qk.order(userId, event.data.orderId)
  qc.setQueryData<Order>(key, (old) =>
    old && old.version < event.version
      ? {
          ...old,
          version: event.version,
          status: event.data.status,
          txHash: event.data.txHash,
          rejectionReason: event.data.rejectionReason,
        }
      : old,
  )
  // Full receipt (explorer URL, snapshot) comes from REST.
  void qc.invalidateQueries({ queryKey: key })
  void qc.invalidateQueries({ queryKey: qk.pendingOrders(userId) })

  if (event.data.status !== 'pending') {
    void qc.invalidateQueries({ queryKey: qk.cartAll })
    void qc.invalidateQueries({ queryKey: qk.quoteAll })
    announce(
      event.data.status === 'confirmed' ? 'Pagamento confirmado na rede.' : 'Pagamento recusado. Seus itens continuam no carrinho.',
      'assertive',
    )
  }
}

import { Link, useRouterState } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { usePendingOrders } from '@/features/orders'

/** Recovery after reload or reconnection: a pending order stays visible and reachable from any page. */
export function PendingOrderBanner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data } = usePendingOrders()
  const pending = data?.[0]
  if (!pending || pathname.startsWith('/pedidos/')) return null

  return (
    <div role="status" className="container-site mt-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-primary/60 bg-surface px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
          Você tem um pedido aguardando confirmação na rede.
        </span>
        <Link to="/pedidos/$orderId" params={{ orderId: pending.id }} className="font-bold text-brand underline-offset-4 hover:underline">
          Acompanhar pedido
        </Link>
      </div>
    </div>
  )
}

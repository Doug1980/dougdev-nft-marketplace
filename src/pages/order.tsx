import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { CircleX, LoaderCircle, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { NETWORK_LABELS, type Order, WALLET_TYPE_LABELS } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { ThankYouIcon } from '@/components/shared/brand-icons'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrder } from '@/features/orders'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatDiscount, formatEth } from '@/lib/money'
import { shortAddress } from '@/lib/utils'
import { useRealtime } from '@/realtime/context'

const routeApi = getRouteApi('/pedidos/$orderId')
const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

/** Explorer name follows the order network (the link itself points to the simulated explorer). */
const EXPLORER_LABELS: Record<Order['network'], string> = {
  ethereum: 'Etherscan',
  polygon: 'Polygonscan',
  solana: 'Solscan',
}

const TITLES: Record<Order['status'], string> = {
  pending: 'Pedido pendente | Kurio',
  confirmed: 'Pedido confirmado | Kurio',
  rejected: 'Pagamento recusado | Kurio',
}

/** Card from the "Thank you" frame: orange bottom bar, centered on desktop. */
function OrderCard({ label, onClose, children }: { label: string; onClose?: () => void; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="relative mx-auto mt-6 w-full max-w-[578px] border-b-[10px] border-primary bg-surface md:mt-[120px]"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar e voltar ao início"
          className="absolute top-5 right-5 text-brand hover:text-foreground"
        >
          <X className="size-5" aria-hidden />
        </button>
      )}
      {children}
    </section>
  )
}

/** Receipt renders the order snapshot (lines, fees and total frozen at creation), never the current catalog. */
function Receipt({ order }: { order: Order }) {
  const navigate = useNavigate()
  return (
    <OrderCard label="Pedido confirmado" onClose={() => void navigate({ to: '/' })}>
      <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-5 text-brand">
        <ThankYouIcon />
        <h1 className="text-center text-base font-bold text-muted-foreground">Seus NFTs agora estão na sua carteira</h1>
      </div>

      <dl className="grid grid-cols-2 gap-y-2 border-y border-primary px-6 py-3 text-sm text-muted-foreground sm:grid-cols-4 sm:divide-x sm:divide-primary">
        <div className="sm:pr-3">
          <dt className="font-bold">ID da transação</dt>
          <dd data-testid="tx-id">{order.txHash ? shortAddress(order.txHash) : '-'}</dd>
        </div>
        <div className="sm:px-3">
          <dt>Data</dt>
          <dd>{dateFormat.format(new Date(order.updatedAt))}</dd>
        </div>
        <div className="sm:px-3">
          <dt>Total</dt>
          <dd className="whitespace-nowrap">{formatEth(order.total)}</dd>
        </div>
        <div className="sm:pl-3">
          <dt className="font-bold">Carteira</dt>
          <dd>{WALLET_TYPE_LABELS[order.wallet.walletType]}</dd>
        </div>
      </dl>

      <div className="px-6 pt-6 pb-12 md:px-11">
        <h2 className="text-base font-bold">Detalhes da transação</h2>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Itens comprados</caption>
          <thead>
            <tr className="border-b border-border text-base">
              <th scope="col" className="pb-2 font-bold">
                NFTs
              </th>
              <th scope="col" className="pb-2 text-center font-bold">
                Edições
              </th>
              <th scope="col" className="pb-2 text-right font-bold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.itemId}>
                <td className="py-2">
                  <span className="flex items-center gap-3">
                    <img src={line.image} alt="" width={70} height={70} className="size-[60px] rounded object-cover sm:size-[70px]" />
                    <span>
                      <span className="block text-base font-bold">{line.name}</span>
                      <span className="block text-sm text-subtle">
                        ID do token: {line.tokenId} · {line.editionLabel}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="text-center text-sm">(x {line.quantity})</td>
                <td className="text-right text-lg font-bold whitespace-nowrap text-brand">{formatEth(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-3 ml-auto grid max-w-xs grid-cols-2 gap-y-1 border-b border-border pb-2 text-base">
          {order.couponCode && (
            <>
              <dt>Desconto ({order.couponCode})</dt>
              <dd className="text-right whitespace-nowrap">{formatDiscount(order.discount)}</dd>
            </>
          )}
          <dt>Taxa de rede</dt>
          <dd className="text-right text-lg whitespace-nowrap">{formatEth(order.networkFee)}</dd>
          <dt className="font-bold">Total</dt>
          <dd data-testid="receipt-total" className="text-right text-lg font-bold whitespace-nowrap text-brand">
            {formatEth(order.total)}
          </dd>
        </dl>

        <p className="mt-4 text-center text-sm leading-[22px] text-muted-foreground">
          Transação confirmada na {NETWORK_LABELS[order.network]}. A propriedade foi transferida para sua carteira conectada e registrada na
          rede.
        </p>
        {order.explorerUrl && (
          <div className="mt-6 flex justify-center">
            <Button asChild className="h-12 rounded-[2px] text-base">
              <a href={order.explorerUrl}>
                Ver no {EXPLORER_LABELS[order.network]}
                <span className="sr-only"> (explorador simulado)</span>
              </a>
            </Button>
          </div>
        )}
      </div>
    </OrderCard>
  )
}

function Pending({ order }: { order: Order }) {
  const { status: realtime } = useRealtime()
  return (
    <OrderCard label="Pedido pendente">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <LoaderCircle className="size-10 animate-spin text-brand" aria-hidden />
        <h1 className="text-xl font-bold">Aguardando confirmação na rede</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Seu pedido {order.id} foi enviado e está sendo processado na {NETWORK_LABELS[order.network]}. Você pode recarregar ou sair desta
          página: o status será recuperado.
        </p>
        <p className="text-lg font-bold text-brand">{formatEth(order.total)}</p>
        {realtime !== 'connected' && (
          <p className="text-xs text-subtle">Conexão em tempo real indisponível. Verificando o status periodicamente…</p>
        )}
      </div>
    </OrderCard>
  )
}

function Rejected({ order }: { order: Order }) {
  return (
    <OrderCard label="Pagamento recusado">
      <div role="alert" className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <CircleX className="size-10 text-destructive" aria-hidden />
        <h1 className="text-xl font-bold">Pagamento recusado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {order.rejectionReason ?? 'A rede recusou a transação.'} Seus itens continuam no carrinho.
        </p>
        <Button asChild className="mt-2">
          <Link to="/carrinho">Voltar ao carrinho</Link>
        </Button>
      </div>
    </OrderCard>
  )
}

export function OrderPage() {
  const { orderId } = routeApi.useParams()
  const { data: order, isPending, isError, error, refetch, isFetching } = useOrder(orderId)
  useDocumentTitle(order ? TITLES[order.status] : 'Pedido | Kurio')

  if (isPending) {
    return (
      <div className="container-site">
        <Skeleton className="mx-auto mt-6 h-[520px] max-w-[578px] md:mt-[120px]" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="container-site py-16">
        {toApiError(error).code === 'NOT_FOUND' ? (
          <EmptyState title="Pedido não encontrado" description="Este pedido não existe ou pertence a outra conta." />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />
        )}
      </div>
    )
  }

  return (
    <div className="container-site pb-16">
      {order.status === 'confirmed' ? (
        <Receipt order={order} />
      ) : order.status === 'pending' ? (
        <Pending order={order} />
      ) : (
        <Rejected order={order} />
      )}
    </div>
  )
}

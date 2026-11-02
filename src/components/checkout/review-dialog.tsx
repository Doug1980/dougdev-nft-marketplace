import { Link } from '@tanstack/react-router'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { NETWORK_LABELS, type NetworkId, type Quote, WALLET_TYPE_LABELS, type Wallet } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useCart } from '@/features/cart'
import { formatDiscount, formatEth } from '@/lib/money'
import { shortAddress } from '@/lib/utils'

/**
 * Final review before paying. If the quote changed (price, stock, coupon or fee), confirmation is replaced
 * by "accept new values": the user never pays an amount different from the one on screen.
 */
export function ReviewDialog({
  open,
  onOpenChange,
  quote,
  stale,
  wallet,
  network,
  submitting,
  error,
  onAccept,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote | undefined
  stale: Quote['issues'] | null
  wallet: Wallet | undefined
  network: NetworkId
  submitting: boolean
  error: string | null
  onAccept: () => void
  onConfirm: () => void
}) {
  const cart = useCart()
  const needsCartChanges = stale?.some((issue) => issue.kind !== 'price_changed') ?? false

  return (
    // Cannot be closed while the order is being sent.
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-[578px] px-6 pt-8 pb-8 md:px-10">
        <DialogTitle className="text-center">Revisar pedido</DialogTitle>
        <DialogDescription className="mt-1 text-center">
          Confira os valores antes de confirmar. A cotação da API é a referência final.
        </DialogDescription>

        {stale && (
          <div role="alert" className="mt-5 rounded-[4px] border border-destructive/60 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-bold text-destructive">
              <TriangleAlert className="size-4" aria-hidden /> Os valores mudaram desde a sua revisão
            </p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              {stale.length ? (
                stale.map((issue) => <li key={issue.itemId + issue.kind}>{issue.message}</li>)
              ) : (
                <li>Preço, disponibilidade, cupom ou taxa foram atualizados.</li>
              )}
            </ul>
            {needsCartChanges && (
              <Link to="/carrinho" className="mt-2 inline-block font-bold text-brand underline">
                Ajustar itens no carrinho
              </Link>
            )}
          </div>
        )}

        {quote ? (
          <>
            <ul className="mt-5 flex flex-col gap-3 border-b border-border pb-4">
              {quote.lines.map((line) => {
                const item = cart.data?.items.find((i) => i.id === line.itemId)
                return (
                  <li key={line.itemId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-3">
                      {item && <img src={item.image} alt="" width={44} height={44} className="size-11 rounded object-cover" />}
                      <span>
                        <span className="block font-bold">{item?.name ?? line.nftId}</span>
                        <span className="text-xs text-muted-foreground">
                          Edição {item?.editionLabel} · (x {line.quantity}) · {formatEth(line.unitPrice)}
                        </span>
                      </span>
                    </span>
                    <span className="font-bold whitespace-nowrap text-brand">{formatEth(line.lineTotal)}</span>
                  </li>
                )
              })}
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt>Subtotal</dt>
              <dd className="text-right">{formatEth(quote.subtotal)}</dd>
              <dt>Desconto</dt>
              <dd className="text-right">{formatDiscount(quote.discount)}</dd>
              <dt>Taxa de rede ({NETWORK_LABELS[network]})</dt>
              <dd className="text-right">{formatEth(quote.networkFee)}</dd>
              <dt className="text-base font-bold">Total</dt>
              <dd data-testid="review-total" className="text-right text-base font-bold text-brand">
                {formatEth(quote.total)}
              </dd>
              <dt className="text-muted-foreground">Carteira</dt>
              <dd className="text-right text-muted-foreground">
                {wallet ? `${WALLET_TYPE_LABELS[wallet.walletType]} · ${shortAddress(wallet.address)}` : '-'}
              </dd>
            </dl>
          </>
        ) : (
          <Skeleton className="mt-5 h-40" />
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {stale ? (
            <Button onClick={onAccept} disabled={needsCartChanges} className="h-11">
              Revisar e aceitar novos valores
            </Button>
          ) : (
            <Button data-testid="confirm-order" onClick={onConfirm} disabled={submitting || !quote} className="h-11">
              {submitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden /> Enviando pedido…
                </>
              ) : (
                'Confirmar e pagar'
              )}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Voltar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

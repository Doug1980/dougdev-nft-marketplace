import type { Quote } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDiscount, formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'

/** Totals always come from the API quote, never computed only on the client. Shared by cart and checkout. */
export function OrderSummary({
  quote,
  loading,
  updating,
  className,
}: {
  quote: Quote | undefined
  loading?: boolean
  updating?: boolean
  className?: string
}) {
  if (loading || !quote) {
    return (
      <div aria-busy="true" aria-label="Calculando valores" className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
        <div className="mt-4 flex justify-between">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
    )
  }

  return (
    <dl
      data-testid="order-summary"
      aria-busy={updating || undefined}
      className={cn('flex flex-col gap-3 text-sm transition-opacity md:text-base', updating && 'opacity-60', className)}
    >
      <div className="flex justify-between gap-4">
        <dt>Subtotal</dt>
        <dd data-testid="summary-subtotal" className="text-lg md:text-xl">
          {formatEth(quote.subtotal)}
        </dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt>{quote.coupon?.status === 'applied' ? quote.coupon.label : 'Desconto do lançamento'}</dt>
        <dd data-testid="summary-discount" className="shrink-0 whitespace-nowrap">
          {formatDiscount(quote.discount)}
        </dd>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between gap-4">
          <dt>Taxa de rede</dt>
          <dd data-testid="summary-fee" className="text-lg md:text-xl">
            {formatEth(quote.networkFee)}
          </dd>
        </div>
        <span className="self-end text-xs text-brand">Taxa estimada</span>
      </div>
      <div className="mt-4 flex justify-between gap-4 text-base font-bold md:text-lg">
        <dt>Total</dt>
        <dd data-testid="summary-total" className="text-brand">
          {formatEth(quote.total)}
        </dd>
      </div>
    </dl>
  )
}

import { Link, useNavigate } from '@tanstack/react-router'
import { Trash2, TriangleAlert } from 'lucide-react'
import type { CartItem, Quote } from '@/api/contracts'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { CouponForm } from '@/components/shared/coupon-form'
import { OrderSummary } from '@/components/shared/order-summary'
import { QuantityStepper } from '@/components/shared/quantity-stepper'
import { RelatedCarousel } from '@/components/shared/related-carousel'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAcknowledgePrice, useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from '@/features/cart'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { eth, formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useNftSubscription } from '@/realtime/context'

const DESKTOP_GRID = 'grid-cols-[1fr_138px_136px_150px_48px]'

const isBlocking = (item: CartItem) => item.available === 0 || item.quantity > item.available

/** Per-item notice: sold out and short stock block checkout; a price change only needs acknowledgement. */
function ItemNotice({ item }: { item: CartItem }) {
  const acknowledge = useAcknowledgePrice()

  if (item.available === 0) {
    return (
      <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
        <TriangleAlert className="size-3.5" aria-hidden /> Esta edição esgotou. Remova o item para finalizar.
      </p>
    )
  }
  if (item.quantity > item.available) {
    return (
      <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
        <TriangleAlert className="size-3.5" aria-hidden /> Restam apenas {item.available}. Ajuste a quantidade.
      </p>
    )
  }
  if (!eth.eq(item.addedPrice, item.unitPrice)) {
    const wentUp = eth.cmp(item.unitPrice, item.addedPrice) > 0
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 text-xs text-brand">
        <TriangleAlert className="size-3.5" aria-hidden />
        Preço {wentUp ? 'subiu' : 'caiu'}: era {formatEth(item.addedPrice)}, agora {formatEth(item.unitPrice)}.
        <button
          type="button"
          onClick={() => acknowledge.mutate({ itemId: item.id })}
          disabled={acknowledge.isPending}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Entendi
        </button>
      </p>
    )
  }
  return null
}

function CartRow({ item, line }: { item: CartItem; line?: Quote['lines'][number] }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const max = Math.max(1, Math.min(item.available, item.maxPerOrder))
  const lineTotal = line?.lineTotal ?? eth.mul(item.unitPrice, item.quantity)
  const setQuantity = (quantity: number) => update.mutate({ itemId: item.id, quantity, name: item.name })
  const removeItem = () => remove.mutate({ itemId: item.id, name: item.name })
  // Sold-out lines are left out of the API quote: strike their prices so the row matches the summary.
  const priceClass = cn('text-base font-bold', item.available === 0 ? 'text-muted-foreground line-through' : 'text-brand')
  const stepper = (
    <QuantityStepper size="sm" value={item.quantity} max={max} onChange={setQuantity} label={item.name} disabled={item.available === 0} />
  )

  return (
    <li data-testid="cart-row" data-item-id={item.id} className="bg-surface max-md:rounded-[20px]">
      {/* Desktop: table row from the desktop frame. */}
      <div className={`hidden items-center md:grid ${DESKTOP_GRID}`}>
        <div className="flex items-center gap-4">
          <img src={item.image} alt="" width={70} height={70} className="size-[70px] object-cover" />
          <div>
            <Link to="/nft/$slug" params={{ slug: item.slug }} className="text-base font-bold hover:text-brand">
              {item.name}
            </Link>
            <p className="text-sm text-subtle">
              ID do token: {item.tokenId} · Edição {item.editionLabel}
            </p>
          </div>
        </div>
        <p className={priceClass}>{formatEth(item.unitPrice)}</p>
        {stepper}
        <p className={priceClass}>{formatEth(lineTotal)}</p>
        <button
          type="button"
          onClick={removeItem}
          disabled={remove.isPending}
          aria-label={`Remover ${item.name} do carrinho`}
          className="flex size-9 items-center justify-center text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
      </div>

      {/* Mobile: card from the mobile frame. */}
      <div className="flex gap-3 md:hidden">
        <img src={item.image} alt="" width={100} height={100} className="size-[100px] rounded-l-[20px] object-cover" />
        <div className="flex flex-1 flex-col justify-center py-2 pr-3">
          <div className="flex items-start justify-between gap-2">
            <Link to="/nft/$slug" params={{ slug: item.slug }} className="text-sm font-bold">
              {item.name}
            </Link>
            <button
              type="button"
              onClick={removeItem}
              disabled={remove.isPending}
              aria-label={`Remover ${item.name} do carrinho`}
              className="text-muted-foreground"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">Edição: {item.editionLabel}</p>
          <div className="mt-1 flex items-center justify-between">
            <p className={priceClass}>{formatEth(item.unitPrice)}</p>
            {stepper}
          </div>
        </div>
      </div>

      <div className="px-3 pb-2 empty:hidden md:px-0 md:pb-0">
        <ItemNotice item={item} />
      </div>
    </li>
  )
}

export function CartPage() {
  useDocumentTitle('Carrinho | Kurio')
  const navigate = useNavigate()
  const { data: cart, isPending, isError, error, refetch, isFetching } = useCart()
  const hasItems = !!cart?.items.length
  const quote = useQuote('ethereum', 'cart', hasItems)
  // Live price/stock for every NFT in the cart.
  useNftSubscription(cart?.items.map((item) => item.nftId) ?? [])

  const blocking = cart?.items.some(isBlocking) ?? false

  return (
    <div className="pb-8">
      <MobileTopBar title="Carrinho de NFTs" />
      <nav aria-label="Trilha de navegação" className="container-site hidden pt-8 md:block">
        <ol className="flex gap-2 text-base font-bold">
          <li>
            <Link to="/">Início</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/" hash="mercado">
              Mercado
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">Carrinho</li>
        </ol>
      </nav>
      <h1 className="sr-only">Carrinho de NFTs</h1>

      <div className="container-site mt-2 grid gap-10 lg:grid-cols-[782px_1fr] lg:gap-[86px]">
        <section aria-label="Itens do carrinho">
          <div aria-hidden className={`hidden border-b border-border pb-2 text-base font-bold md:grid ${DESKTOP_GRID}`}>
            <span>NFTs</span>
            <span>Preço</span>
            <span>Edições</span>
            <span>Total</span>
            <span />
          </div>

          {isPending ? (
            <ul aria-busy="true" aria-label="Carregando carrinho" className="mt-3 flex flex-col gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-[100px] rounded-[20px] md:h-[70px] md:rounded-none" />
                </li>
              ))}
            </ul>
          ) : isError ? (
            <ErrorState className="mt-4" error={error} onRetry={() => void refetch()} retrying={isFetching} />
          ) : !hasItems ? (
            <EmptyState
              className="mt-4"
              title="Seu carrinho está vazio"
              description="Explore o mercado e adicione NFTs para continuar."
              action={
                <Button asChild>
                  <Link to="/" hash="mercado">
                    Explorar NFTs
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {cart.items.map((item) => (
                <CartRow key={item.id} item={item} line={quote.data?.lines.find((line) => line.itemId === item.id)} />
              ))}
            </ul>
          )}
        </section>

        {hasItems && (
          <aside
            aria-labelledby="summary-title"
            className="flex flex-col gap-6 max-md:-mx-4 max-md:rounded-t-[28px] max-md:bg-surface max-md:p-6"
          >
            <h2 id="summary-title" className="hidden border-b border-border pb-2 text-lg font-bold md:block">
              Resumo da carteira
            </h2>
            <div className="hidden md:block">
              <CouponForm appliedCode={cart.couponCode} />
            </div>
            <div className="md:hidden">
              <CouponForm appliedCode={cart.couponCode} variant="pill" />
            </div>

            {quote.isError && !quote.data ? (
              <ErrorState
                title="Não foi possível calcular os valores"
                error={quote.error}
                onRetry={() => void quote.refetch()}
                retrying={quote.isFetching}
              />
            ) : (
              <OrderSummary quote={quote.data} loading={quote.isPending} updating={quote.isFetching && !quote.isPending} />
            )}

            {blocking && (
              <p role="alert" className="text-sm text-destructive">
                Ajuste os itens indisponíveis antes de finalizar.
              </p>
            )}

            <div className="flex flex-col items-center gap-4">
              <Button
                className="h-10 w-full max-md:h-14 max-md:rounded-full max-md:bg-linear-to-r max-md:from-primary max-md:to-[#b8733d]"
                disabled={blocking || !quote.data}
                onClick={() => void navigate({ to: '/pagamento' })}
              >
                Conectar e finalizar
              </Button>
              <Link to="/" hash="mercado" className="text-base text-brand hover:underline">
                Continuar explorando
              </Link>
            </div>
          </aside>
        )}
      </div>

      <RelatedCarousel title="Colecionadores também viram" className="mt-24 hidden md:block" />
    </div>
  )
}

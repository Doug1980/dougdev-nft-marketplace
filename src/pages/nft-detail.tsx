import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Heart, Mail, ShoppingCart, Star, ZoomIn } from 'lucide-react'
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { useEffect, useState } from 'react'
import { type Edition, type EditionId, NETWORK_LABELS, type NftDetail } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { LinkedinIcon, TwitterIcon } from '@/components/shared/brand-icons'
import { FavoriteButton } from '@/components/shared/nft-card'
import { QuantityStepper } from '@/components/shared/quantity-stepper'
import { RelatedCarousel } from '@/components/shared/related-carousel'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAddToCart, useCart } from '@/features/cart'
import { useNft } from '@/features/catalog'
import { useFavorites, useToggleFavorite } from '@/features/favorites'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatEth } from '@/lib/money'
import { useSession } from '@/lib/session-store'
import { cn } from '@/lib/utils'
import { useNftSubscription, useRealtime } from '@/realtime/context'

const routeApi = getRouteApi('/nft/$slug')

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'size-3.5',
            i < Math.round(rating) ? 'fill-primary text-primary' : 'fill-muted-foreground/40 text-muted-foreground/40',
          )}
        />
      ))}
    </span>
  )
}

/** Editions as a radio group (arrow keys move between options). Sold-out editions are disabled and struck through. */
function EditionPicker({ editions, value, onChange }: { editions: Edition[]; value: EditionId; onChange: (id: EditionId) => void }) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onChange(v as EditionId)}
      aria-labelledby="edition-label"
      className="flex flex-wrap gap-2"
    >
      {editions.map((edition) => {
        const soldOut = edition.available === 0
        return (
          <RadioGroupPrimitive.Item
            key={edition.id}
            value={edition.id}
            disabled={soldOut}
            aria-label={`Edição ${edition.label}, ${formatEth(edition.price)}${soldOut ? ', esgotada' : `, ${edition.available} disponíveis`}`}
            className={cn(
              'h-7 rounded-full border border-border px-1.5 text-sm text-muted-foreground transition-colors',
              'data-[state=checked]:border-primary data-[state=checked]:font-bold data-[state=checked]:text-brand',
              'enabled:hover:border-primary disabled:cursor-not-allowed disabled:line-through disabled:opacity-50',
            )}
          >
            {edition.label}
          </RadioGroupPrimitive.Item>
        )
      })}
    </RadioGroupPrimitive.Root>
  )
}

function Gallery({ nft }: { nft: NftDetail }) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const current = nft.gallery[index] ?? { src: nft.image, alt: nft.imageAlt }

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row md:gap-7">
      <ul className="hidden gap-4 md:flex md:flex-col" aria-label="Miniaturas">
        {nft.gallery.map((image, i) => (
          <li key={image.alt}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Mostrar imagem ${i + 1} de ${nft.gallery.length}`}
              aria-current={i === index ? 'true' : undefined}
              className={cn(
                'block size-[100px] overflow-hidden rounded-[4px] border-2',
                i === index ? 'border-primary' : 'border-transparent',
              )}
            >
              <img src={image.src} alt="" width={100} height={100} className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative bg-surface md:size-[444px] md:p-5">
        {/* LCP element of the detail page. */}
        <img
          src={current.src}
          alt={nft.imageAlt}
          width={404}
          height={404}
          fetchPriority="high"
          className="aspect-square w-full rounded-b-[28px] object-cover md:rounded-[24px]"
        />
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label="Ampliar imagem"
          className="absolute top-3 right-3 hidden size-8 items-center justify-center rounded-full bg-background/90 text-foreground md:flex"
        >
          <ZoomIn className="size-5" aria-hidden />
        </button>
      </div>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(90vw,720px)] p-4" accentBar={false} aria-describedby={undefined}>
          <DialogTitle className="sr-only">{nft.name}, imagem ampliada</DialogTitle>
          <img src={current.src} alt={nft.imageAlt} className="mt-8 w-full rounded-[16px]" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Same footprint as the loaded page (no layout shift). */
function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando NFT" className="container-site grid gap-8 pt-4 md:pt-10 lg:grid-cols-[572px_1fr]">
      <div className="flex gap-7">
        <div className="hidden flex-col gap-4 md:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-[100px] rounded-[4px]" />
          ))}
        </div>
        <Skeleton className="aspect-square w-full rounded-[24px] md:size-[444px]" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-7 w-1/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-2/3" />
      </div>
    </div>
  )
}

function Breadcrumb({ current }: { current?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className="container-site hidden pt-8 md:block">
      <ol className="flex gap-2 text-base font-bold">
        <li>
          <Link to="/" className="hover:text-brand">
            Início
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li>
          <Link to="/" hash="mercado" className="hover:text-brand">
            Mercado
          </Link>
        </li>
        {current && (
          <>
            <li aria-hidden>/</li>
            <li aria-current="page" className="sr-only">
              {current}
            </li>
          </>
        )}
      </ol>
    </nav>
  )
}

export function NftDetailPage() {
  const { slug } = routeApi.useParams()
  const navigate = useNavigate()
  const session = useSession()
  const { data: nft, isPending, isError, error, refetch, isFetching } = useNft(slug)
  const { client } = useRealtime()
  const cart = useCart()
  const add = useAddToCart()
  const favorites = useFavorites()
  const toggleFavorite = useToggleFavorite()
  const [editionId, setEditionId] = useState<EditionId | null>(null)
  const [quantity, setQuantity] = useState(1)

  useDocumentTitle(nft ? `${nft.name} | Kurio` : 'NFT | Kurio')
  useNftSubscription(nft ? [nft.id] : [])
  // REST version is the baseline: older socket events for this NFT are dropped.
  useEffect(() => {
    if (nft) client.observeVersion(`nft:${nft.id}`, nft.version)
  }, [client, nft])

  const defaultEdition = nft?.editions.find((e) => e.id === '1-50' && e.available > 0) ?? nft?.editions.find((e) => e.available > 0)
  const edition = nft?.editions.find((e) => e.id === (editionId ?? defaultEdition?.id))
  const inCart = (id: string) => cart.data?.items.find((item) => item.nftId === nft?.id && item.editionId === id)?.quantity ?? 0
  // Limit = min(stock, per-order cap) minus what is already in the cart.
  const limit = edition ? Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart(edition.id)) : 0

  // Derived, not synced: a realtime stock drop clamps the quantity on the next render.
  const qty = Math.min(quantity, Math.max(1, limit))

  if (isPending) return <DetailSkeleton />

  if (isError) {
    if (toApiError(error).code === 'NOT_FOUND') {
      return (
        <>
          <MobileTopBar title="NFT" />
          <div className="container-site py-16">
            <EmptyState
              title="NFT não encontrado"
              description="Este NFT não existe ou foi removido do mercado."
              action={
                <Link
                  to="/"
                  hash="mercado"
                  className="inline-flex h-10 items-center rounded-[4px] bg-primary px-6 font-bold text-primary-foreground"
                >
                  Voltar ao mercado
                </Link>
              }
            />
          </div>
        </>
      )
    }
    return (
      <div className="container-site py-16">
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />
      </div>
    )
  }

  const isFavorite = !!favorites.data?.nftIds.includes(nft.id)
  const canBuy = !!edition && limit > 0
  const unavailableReason = !edition
    ? 'Todas as edições estão esgotadas.'
    : limit === 0
      ? `Você já tem o limite desta edição no carrinho (${Math.min(edition.available, edition.maxPerOrder)}).`
      : null
  const price = formatEth(edition?.price ?? nft.price)
  const shareUrl = encodeURIComponent(`${window.location.origin}/nft/${nft.slug}`)

  const addToCart = (goToCart: boolean) => {
    if (!edition || !canBuy) return
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity: qty, name: nft.name },
      {
        onSuccess: () => {
          setQuantity(1)
          if (goToCart) void navigate({ to: '/carrinho' })
        },
      },
    )
  }
  const favorite = () => {
    if (session.status !== 'authenticated') return void navigate({ to: '/entrar', search: { redirect: `/nft/${nft.slug}` } })
    toggleFavorite.mutate({ nftId: nft.id, favorite: !isFavorite, name: nft.name })
  }

  return (
    <article aria-labelledby="nft-title" className="pb-28 md:pb-0">
      <MobileTopBar action={<FavoriteButton nft={nft} className="bg-surface" />} className="absolute inset-x-0 top-0 z-10" />
      <Breadcrumb current={nft.name} />

      <div className="container-site max-md:px-0">
        <div className="grid gap-6 md:mt-2 lg:grid-cols-[572px_1fr] lg:gap-8">
          <Gallery nft={nft} />

          <div className="-mt-10 flex flex-col gap-4 rounded-t-[28px] bg-surface px-6 pt-6 md:mt-0 md:rounded-none md:bg-transparent md:px-0 md:pt-0">
            <div className="flex items-start justify-between gap-3">
              <h1 id="nft-title" className="text-xl font-bold md:text-[28px] md:leading-9">
                {nft.name}
              </h1>
              <span className="flex items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-sm md:hidden">
                <Star className="size-3.5 fill-primary text-primary" aria-hidden /> {nft.rating.toFixed(1)}
                <span className="text-muted-foreground">({nft.reviewsCount})</span>
                <span className="sr-only"> avaliações</span>
              </span>
            </div>

            <div className="hidden items-center justify-between gap-4 border-b border-border pb-2 md:flex">
              <p className="text-xl font-bold text-brand" aria-live="polite">
                <span className="sr-only">Preço da edição {edition?.label}: </span>
                {price}
              </p>
              <p className="flex items-center gap-1.5 text-base">
                <Stars rating={nft.rating} />
                <span>
                  {nft.reviewsCount} avaliações de colecionadores<span className="sr-only">, nota {nft.rating.toFixed(1)} de 5</span>
                </span>
              </p>
            </div>

            <div>
              <h2 className="hidden text-base font-bold md:block">Sobre este NFT:</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{nft.description}</p>
            </div>

            <div className="flex flex-col gap-2">
              <h2 id="edition-label" className="text-base font-bold">
                Edição:
              </h2>
              <EditionPicker
                editions={nft.editions}
                value={edition?.id ?? '1-50'}
                onChange={(id) => {
                  setEditionId(id)
                  setQuantity(1)
                }}
              />
              {edition && (
                <p className="text-xs text-subtle" aria-live="polite">
                  {edition.available} disponíveis · máximo de {edition.maxPerOrder} por pedido
                  {inCart(edition.id) > 0 && ` · ${inCart(edition.id)} no carrinho`}
                </p>
              )}
            </div>

            <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
              <QuantityStepper value={qty} max={Math.max(1, limit)} onChange={setQuantity} label={nft.name} disabled={!canBuy} />
              <div className="flex gap-2">
                <Button className="w-[130px] rounded-[2px]" disabled={!canBuy || add.isPending} onClick={() => addToCart(true)}>
                  {add.isPending ? 'Adicionando…' : 'COMPRAR'}
                </Button>
                <Button variant="outline" className="rounded-[2px]" aria-pressed={isFavorite} onClick={favorite}>
                  <Heart className="size-5" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden />
                  {isFavorite ? 'Favoritado' : 'Favoritar'}
                </Button>
              </div>
            </div>
            {unavailableReason && (
              <p role="status" className="text-sm text-destructive">
                {unavailableReason}
              </p>
            )}

            <dl className="flex flex-col gap-3 text-sm text-subtle md:text-base">
              <div className="flex gap-1">
                <dt>ID do token:</dt>
                <dd>{nft.tokenId}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Coleção:</dt>
                <dd>{nft.collection}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Atributos:</dt>
                <dd>{nft.attributes.join(', ')}</dd>
              </div>
            </dl>

            <div className="hidden items-center gap-3 md:flex">
              <span className="text-base font-bold">Compartilhar este NFT:</span>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Compartilhar no LinkedIn (abre em nova aba)"
              >
                <LinkedinIcon />
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${shareUrl}`} aria-label="Compartilhar por e-mail">
                <Mail className="size-5" aria-hidden />
              </a>
              <a
                href={`https://x.com/intent/post?url=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Compartilhar no X (abre em nova aba)"
              >
                <TwitterIcon />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="container-site mt-16 hidden md:block">
        <Tabs defaultValue="details">
          <TabsList variant="line" className="h-auto w-full justify-start gap-8 border-b border-border p-0">
            <TabsTrigger
              value="details"
              className="flex-none rounded-none px-0 pb-1.5 text-lg data-active:font-bold data-active:text-brand after:bg-primary"
            >
              Detalhes do NFT
            </TabsTrigger>
            <TabsTrigger
              value="reviews"
              className="flex-none rounded-none px-0 pb-1.5 text-lg data-active:font-bold data-active:text-brand after:bg-primary"
            >
              Avaliações de colecionadores ({nft.reviewsCount})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4 flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
            {nft.longDescription.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
            <div>
              <h3 className="font-bold text-foreground">Rede:</h3>
              <p>Cunhado na {NETWORK_LABELS[nft.network]} com procedência imutável e metadados armazenados no IPFS.</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">Contrato:</h3>
              <p>{nft.royalties}</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">Direitos autorais:</h3>
              <p>{nft.contract} • Contrato inteligente ERC-721 verificado.</p>
            </div>
          </TabsContent>
          <TabsContent value="reviews" className="mt-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 text-base text-foreground">
              <Stars rating={nft.rating} /> {nft.rating.toFixed(1)} de 5, com base em {nft.reviewsCount} avaliações.
            </p>
            <p className="mt-2">Os comentários individuais não fazem parte desta demonstração.</p>
          </TabsContent>
        </Tabs>
      </div>

      <RelatedCarousel title="Mais desta coleção" excludeId={nft.id} className="mt-16 hidden md:block" />

      {/* Mobile sticky purchase bar (mobile detail frame). */}
      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-surface px-6 pt-4 pb-5 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm">Qtd.</span>
            <QuantityStepper size="sm" value={qty} max={Math.max(1, limit)} onChange={setQuantity} label={nft.name} disabled={!canBuy} />
          </div>
          <p className="text-lg font-bold text-brand">{price}</p>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="pill"
            className="flex-1 bg-linear-to-r from-primary to-[#b8733d]"
            disabled={!canBuy || add.isPending}
            onClick={() => addToCart(true)}
          >
            Comprar NFT
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-14 border-0 bg-surface-strong text-brand"
            disabled={!canBuy || add.isPending}
            onClick={() => addToCart(false)}
            aria-label={`Adicionar ${nft.name} ao carrinho`}
          >
            <ShoppingCart className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  )
}

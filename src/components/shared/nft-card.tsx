import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart } from '@/features/cart'
import { useFavorites, useToggleFavorite } from '@/features/favorites'
import { formatEth } from '@/lib/money'
import { useSession } from '@/lib/session-store'
import { cn } from '@/lib/utils'

/** Heart toggle. Guests are sent to sign-in and come back to the same page. */
export function FavoriteButton({
  nft,
  className,
  size = 'md',
}: {
  nft: Pick<NftSummary, 'id' | 'name'>
  className?: string
  size?: 'sm' | 'md'
}) {
  const session = useSession()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const { data } = useFavorites()
  const toggle = useToggleFavorite()
  const active = !!data?.nftIds.includes(nft.id)

  const onClick = () => {
    if (session.status !== 'authenticated') return void navigate({ to: '/entrar', search: { redirect: href } })
    toggle.mutate({ nftId: nft.id, favorite: !active, name: nft.name })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
      className={cn(
        'flex items-center justify-center rounded-full bg-background/80 text-brand hover:bg-background',
        size === 'sm' ? 'size-8' : 'size-9',
        className,
      )}
    >
      <Heart className={size === 'sm' ? 'size-4' : 'size-5'} fill={active ? 'currentColor' : 'none'} aria-hidden />
    </button>
  )
}

/**
 * Catalog card. Desktop: image framed in a surface box, quick actions on hover/focus (login frame).
 * Mobile: rounded card with the heart on top (mobile home frame).
 */
export function NftCard({ nft, priority = false, className }: { nft: NftSummary; priority?: boolean; className?: string }) {
  const add = useAddToCart()
  const soldOut = nft.totalAvailable === 0
  const titleId = `nft-${nft.id}-name`

  return (
    <article className={cn('group relative flex flex-col', className)} aria-labelledby={titleId}>
      <div className="relative aspect-[258/300] overflow-hidden rounded-3xl bg-surface md:rounded-none">
        {/* Image link is a duplicate of the title link, hidden from keyboard and screen readers. */}
        <Link
          to="/nft/$slug"
          params={{ slug: nft.slug }}
          tabIndex={-1}
          aria-hidden
          className="absolute inset-[6px] block md:inset-x-1 md:top-5 md:bottom-12"
        >
          <img
            src={nft.image}
            alt=""
            width={250}
            height={250}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="size-full rounded-[18px] object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>
        {nft.badge === 'raro' && (
          <span className="absolute top-0 left-1.5 bg-primary px-3 py-1 text-sm font-bold text-primary-foreground md:left-0">RARO</span>
        )}
        {soldOut && (
          <span className="absolute top-2 right-2 rounded bg-background/90 px-2 py-1 text-xs font-bold text-destructive">ESGOTADO</span>
        )}
        <FavoriteButton nft={nft} size="sm" className="absolute top-3 right-3 md:hidden" />

        <div className="absolute inset-x-0 bottom-2 hidden justify-center gap-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
          <button
            type="button"
            disabled={soldOut || add.isPending}
            onClick={() => add.mutate({ nftId: nft.id, editionId: '1-50', quantity: 1, name: nft.name })}
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            className="flex size-9 items-center justify-center rounded-[4px] bg-background text-foreground hover:text-brand disabled:opacity-50"
          >
            <ShoppingCart className="size-5" aria-hidden />
          </button>
          <FavoriteButton nft={nft} className="rounded-[4px] bg-background text-foreground" />
          <Link
            to="/nft/$slug"
            params={{ slug: nft.slug }}
            aria-label={`Ver detalhes de ${nft.name}`}
            className="flex size-9 items-center justify-center rounded-[4px] bg-background text-foreground hover:text-brand"
          >
            <Search className="size-5" aria-hidden />
          </Link>
        </div>
      </div>

      <h3 id={titleId} className="mt-3 px-2 text-sm md:px-0 md:text-base">
        <Link to="/nft/$slug" params={{ slug: nft.slug }} className="hover:text-brand">
          {nft.name}
        </Link>
      </h3>
      <p className="px-2 text-sm font-bold text-brand md:px-0 md:text-lg">
        <span className="sr-only">Preço: </span>
        {formatEth(nft.price)}
        {nft.compareAtPrice && (
          <>
            {' '}
            <span className="sr-only">, antes </span>
            <s className="font-normal text-subtle">{formatEth(nft.compareAtPrice)}</s>
          </>
        )}
      </p>
    </article>
  )
}

/** Same footprint as the card, so loading does not shift the layout (CLS). */
export function NftCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <Skeleton className="aspect-[258/300] rounded-3xl md:rounded-none" />
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-1.5 h-6 w-1/3" />
    </div>
  )
}

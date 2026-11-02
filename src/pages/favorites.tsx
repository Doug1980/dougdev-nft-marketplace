import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { NftCard, NftCardSkeleton } from '@/components/shared/nft-card'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { nftQueryOptions } from '@/features/catalog'
import { useFavorites } from '@/features/favorites'
import { useDocumentTitle } from '@/hooks/use-document-title'

/**
 * Favorites API returns only ids; each card reuses the NFT detail query (shared cache with the detail page).
 * Unfavoriting here is optimistic, so the card disappears immediately.
 */
export function FavoritesPage() {
  useDocumentTitle('Lista de interesse | Kurio')
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const nfts = useQueries({ queries: ids.map((id) => nftQueryOptions(id)) })

  return (
    <section aria-labelledby="favorites-title">
      <h1 id="favorites-title" className="text-lg font-bold">
        Lista de interesse
      </h1>
      {favorites.isError ? (
        <ErrorState className="mt-6" error={favorites.error} onRetry={() => void favorites.refetch()} />
      ) : favorites.isPending ? (
        <ul aria-busy="true" aria-label="Carregando favoritos" className="mt-6 grid grid-cols-2 gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : ids.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Nenhum favorito ainda"
          description="Toque no coração de um NFT para acompanhá-lo aqui."
          action={
            <Button asChild>
              <Link to="/" hash="mercado">
                Explorar NFTs
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 xl:grid-cols-3">
          {nfts.map((query, i) => (
            <li key={ids[i]}>{query.data ? <NftCard nft={query.data} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/api/contracts'
import { nftApi } from '@/api/endpoints'
import { qk } from '@/lib/query'

export const PAGE_SIZE = 9

/** Every parameter is part of the key and the signal aborts superseded requests (out-of-order responses). */
export const catalogQueryOptions = (params: CatalogQuery) =>
  queryOptions({
    queryKey: qk.catalog({ ...params, pageSize: PAGE_SIZE }),
    queryFn: ({ signal }) => nftApi.list({ ...params, pageSize: PAGE_SIZE }, { signal }),
    placeholderData: keepPreviousData,
  })

export function useCatalog(params: CatalogQuery) {
  return useQuery(catalogQueryOptions(params))
}

export const nftQueryOptions = (idOrSlug: string) =>
  queryOptions({
    queryKey: qk.nft(idOrSlug),
    queryFn: ({ signal }) => nftApi.detail(idOrSlug, { signal }),
  })

export function useNft(idOrSlug: string) {
  return useQuery(nftQueryOptions(idOrSlug))
}

/** "Mais desta coleção" / "Colecionadores também viram". */
export function useRelated(excludeId?: string) {
  return useQuery({
    ...catalogQueryOptions({ sort: 'recent', page: 1 }),
    select: (page) => page.items.filter((item) => item.id !== excludeId).slice(0, 5),
  })
}

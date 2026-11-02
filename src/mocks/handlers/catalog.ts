import { HttpResponse } from 'msw'
import { catalogQuery } from '@/api/contracts'
import { db } from '../db/store'
import { queryCatalog, toDetail } from '../domain'
import { apiError, route, validationError, zodFields } from '../http'

const list = (value: string | null) => (value ? value.split(',').filter(Boolean) : undefined)
const int = (value: string | null) => (value ? Number(value) : undefined)

export const catalogHandlers = [
  route(
    'get',
    '/nfts',
    ({ request }) => {
      const sp = new URL(request.url).searchParams
      const parsed = catalogQuery.safeParse({
        q: sp.get('q') ?? undefined,
        tab: sp.get('tab') ?? undefined,
        categories: list(sp.get('categories')),
        networks: list(sp.get('networks')),
        minPrice: sp.get('minPrice') ?? undefined,
        maxPrice: sp.get('maxPrice') ?? undefined,
        sort: sp.get('sort') ?? undefined,
        page: int(sp.get('page')),
        pageSize: int(sp.get('pageSize')),
      })
      if (!parsed.success) return validationError(zodFields(parsed.error.issues), 'Parâmetros de busca inválidos.')

      const result = queryCatalog({ ...parsed.data, page: parsed.data.page ?? 1, pageSize: parsed.data.pageSize ?? 9 })
      if (db.state.scenario === 'empty-catalog') {
        return HttpResponse.json({
          ...result,
          items: [],
          total: 0,
          totalPages: 1,
          page: 1,
          facets: {
            ...result.facets,
            categories: result.facets.categories.map((c) => ({ ...c, count: 0 })),
            networks: result.facets.networks.map((n) => ({ ...n, count: 0 })),
          },
        })
      }
      return HttpResponse.json(result)
    },
    'catalog',
  ),

  route<{ id: string }>(
    'get',
    '/nfts/:id',
    ({ params }) => {
      const nft = db.nft(params.id)
      if (!nft) return apiError(404, 'NOT_FOUND', 'Este NFT não existe ou foi removido do mercado.')
      return HttpResponse.json(toDetail(nft))
    },
    'detail',
  ),
]

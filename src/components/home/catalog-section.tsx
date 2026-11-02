import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { LoaderCircle, Search, SlidersHorizontal, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { CATEGORY_LABELS, type CatalogPage, type CatalogSort, type CatalogTab, NETWORK_LABELS, SORT_LABELS } from '@/api/contracts'
import { NftCard, NftCardSkeleton } from '@/components/shared/nft-card'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useCatalog } from '@/features/catalog'
import { formatEthBr } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useNftSubscription } from '@/realtime/context'
import type { HomeSearch } from '@/router'
import { CatalogFilters } from './catalog-filters'

const routeApi = getRouteApi('/')

const TABS: Array<{ id: CatalogTab; label: string }> = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

const CLEAR_FILTERS: Partial<HomeSearch> = {
  q: undefined,
  categories: undefined,
  networks: undefined,
  minPrice: undefined,
  maxPrice: undefined,
  tab: undefined,
}

/** URL is the single source of truth. Any filter change resets pagination; only `page` keeps it. */
function useCatalogSearch() {
  const search = routeApi.useSearch()
  const navigate = useNavigate()
  const update = (patch: Partial<HomeSearch>, { keepPage = false } = {}) => {
    void navigate({
      to: '/',
      search: (prev) => ({ ...prev, ...patch, page: keepPage ? patch.page : undefined }),
      resetScroll: false,
      hash: 'mercado',
    })
  }
  return { search, update }
}

function without<T>(list: T[] | undefined, value: T) {
  const next = (list ?? []).filter((item) => item !== value)
  return next.length ? next : undefined
}

function ActiveFilters({ search, update }: ReturnType<typeof useCatalogSearch>) {
  const chips: Array<{ key: string; label: string; clear: Partial<HomeSearch> }> = []
  if (search.q) chips.push({ key: 'q', label: `Busca: "${search.q}"`, clear: { q: undefined } })
  for (const c of search.categories ?? [])
    chips.push({ key: c, label: CATEGORY_LABELS[c], clear: { categories: without(search.categories, c) } })
  for (const n of search.networks ?? []) chips.push({ key: n, label: NETWORK_LABELS[n], clear: { networks: without(search.networks, n) } })
  if (search.minPrice || search.maxPrice) {
    const lo = search.minPrice ? formatEthBr(search.minPrice) : 'mín.'
    const hi = search.maxPrice ? formatEthBr(search.maxPrice) : 'máx.'
    chips.push({ key: 'price', label: `Preço: ${lo} - ${hi} ETH`, clear: { minPrice: undefined, maxPrice: undefined } })
  }
  if (!chips.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => update(chip.clear)}
          aria-label={`Remover filtro ${chip.label}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/70 px-3 py-1 text-xs text-brand hover:bg-primary/10"
        >
          {chip.label}
          <X className="size-3" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        onClick={() => update(CLEAR_FILTERS)}
      >
        Limpar filtros
      </button>
    </div>
  )
}

function SortSelect({ id, value, onChange }: { id: string; value: CatalogSort; onChange: (sort: CatalogSort) => void }) {
  return (
    <div className="flex items-center gap-1 text-base">
      <label htmlFor={id} className="whitespace-nowrap">
        Ordenar por:
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as CatalogSort)}>
        <SelectTrigger id={id} className="h-auto gap-1 border-0 bg-transparent px-1 py-0 text-base dark:bg-transparent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {(Object.keys(SORT_LABELS) as CatalogSort[]).map((sort) => (
            <SelectItem key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function FeaturedCard({ featured }: { featured: CatalogPage['featured'] | undefined }) {
  if (featured === undefined) return <Skeleton className="h-[470px] w-full" />
  if (!featured) return null
  return (
    <Link
      to="/nft/$slug"
      params={{ slug: featured.slug }}
      aria-label={`NFT em destaque, oferta limitada: ${featured.name}`}
      className="group block bg-linear-to-b from-surface-strong/70 to-transparent"
    >
      <p className="px-5 pt-6 text-2xl font-bold text-brand">NFT EM DESTAQUE</p>
      <p className="mt-2 px-5 text-center text-xl font-bold">OFERTA LIMITADA</p>
      <img
        src={featured.image}
        alt=""
        width={310}
        height={366}
        loading="lazy"
        className="mt-2 h-[366px] w-full rounded-[18px] object-cover transition-transform group-hover:scale-[1.01]"
      />
    </Link>
  )
}

/** Mobile: search box + filter button, as in the mobile home frame. Remounts when `q` changes (history). */
function MobileSearch({
  initial,
  onSearch,
  onOpenFilters,
  activeCount,
}: {
  initial: string
  onSearch: (q: string) => void
  onOpenFilters: () => void
  activeCount: number
}) {
  const [value, setValue] = useState(initial)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSearch(value.trim())
  }
  return (
    <form role="search" onSubmit={submit} className="flex gap-2 px-2 md:hidden" aria-label="Buscar no catálogo">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" aria-hidden />
        <label htmlFor="mobile-search" className="sr-only">
          Explorar coleções
        </label>
        <input
          id="mobile-search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Explorar coleções"
          className="h-11 w-full rounded-[10px] bg-surface pr-3 pl-10 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </div>
      <button
        type="button"
        onClick={onOpenFilters}
        aria-label={`Filtros e ordenação${activeCount ? `, ${activeCount} ativos` : ''}`}
        className="relative flex size-11 items-center justify-center rounded-[10px] bg-primary text-primary-foreground"
      >
        <SlidersHorizontal className="size-5" aria-hidden />
        {activeCount > 0 && (
          <span aria-hidden className="absolute -top-1 -right-1 rounded-full bg-foreground px-1.5 text-[10px] font-bold text-background">
            {activeCount}
          </span>
        )}
      </button>
    </form>
  )
}

export function CatalogSection() {
  const { search, update } = useCatalogSearch()
  const sort = search.sort ?? 'recent'
  const { data, isPending, isError, error, isFetching, isPlaceholderData, refetch } = useCatalog({
    ...search,
    sort,
    page: search.page ?? 1,
  })
  const [filtersOpen, setFiltersOpen] = useState(false)
  useNftSubscription(data?.items.map((item) => item.id) ?? [])

  const tab = search.tab ?? 'all'
  const activeCount = (search.categories?.length ?? 0) + (search.networks?.length ?? 0) + (search.minPrice || search.maxPrice ? 1 : 0)
  const changeSort = (next: CatalogSort) => update({ sort: next === 'recent' ? undefined : next })

  return (
    <section id="mercado" aria-labelledby="mercado-title" className="container-site scroll-mt-4 md:mt-24">
      <h2 id="mercado-title" className="sr-only">
        Mercado de NFTs
      </h2>
      <MobileSearch
        key={search.q ?? ''}
        initial={search.q ?? ''}
        onSearch={(q) => update({ q: q || undefined })}
        onOpenFilters={() => setFiltersOpen(true)}
        activeCount={activeCount}
      />

      <div className="mt-6 grid gap-6 md:mt-0 lg:grid-cols-[310px_1fr] lg:gap-12">
        <aside className="hidden flex-col gap-6 lg:flex" aria-label="Filtros do catálogo">
          <CatalogFilters search={search} facets={data?.facets} onChange={update} />
          <FeaturedCard featured={data ? data.featured : undefined} />
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div role="group" aria-label="Listas do catálogo" className="scrollbar-none flex gap-4 overflow-x-auto md:gap-5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tab === t.id}
                  onClick={() => update({ tab: t.id === 'all' ? undefined : t.id })}
                  className={cn(
                    'border-b-2 pb-0.5 text-sm whitespace-nowrap md:text-base',
                    tab === t.id ? 'border-primary font-bold text-brand' : 'border-transparent font-medium hover:text-brand',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal aria-hidden /> Filtros{activeCount ? ` (${activeCount})` : ''}
              </Button>
              <SortSelect id="sort-desktop" value={sort} onChange={changeSort} />
            </div>
          </div>

          <div className="mt-4 flex min-h-6 flex-wrap items-center justify-between gap-3">
            <ActiveFilters search={search} update={update} />
            {/* Background refresh is announced; the previous page stays visible meanwhile. */}
            <p role="status" aria-live="polite" className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              {isFetching && !isPending ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Atualizando resultados…
                </>
              ) : data ? (
                `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}`
              ) : null}
            </p>
          </div>

          {isError && !data ? (
            <ErrorState className="mt-6" error={error} onRetry={() => void refetch()} retrying={isFetching} />
          ) : isPending ? (
            <ul aria-busy="true" aria-label="Carregando NFTs" className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:gap-x-8 xl:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => (
                <li key={i} className={cn(i % 2 === 1 && 'max-md:translate-y-8')}>
                  <NftCardSkeleton />
                </li>
              ))}
            </ul>
          ) : data.items.length === 0 ? (
            <EmptyState
              className="mt-6"
              title="Nenhum NFT encontrado"
              description="Ajuste a busca ou os filtros para ver mais resultados."
              action={
                <Button variant="outline" onClick={() => update(CLEAR_FILTERS)}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <>
              {isError && (
                <ErrorState
                  className="mt-6"
                  title="Falha ao atualizar"
                  error={error}
                  onRetry={() => void refetch()}
                  retrying={isFetching}
                />
              )}
              <ul
                aria-label={`Página ${data.page} de ${data.totalPages}`}
                aria-busy={isPlaceholderData}
                className={cn(
                  'mt-6 grid grid-cols-2 gap-x-4 gap-y-8 pb-8 md:gap-x-8 md:pb-0 xl:grid-cols-3',
                  isPlaceholderData && 'opacity-60 transition-opacity',
                )}
              >
                {data.items.map((nft, i) => (
                  // Mobile staggered grid from the layout: every second card is offset down.
                  <li key={nft.id} className={cn(i % 2 === 1 && 'max-md:translate-y-8')}>
                    <NftCard nft={nft} priority={i < 3} />
                  </li>
                ))}
              </ul>
              <Pagination
                className="mt-10"
                page={data.page}
                totalPages={data.totalPages}
                onPage={(page) => update({ page: page === 1 ? undefined : page }, { keepPage: true })}
              />
            </>
          )}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl p-5" aria-describedby={undefined}>
          <SheetTitle className="text-lg font-bold">Filtros e ordenação</SheetTitle>
          <SortSelect id="sort-mobile" value={sort} onChange={changeSort} />
          <CatalogFilters className="-mx-5" search={search} facets={data?.facets} onChange={update} />
          <Button onClick={() => setFiltersOpen(false)}>Ver {data?.total ?? ''} resultados</Button>
        </SheetContent>
      </Sheet>
    </section>
  )
}

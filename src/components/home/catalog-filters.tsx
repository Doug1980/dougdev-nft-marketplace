import { useState } from 'react'
import type { CatalogPage, CategoryId, NetworkId } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { formatEthBr } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { HomeSearch } from '@/router'

type Props = {
  search: HomeSearch
  facets: CatalogPage['facets'] | undefined
  onChange: (patch: Partial<HomeSearch>) => void
  className?: string
}

function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = new Set(list ?? [])
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next.size ? [...next] : undefined
}

/**
 * Price range edits local state while dragging and commits to the URL only on "Aplicar".
 * Keyed by the URL values, so back/forward navigation resets it.
 */
function PriceFilter({ search, facets, onChange }: Props) {
  if (!facets) return <Skeleton className="h-24 w-full" />
  const min = Number(facets.priceRange.min)
  const max = Number(facets.priceRange.max)
  return (
    <PriceRange
      key={`${search.minPrice}-${search.maxPrice}-${min}-${max}`}
      min={min}
      max={max}
      initial={[Number(search.minPrice ?? min), Number(search.maxPrice ?? max)]}
      onApply={([lo, hi]) => onChange({ minPrice: lo <= min ? undefined : lo.toFixed(2), maxPrice: hi >= max ? undefined : hi.toFixed(2) })}
    />
  )
}

function PriceRange({
  min,
  max,
  initial,
  onApply,
}: {
  min: number
  max: number
  initial: [number, number]
  onApply: (v: [number, number]) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <div className="flex flex-col gap-3 pl-3">
      <Slider
        min={min}
        max={max}
        step={0.01}
        value={value}
        minStepsBetweenThumbs={1}
        onValueChange={([lo = min, hi = max]) => setValue([lo, hi])}
        thumbLabels={['Preço mínimo', 'Preço máximo']}
        aria-label="Faixa de preço em ETH"
      />
      <p className="text-sm">
        Preço: {formatEthBr(value[0].toFixed(2))} - {formatEthBr(value[1].toFixed(2))} ETH
      </p>
      <Button size="sm" className="w-fit text-base" onClick={() => onApply(value)}>
        Aplicar
      </Button>
    </div>
  )
}

/** Facet lists are toggle buttons (aria-pressed): combinable filters, one click each. */
export function CatalogFilters({ search, facets, onChange, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-6 bg-surface p-5', className)}>
      <fieldset>
        <legend className="text-lg font-bold">Coleções</legend>
        <ul className="mt-3 flex flex-col gap-1">
          {facets
            ? facets.categories.map((category) => {
                const active = !!search.categories?.includes(category.id)
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ categories: toggle<CategoryId>(search.categories, category.id) })}
                      className={cn(
                        'flex w-full items-center justify-between rounded px-3 py-2 text-left text-base hover:bg-surface-strong',
                        active ? 'bg-surface-strong font-bold text-brand' : 'text-muted-foreground',
                      )}
                    >
                      <span>{category.label}</span>
                      <span className="font-bold text-brand">({category.count})</span>
                    </button>
                  </li>
                )
              })
            : Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="my-2 h-6" />)}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-bold">Faixa de preço</legend>
        <div className="mt-3">
          <PriceFilter search={search} facets={facets} onChange={onChange} />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-bold">Rede</legend>
        <ul className="mt-3 flex flex-col gap-1">
          {facets
            ? facets.networks.map((network) => {
                const active = !!search.networks?.includes(network.id)
                return (
                  <li key={network.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ networks: toggle<NetworkId>(search.networks, network.id) })}
                      className={cn(
                        'flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-surface-strong',
                        active ? 'bg-surface-strong font-bold text-brand' : 'text-muted-foreground',
                      )}
                    >
                      <span>{network.label}</span>
                      <span>({network.count})</span>
                    </button>
                  </li>
                )
              })
            : Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="my-2 h-5" />)}
        </ul>
      </fieldset>
    </div>
  )
}

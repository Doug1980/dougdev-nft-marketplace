import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Up to 7 pages shows every number (as in the layout: 1 2 3 4 >); beyond that, first/last/neighbors with ellipsis. */
function pageItems(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [...new Set([1, total, current - 1, current, current + 1])].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  return pages.flatMap((page, i) => (i > 0 && page - (pages[i - 1] ?? page) > 1 ? ['gap' as const, page] : [page]))
}

export function Pagination({
  page,
  totalPages,
  onPage,
  className,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null
  const box = 'flex size-[34px] items-center justify-center rounded-[4px] border border-border text-base hover:border-primary'
  return (
    <nav aria-label="Paginação do catálogo" className={cn('flex justify-end', className)}>
      <ul className="flex gap-2">
        {page > 1 && (
          <li>
            <button type="button" className={box} onClick={() => onPage(page - 1)} aria-label="Página anterior">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
          </li>
        )}
        {pageItems(page, totalPages).map((item, i) =>
          item === 'gap' ? (
            <li key={`gap-${i}`} aria-hidden className="flex w-6 items-end justify-center">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                onClick={() => onPage(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Página ${item}`}
                className={cn(box, item === page && 'border-primary bg-primary font-bold text-primary-foreground')}
              >
                {item}
              </button>
            </li>
          ),
        )}
        {page < totalPages && (
          <li>
            <button type="button" className={box} onClick={() => onPage(page + 1)} aria-label="Próxima página">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}

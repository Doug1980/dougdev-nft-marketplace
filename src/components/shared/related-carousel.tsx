import { useRef, useState } from 'react'
import { NftCard, NftCardSkeleton } from '@/components/shared/nft-card'
import { useRelated } from '@/features/catalog'
import { cn } from '@/lib/utils'

const GROUPS = 3

/** "Mais desta coleção" / "Colecionadores também viram": scroll-snap row with dot navigation. */
export function RelatedCarousel({ title, excludeId, className }: { title: string; excludeId?: string; className?: string }) {
  const { data, isPending } = useRelated(excludeId)
  const listRef = useRef<HTMLUListElement>(null)
  const [group, setGroup] = useState(0)
  const titleId = `related-${title.replace(/\s+/g, '-').toLowerCase()}`

  const goTo = (index: number) => {
    const list = listRef.current
    if (!list) return
    list.scrollTo({ left: ((list.scrollWidth - list.clientWidth) * index) / (GROUPS - 1), behavior: 'smooth' })
    setGroup(index)
  }
  const onScroll = () => {
    const list = listRef.current
    if (!list || list.scrollWidth <= list.clientWidth) return
    setGroup(Math.round((list.scrollLeft / (list.scrollWidth - list.clientWidth)) * (GROUPS - 1)))
  }

  return (
    <section aria-labelledby={titleId} className={cn('container-site', className)}>
      <h2 id={titleId} className="border-b border-border pb-2 text-lg font-bold text-brand">
        {title}
      </h2>
      <ul
        ref={listRef}
        onScroll={onScroll}
        className="scrollbar-none mt-8 grid snap-x snap-mandatory auto-cols-[minmax(180px,1fr)] grid-flow-col gap-6 overflow-x-auto"
      >
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="snap-start">
                <NftCardSkeleton />
              </li>
            ))
          : data?.map((nft) => (
              <li key={nft.id} className="snap-start">
                <NftCard nft={nft} />
              </li>
            ))}
      </ul>
      <div role="group" aria-label={`Navegar em ${title}`} className="mt-8 flex justify-center gap-2.5 xl:hidden">
        {Array.from({ length: GROUPS }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Grupo ${i + 1} de ${GROUPS}`}
            aria-current={group === i ? 'true' : undefined}
            className={cn('size-3 rounded-full border-[1.5px] border-primary', group === i && 'bg-primary')}
          />
        ))}
      </div>
    </section>
  )
}

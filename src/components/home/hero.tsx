import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const SLIDES = [
  { src: '/nfts/emerald-ape.webp', alt: 'Emerald Ape #042: macaco com óculos redondos e jaqueta college verde' },
  { src: '/nfts/ivory-baron.webp', alt: 'Ivory Baron #088: chimpanzé com gola alta verde e blazer creme' },
  { src: '/nfts/golden-beat.webp', alt: 'Golden Beat #207: macaco dourado com fones de ouvido verdes' },
]

function Dots({ index, onSelect, className }: { index: number; onSelect: (i: number) => void; className?: string }) {
  return (
    <div role="group" aria-label="Destaques" className={cn('flex gap-2.5', className)}>
      {SLIDES.map((slide, i) => (
        <button
          key={slide.src}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Destaque ${i + 1} de ${SLIDES.length}`}
          aria-current={i === index ? 'true' : undefined}
          className={cn('size-2 rounded-full bg-primary transition-opacity', i === index ? 'opacity-100' : 'opacity-60 hover:opacity-100')}
        />
      ))}
    </div>
  )
}

const scrollToMarket = () => document.getElementById('mercado')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

/** No autoplay: user-controlled slides keep LCP stable and respect motion preferences. */
export function Hero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index] ?? SLIDES[0]
  if (!slide) return null

  return (
    <section aria-labelledby="hero-title" className="container-site">
      <div className="hidden items-center gap-10 pt-8 md:grid md:grid-cols-[1fr_minmax(0,450px)]">
        <div className="relative flex h-full flex-col justify-center lg:pl-10">
          <p className="text-sm tracking-[0.1em]">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="mt-4 text-4xl leading-[1.6] font-bold tracking-[0.06em] lg:text-[44px] lg:leading-[70px]">
            SEJA DONO DO FUTURO
            <br /> DA ARTE DIGITAL
          </h1>
          <p className="mt-2 max-w-136 text-sm leading-6 text-muted-foreground">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte
            da cultura da internet.
          </p>
          <button
            type="button"
            onClick={scrollToMarket}
            className="mt-10 h-10 w-[140px] rounded-[4px] bg-primary text-base font-bold text-primary-foreground hover:bg-primary/85"
          >
            EXPLORAR
          </button>
          <Dots index={index} onSelect={setIndex} className="absolute right-0 bottom-0 hidden lg:flex" />
        </div>
        {/* LCP element: eager, high priority, explicit size. */}
        <img
          src={slide.src}
          alt={slide.alt}
          width={450}
          height={450}
          fetchPriority="high"
          decoding="async"
          className="aspect-square w-full rounded-[20px] object-cover"
        />
      </div>

      {/* Mobile: compact hero card from the mobile home frame. */}
      <div className="relative mt-4 overflow-hidden rounded-[22px] bg-linear-to-r from-[#5b3a1f] to-surface p-4 md:hidden">
        <div className="grid grid-cols-[1fr_138px] gap-3">
          <div>
            <p className="text-[11px] font-bold">Bem-vindo à Kurio</p>
            <h1 className="mt-2 text-[17px] leading-7 font-bold tracking-[0.06em]">
              SEJA DONO DA
              <br />
              CULTURA DIGITAL
            </h1>
            <p className="mt-2 text-[11px] leading-[18px] text-muted-foreground">Descubra NFTs selecionados de criadores do mundo todo.</p>
            <button type="button" onClick={scrollToMarket} className="mt-1 inline-flex items-center gap-2 text-[11px] font-bold text-brand">
              EXPLORAR <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="relative">
            <img
              src={slide.src}
              alt={slide.alt}
              width={138}
              height={138}
              fetchPriority="high"
              className="aspect-square w-full rounded-[16px] object-cover"
            />
            <img
              src="/nfts/violet-nomad.webp"
              alt=""
              width={56}
              height={56}
              className="absolute -bottom-1 left-2 size-14 rounded-xl border-2 border-surface object-cover"
            />
          </div>
        </div>
        <Dots index={index} onSelect={setIndex} className="mt-2 justify-center" />
      </div>
    </section>
  )
}

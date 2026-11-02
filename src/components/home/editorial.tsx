import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { HomeSearch } from '@/router'

const PROMOS: Array<{ title: string; text: string; image: string; search: HomeSearch; cta: string }> = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/nfts/emerald-ape.webp',
    search: { tab: 'new' },
    cta: 'Explorar lançamentos gênesis',
  },
  {
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/nfts/ivory-baron.webp',
    search: { categories: ['arte-digital'] },
    cta: 'Explorar arte digital',
  },
]

const POSTS = [
  {
    date: '12 de setembro',
    read: 6,
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: '/nfts/ivory-baron.webp',
  },
  {
    date: '13 de setembro',
    read: 2,
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
    image: '/nfts/emerald-ape.webp',
  },
  {
    date: '15 de setembro',
    read: 3,
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: '/nfts/violet-nomad.webp',
  },
  {
    date: '15 de setembro',
    read: 2,
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: '/nfts/golden-beat.webp',
  },
]

/** Promo banners link to real catalog filters, so "Explorar" is functional. */
export function PromoBanners() {
  return (
    <section aria-label="Coleções em destaque" className="container-site mt-24 grid gap-7 lg:grid-cols-2">
      {PROMOS.map((promo) => (
        <article
          key={promo.title}
          className="grid grid-cols-[minmax(0,287px)_1fr] overflow-hidden rounded-[20px] bg-surface max-sm:grid-cols-1"
        >
          <img src={promo.image} alt="" width={287} height={250} loading="lazy" className="h-[250px] w-full rounded-[20px] object-cover" />
          <div className="flex flex-col items-end justify-center gap-3 p-6 text-right">
            <h2 className="text-lg leading-6 font-bold">{promo.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{promo.text}</p>
            <Link
              to="/"
              search={promo.search}
              hash="mercado"
              aria-label={promo.cta}
              className="inline-flex h-10 items-center gap-1 rounded-[4px] bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/85"
            >
              Explorar <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

/** Editorial content is out of scope: "Ler mais" goes to the coming-soon page. */
export function Journal() {
  return (
    <section aria-labelledby="journal-title" className="container-site mt-24">
      <h2 id="journal-title" className="text-center text-2xl font-bold md:text-[28px]">
        Diário da Cunhagem
      </h2>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
      </p>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-[6px] bg-surface">
              <img src={post.image} alt="" width={268} height={195} loading="lazy" className="h-[195px] w-full object-cover" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-xs text-muted-foreground">
                  <time>{post.date}</time> <span aria-hidden>|</span> Leitura de {post.read} min
                </p>
                <h3 className="text-base leading-[21px] font-bold">{post.title}</h3>
                <p className="text-xs leading-4 text-muted-foreground">{post.text}</p>
                <Link
                  to="/em-breve/$section"
                  params={{ section: 'diario' }}
                  aria-label={`Ler mais: ${post.title}`}
                  className="mt-auto text-xs font-bold text-brand hover:underline"
                >
                  Ler mais →
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

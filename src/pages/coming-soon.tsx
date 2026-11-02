import { getRouteApi, Link } from '@tanstack/react-router'
import { MobileTopBar } from '@/components/layout/mobile-nav'

const routeApi = getRouteApi('/em-breve/$section')

const LABELS: Record<string, string> = {
  criadores: 'Criadores',
  aprenda: 'Aprenda',
  diario: 'Diário da Cunhagem',
  atividade: 'Atividade',
  ofertas: 'Ofertas',
  downloads: 'Arquivos baixados',
  suporte: 'Suporte',
  colecao: 'Minha coleção',
  estudio: 'Estúdio do criador',
  ajuda: 'Central de ajuda',
  'como-comprar': 'Como comprar NFTs',
  seguranca: 'Carteira e segurança',
  politica: 'Política do mercado',
  denunciar: 'Denunciar item',
}

/** Out-of-scope sections: explicit message, never a fake success. */
export function ComingSoonPage() {
  const { section } = routeApi.useParams()
  const label = LABELS[section] ?? 'Esta seção'
  return (
    <>
      <MobileTopBar title={label} />
      <section className="container-site flex min-h-[45vh] flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-sm tracking-[0.1em] text-brand">EM BREVE</p>
        <h1 className="text-2xl font-bold">{label}</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Esta área não faz parte da demonstração do marketplace. Os fluxos de descoberta, compra e conta estão disponíveis.
        </p>
        <Link
          to="/"
          hash="mercado"
          className="mt-2 inline-flex h-10 items-center rounded-[4px] bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/85"
        >
          Ir para o mercado
        </Link>
      </section>
    </>
  )
}

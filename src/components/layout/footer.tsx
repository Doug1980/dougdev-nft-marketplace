import { Link } from '@tanstack/react-router'
import { type FormEvent, useId, useState } from 'react'
import type { CategoryId } from '@/api/contracts'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/components/shared/brand-icons'
import { WalletBadges } from '@/components/shared/wallet-badges'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.',
  },
]

type FooterLink = { label: string } & ({ to: '/perfil' | '/perfil/favoritos' } | { section: string } | { category: CategoryId })

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', to: '/perfil' },
      { label: 'Minha coleção', section: 'colecao' },
      { label: 'Atividade', section: 'atividade' },
      { label: 'Estúdio do criador', section: 'estudio' },
      { label: 'Lista de interesse', to: '/perfil/favoritos' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      { label: 'Central de ajuda', section: 'ajuda' },
      { label: 'Como comprar NFTs', section: 'como-comprar' },
      { label: 'Carteira e segurança', section: 'seguranca' },
      { label: 'Política do mercado', section: 'politica' },
      { label: 'Denunciar item', section: 'denunciar' },
    ],
  },
  {
    title: 'Coleções',
    links: [
      { label: 'Arte digital', category: 'arte-digital' },
      { label: 'Fotografia', category: 'fotografia' },
      { label: 'Música', category: 'musica' },
      { label: 'Arte 3D', category: 'arte-3d' },
      { label: 'Utilidade', category: 'utilidade' },
    ],
  },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com', Icon: InstagramIcon },
  { label: 'X (Twitter)', href: 'https://x.com', Icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://www.youtube.com', Icon: YoutubeIcon },
]

const linkClass = 'text-sm text-foreground hover:text-brand'

function FooterLinkItem({ link }: { link: FooterLink }) {
  if ('to' in link)
    return (
      <Link to={link.to} className={linkClass}>
        {link.label}
      </Link>
    )
  if ('section' in link)
    return (
      <Link to="/em-breve/$section" params={{ section: link.section }} className={linkClass}>
        {link.label}
      </Link>
    )
  return (
    <Link to="/" search={{ categories: [link.category] }} hash="mercado" className={linkClass}>
      {link.label}
    </Link>
  )
}

/** Newsletter is out of scope: validates the e-mail but never fakes a successful subscription. */
function Newsletter() {
  const id = useId()
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setMessage({ kind: 'error', text: 'Informe um e-mail válido.' })
    else setMessage({ kind: 'info', text: 'Inscrições na newsletter não estão disponíveis nesta demonstração.' })
  }
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base leading-4 font-bold">Antecipe-se ao próximo lançamento</h2>
      <form onSubmit={submit} noValidate className="flex">
        <label htmlFor={id} className="sr-only">
          Seu e-mail
        </label>
        <input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="digite seu e-mail..."
          aria-invalid={message?.kind === 'error' || undefined}
          aria-describedby={`${id}-msg`}
          className="h-10 min-w-0 flex-1 bg-surface-strong px-3 text-sm text-foreground placeholder:text-subtle"
        />
        <button
          type="submit"
          className="h-10 rounded-r-[4px] bg-primary px-4 text-lg font-bold text-primary-foreground hover:bg-primary/85"
        >
          Enviar
        </button>
      </form>
      <p
        id={`${id}-msg`}
        role="status"
        className={message?.kind === 'error' ? 'text-xs text-destructive' : 'text-xs leading-[22px] text-muted-foreground'}
      >
        {message?.text ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
      </p>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="container-site mt-20 pb-6">
      <div className="bg-surface">
        <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.25fr] lg:gap-0 lg:px-12">
          {FEATURES.map((feature, i) => (
            <div key={feature.letter} className={i > 0 ? 'lg:border-l lg:border-primary lg:pl-4' : 'lg:pr-4'}>
              <span
                aria-hidden
                className="flex size-[74px] items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
              >
                {feature.letter}
              </span>
              <h2 className="mt-3 text-base font-bold">{feature.title}</h2>
              <p className="mt-2 max-w-52 text-sm leading-[22px] text-muted-foreground">{feature.text}</p>
            </div>
          ))}
          <div className="lg:border-l lg:border-primary lg:pl-4">
            <Newsletter />
          </div>
        </div>

        <div className="grid gap-3 bg-surface-strong px-8 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
          <span className="font-bold tracking-[0.12em]">KURIO</span>
          <span>Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="hover:text-brand">
            contato@email.com
          </a>
          <a href="tel:+551140028922" className="hover:text-brand">
            +55 11 4002 8922
          </a>
        </div>

        <div className="grid gap-8 px-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-lg font-bold">{column.title}</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLinkItem link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <h2 className="text-lg font-bold">Redes sociais</h2>
            <ul className="mt-3 flex gap-2">
              {SOCIAL.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (abre em nova aba)`}
                    className="flex size-8 items-center justify-center rounded-[4px] border border-primary text-brand hover:bg-primary hover:text-primary-foreground"
                  >
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
            <h2 className="mt-6 text-lg font-bold">Carteiras compatíveis</h2>
            <WalletBadges className="mt-2" />
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

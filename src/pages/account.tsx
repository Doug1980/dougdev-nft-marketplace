import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { ChartLine, Download, Heart, LogOut, MapPin, ShoppingCart, TriangleAlert, UserRound } from 'lucide-react'
import type { ComponentType } from 'react'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { useLogout } from '@/features/auth'
import { cn } from '@/lib/utils'

type AccountPath = '/perfil' | '/perfil/carteiras' | '/perfil/favoritos'
type MenuItem = { label: string; icon: ComponentType<{ className?: string }> } & ({ to: AccountPath } | { section: string })

/** Sidebar from the profile frame. Items outside the demo scope go to an explicit "coming soon" page. */
const MENU: MenuItem[] = [
  { label: 'Dados do perfil', icon: UserRound, to: '/perfil' },
  { label: 'Carteiras', icon: MapPin, to: '/perfil/carteiras' },
  { label: 'Atividade', icon: ShoppingCart, section: 'atividade' },
  { label: 'Lista de interesse', icon: Heart, to: '/perfil/favoritos' },
  { label: 'Ofertas', icon: ChartLine, section: 'ofertas' },
  { label: 'Arquivos baixados', icon: Download, section: 'downloads' },
  { label: 'Suporte', icon: TriangleAlert, section: 'suporte' },
]

const itemClass = (active: boolean) =>
  cn(
    'flex items-center gap-3 border-l-[6px] px-3 py-3 text-base whitespace-nowrap text-brand hover:bg-surface-strong lg:px-2.5',
    active ? 'border-primary font-medium' : 'border-transparent',
  )

export function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname.replace(/\/$/, '') })
  const logout = useLogout()
  const navigate = useNavigate()
  const title = MENU.find((item) => 'to' in item && item.to === pathname)?.label ?? 'Meu perfil'

  const signOut = () => logout.mutate(undefined, { onSettled: () => void navigate({ to: '/', replace: true }) })

  return (
    <div className="pb-16">
      <MobileTopBar title={title} />
      <div className="container-site grid grid-cols-1 gap-8 md:mt-8 lg:grid-cols-[310px_1fr]">
        <nav aria-label="Meu perfil" className="h-fit min-w-0 bg-surface py-4">
          <h2 className="px-2.5 pb-2 text-lg font-bold max-lg:hidden">Meu perfil</h2>
          {/* Mobile: horizontal scrollable tabs. Desktop: vertical sidebar. */}
          <ul className="scrollbar-none flex gap-1 overflow-x-auto px-2 lg:flex-col lg:gap-0 lg:px-0">
            {MENU.map((item) => {
              const Icon = item.icon
              const content = (
                <>
                  <Icon className="size-5 text-muted-foreground" aria-hidden /> {item.label}
                </>
              )
              if ('to' in item) {
                const active = pathname === item.to
                return (
                  <li key={item.label}>
                    <Link to={item.to} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
                      {content}
                    </Link>
                  </li>
                )
              }
              return (
                <li key={item.label}>
                  <Link to="/em-breve/$section" params={{ section: item.section }} className={itemClass(false)}>
                    {content}
                  </Link>
                </li>
              )
            })}
            <li className="lg:border-t lg:border-border">
              <button
                type="button"
                onClick={signOut}
                disabled={logout.isPending}
                className="flex w-full items-center gap-3 px-3 py-3 text-base font-bold whitespace-nowrap text-brand hover:bg-surface-strong lg:px-4"
              >
                <LogOut className="size-5" aria-hidden /> {logout.isPending ? 'Saindo…' : 'Sair'}
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

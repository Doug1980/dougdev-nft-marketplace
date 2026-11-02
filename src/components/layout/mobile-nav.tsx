import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Heart, House, ScanLine, ShoppingCart, UserRound } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { cartCount, useCart } from '@/features/cart'
import { cn } from '@/lib/utils'
import { SearchDialog } from './header'

/** Mobile top bar for inner screens (back + title), as in the Figma mobile frames. */
export function MobileTopBar({ title, action, className }: { title?: string; action?: ReactNode; className?: string }) {
  const router = useRouter()
  const back = () => (window.history.length > 1 ? router.history.back() : void router.navigate({ to: '/' }))
  return (
    <div className={cn('flex h-16 items-center gap-4 px-6 md:hidden', className)}>
      <button
        type="button"
        onClick={back}
        aria-label="Voltar"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-brand"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      {title && <h1 className="flex-1 truncate text-center text-lg font-bold">{title}</h1>}
      <div className="flex min-w-8 justify-end">{action}</div>
    </div>
  )
}

/** Fixed bottom navigation from the mobile home frame. The center button opens search. */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data } = useCart()
  const count = cartCount(data)
  const [searchOpen, setSearchOpen] = useState(false)
  const itemClass = (active: boolean) =>
    cn('relative flex size-12 items-center justify-center rounded-full', active ? 'text-brand' : 'text-primary/80')

  return (
    <>
      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-0 bottom-0 z-40 h-[74px] rounded-t-[28px] bg-surface shadow-[0_-8px_24px_rgba(0,0,0,0.4)] md:hidden"
      >
        <ul className="mx-auto grid h-full max-w-md grid-cols-5 items-center px-4">
          <li className="flex justify-center">
            <Link to="/" aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined} className={itemClass(pathname === '/')}>
              <House className="size-6" fill="currentColor" aria-hidden />
            </Link>
          </li>
          <li className="flex justify-center">
            <Link to="/perfil/favoritos" aria-label="Favoritos" className={itemClass(pathname === '/perfil/favoritos')}>
              <Heart className="size-6" fill="currentColor" aria-hidden />
            </Link>
          </li>
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar NFTs"
              className="-mt-12 flex size-16 items-center justify-center rounded-full border-[6px] border-background bg-linear-to-br from-primary to-[#8a5126] text-foreground shadow-lg"
            >
              <ScanLine className="size-7" aria-hidden />
            </button>
          </li>
          <li className="flex justify-center">
            <Link to="/carrinho" aria-label={`Carrinho, ${count} itens`} className={itemClass(pathname === '/carrinho')}>
              <ShoppingCart className="size-6" aria-hidden />
              {count > 0 && (
                <span
                  aria-hidden
                  className="absolute top-1 right-1 rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                >
                  {count}
                </span>
              )}
            </Link>
          </li>
          <li className="flex justify-center">
            <Link
              to="/perfil"
              aria-label="Minha conta"
              className={itemClass(pathname.startsWith('/perfil') && pathname !== '/perfil/favoritos')}
            >
              <UserRound className="size-6" fill="currentColor" aria-hidden />
            </Link>
          </li>
        </ul>
      </nav>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}

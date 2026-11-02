import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { LogIn, Menu, Search, ShoppingCart, UserRound } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cartCount, useCart } from '@/features/cart'
import { useSession } from '@/lib/session-store'
import { cn } from '@/lib/utils'

type NavItem = { label: string; match: (path: string) => boolean } & ({ kind: 'home'; hash?: string } | { kind: 'soon'; section: string })

const NAV: NavItem[] = [
  { label: 'Início', kind: 'home', match: (p) => p === '/' },
  { label: 'Mercado', kind: 'home', hash: 'mercado', match: (p) => /^\/(nft|carrinho|pagamento|pedidos)/.test(p) },
  { label: 'Criadores', kind: 'soon', section: 'criadores', match: (p) => p === '/em-breve/criadores' },
  { label: 'Aprenda', kind: 'soon', section: 'aprenda', match: (p) => p === '/em-breve/aprenda' },
]

function NavLink({ item, active, className, onClick }: { item: NavItem; active: boolean; className: string; onClick?: () => void }) {
  if (item.kind === 'soon') {
    return (
      <Link
        to="/em-breve/$section"
        params={{ section: item.section }}
        aria-current={active ? 'page' : undefined}
        className={className}
        onClick={onClick}
      >
        {item.label}
      </Link>
    )
  }
  return (
    <Link to="/" hash={item.hash} aria-current={active ? 'page' : undefined} className={className} onClick={onClick}>
      {item.label}
    </Link>
  )
}

export function CartButton({ className }: { className?: string }) {
  const { data } = useCart()
  const count = cartCount(data)
  return (
    <Link
      to="/carrinho"
      className={cn('relative inline-flex size-10 items-center justify-center rounded-full text-foreground hover:text-brand', className)}
      aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
    >
      <ShoppingCart className="size-6" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  // Opened by state (header and mobile bar share it), so there is no Radix Trigger:
  // remember the focused element and give focus back to it on close.
  const returnFocus = useRef<HTMLElement | null>(null)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onOpenChange(false)
    void navigate({ to: '/', search: { q: value.trim() || undefined }, hash: 'mercado' })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-6 pt-8"
        accentBar={false}
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus.current?.focus()
        }}
      >
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription>Procure por nome, coleção ou ID do token.</DialogDescription>
        <form onSubmit={submit} role="search" className="mt-2 flex gap-2">
          <label htmlFor="global-search" className="sr-only">
            Termo de busca
          </label>
          <Input id="global-search" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: Emerald Ape" />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Header() {
  const session = useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="container-site">
      <div className="flex h-[68px] items-center justify-between gap-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
            <Menu className="size-6" aria-hidden />
          </Button>
          <Link to="/" className="text-sm font-bold tracking-[0.12em]" aria-label="Kurio, página inicial">
            KURIO
          </Link>
        </div>

        <nav aria-label="Principal" className="hidden h-full lg:block">
          <ul className="flex h-full items-stretch gap-10">
            {NAV.map((item) => {
              const active = item.match(pathname)
              return (
                <li key={item.label} className="flex">
                  <NavLink
                    item={item}
                    active={active}
                    className={cn(
                      '-mb-px flex items-center border-b-[3px] border-transparent pt-1 pb-3 text-base transition-colors hover:text-brand',
                      active ? 'border-primary font-bold text-brand' : 'text-foreground',
                    )}
                  />
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" aria-label="Buscar NFTs" onClick={() => setSearchOpen(true)}>
            <Search className="size-6" aria-hidden />
          </Button>
          <CartButton />
          {session.status === 'authenticated' ? (
            <Link
              to="/perfil"
              aria-label={`Minha conta, ${session.user.displayName}`}
              className="inline-flex h-9 items-center gap-2 rounded-[4px] border border-primary px-3 text-sm font-bold text-brand hover:bg-primary/10"
            >
              {session.user.avatarUrl ? (
                <img src={session.user.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <UserRound className="size-5" aria-hidden />
              )}
              <span className="hidden max-w-28 truncate sm:inline">{session.user.displayName}</span>
            </Link>
          ) : (
            <Link
              to="/entrar"
              search={{ redirect: pathname === '/entrar' ? undefined : pathname }}
              className="inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-primary px-2.5 text-base font-bold text-primary-foreground hover:bg-primary/85"
            >
              <LogIn className="size-5" aria-hidden />
              Entrar
            </Link>
          )}
        </div>
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="p-5">
          <SheetTitle className="text-sm font-bold tracking-[0.12em]">KURIO</SheetTitle>
          <nav aria-label="Principal (menu)">
            <ul className="flex flex-col gap-1">
              {NAV.map((item) => (
                <li key={item.label}>
                  <NavLink
                    item={item}
                    active={item.match(pathname)}
                    onClick={() => setMenuOpen(false)}
                    className={cn('block rounded px-2 py-3 text-base', item.match(pathname) ? 'font-bold text-brand' : 'text-foreground')}
                  />
                </li>
              ))}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  )
}

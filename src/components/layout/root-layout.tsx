import { Outlet, useRouterState } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { useAnnouncement } from '@/lib/announcer'
import { Footer } from './footer'
import { Header } from './header'
import { MobileTabBar } from './mobile-nav'

/** Polite and assertive live regions for async feedback (mutations, realtime changes). */
function LiveRegion() {
  const message = useAnnouncement()
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {message.politeness === 'polite' ? message.text : ''}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-assertive">
        {message.politeness === 'assertive' ? message.text : ''}
      </div>
    </>
  )
}

const showsTabBar = (path: string) => path === '/' || path.startsWith('/perfil') || path.startsWith('/em-breve')
const hidesFooter = (path: string) => path.startsWith('/pedidos/') || path.startsWith('/perfil')

export function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const tabBar = showsTabBar(pathname)
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-50 bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      {/* Mobile frames have no top header; inner screens render their own MobileTopBar. */}
      <div className="hidden md:block">
        <Header />
      </div>
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      {!hidesFooter(pathname) && <Footer />}
      {tabBar && (
        <>
          <div aria-hidden className="h-24 md:hidden" />
          <MobileTabBar />
        </>
      )}
      <LiveRegion />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{ classNames: { toast: '!bg-surface !text-foreground !border !border-border !font-mono !rounded-[4px]' } }}
      />
    </>
  )
}

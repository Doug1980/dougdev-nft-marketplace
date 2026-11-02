import { Outlet, useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { useAnnouncement } from '@/lib/announcer'
import { env } from '@/lib/env'
import { Footer } from './footer'
import { Header } from './header'
import { MobileTabBar } from './mobile-nav'
import { PendingOrderBanner } from './pending-order-banner'
import { SessionWatcher } from './session-watcher'

// Demo-only panel: separate chunk, never loaded when mocks are disabled.
const MockPanel = lazy(() => import('./mock-panel').then((module) => ({ default: module.MockPanel })))

/** The demo panel is not part of the page content: load it only after the page has finished loading. */
function DeferredMockPanel() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const show = () => setReady(true)
    if (document.readyState === 'complete') {
      const id = window.setTimeout(show, 1500)
      return () => window.clearTimeout(id)
    }
    window.addEventListener('load', show, { once: true })
    return () => window.removeEventListener('load', show)
  }, [])
  if (!ready) return null
  return (
    <Suspense fallback={null}>
      <MockPanel />
    </Suspense>
  )
}

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
      {/* min-h keeps the footer below the fold while lazy pages load (no layout shift). */}
      <main id="conteudo" tabIndex={-1} className="min-h-dvh outline-none">
        <PendingOrderBanner />
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
      <SessionWatcher />
      {env.enableMocks && <DeferredMockPanel />}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{ classNames: { toast: '!bg-surface !text-foreground !border !border-border !font-mono !rounded-[4px]' } }}
      />
    </>
  )
}

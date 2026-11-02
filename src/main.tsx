import './index.css'
import { createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { env } from '@/lib/env'

/**
 * Startup: app code downloads in parallel with MSW, but nothing renders (and no request is made) before
 * the mock worker is ready. socket.io-client is loaded lazily by the realtime client, after MSW patched WebSocket.
 */
async function bootstrap() {
  const appModule = import('./App')
  const authModule = import('./features/auth')

  if (env.enableMocks) {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  // Revalidate a persisted session before the first render so private routes do not flash the sign-in page.
  const { restoreSession } = await authModule
  await restoreSession()

  const { default: App } = await appModule
  const root = document.getElementById('root')
  if (!root) throw new Error('Missing #root element')
  createRoot(root).render(createElement(StrictMode, null, createElement(App)))
}

void bootstrap()

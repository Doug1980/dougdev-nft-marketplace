import './index.css'
import { createElement, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { env } from '@/lib/env'

/**
 * Order matters: engine.io-client captures `globalThis.WebSocket` at module evaluation.
 * The app (which imports socket.io-client) is loaded only after MSW patches WebSocket in worker.start().
 */
async function bootstrap() {
  if (env.enableMocks) {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }
  // Revalidate a persisted session before the first render so private routes do not flash the sign-in page.
  const { restoreSession } = await import('./features/auth')
  await restoreSession()

  const { default: App } = await import('./App')
  const root = document.getElementById('root')
  if (!root) throw new Error('Missing #root element')
  createRoot(root).render(createElement(StrictMode, null, createElement(App)))
}

void bootstrap()

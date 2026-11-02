import { setupWorker } from 'msw/browser'
import { db } from './db/store'
import { resumePendingOrders } from './domain'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { catalogHandlers } from './handlers/catalog'
import { commerceHandlers } from './handlers/commerce'
import { controlHandlers } from './handlers/control'
import { realtimeHandler } from './realtime'
import { isScenarioId } from './scenarios'

export const handlers = [...controlHandlers, ...authHandlers, ...catalogHandlers, ...commerceHandlers, ...accountHandlers, realtimeHandler]

/**
 * Starts the mock layer before the first render.
 * `?scenario=<id>` selects a scenario; `?resetMocks=1` restores the seed.
 */
export async function startMocks() {
  await db.init()

  const params = new URLSearchParams(window.location.search)
  const scenario = params.get('scenario')
  if (params.has('resetMocks')) await db.reset(isScenarioId(scenario) ? scenario : 'default')
  else if (isScenarioId(scenario)) db.setScenario(scenario)

  const worker = setupWorker(...handlers)
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: import.meta.env.PROD,
    onUnhandledRequest: (request, print) => {
      // App assets and fonts pass through; only unexpected API calls are reported.
      const url = new URL(request.url)
      if (url.origin === window.location.origin && !url.pathname.startsWith('/api')) return
      print.warning()
    },
  })
  resumePendingOrders()
}

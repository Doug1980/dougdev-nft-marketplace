/**
 * Simulation control routes (not part of the product contract).
 * Used by Playwright and the demo scenario panel. Catalog changes go through the
 * data layer and reach the UI only via the simulated Socket.IO server.
 */
import { HttpResponse, http } from 'msw'
import { db } from '../db/store'
import { updateEdition } from '../domain'
import { api, apiError, readAuth, readJson } from '../http'
import { connectionStats, dropAllConnections } from '../realtime'
import { isScenarioId, SCENARIOS } from '../scenarios'

export const controlHandlers = [
  http.get(api('/__mock/state'), () =>
    HttpResponse.json({ scenario: db.state.scenario, scenarios: SCENARIOS, connections: connectionStats() }),
  ),

  http.post(api('/__mock/reset'), async ({ request }) => {
    const scenario = (await readJson<{ scenario?: string }>(request))?.scenario
    await db.reset(isScenarioId(scenario) ? scenario : 'default')
    dropAllConnections()
    return HttpResponse.json({ ok: true, scenario: db.state.scenario })
  }),

  http.post(api('/__mock/scenario'), async ({ request }) => {
    const scenario = (await readJson<{ scenario?: string }>(request))?.scenario
    if (!isScenarioId(scenario)) return apiError(422, 'VALIDATION_ERROR', 'Cenário desconhecido.')
    db.setScenario(scenario)
    return HttpResponse.json({ ok: true, scenario })
  }),

  /** Expires the caller's session (or all sessions) to exercise expiry mid-navigation. */
  http.post(api('/__mock/session/expire'), ({ request }) => {
    const auth = readAuth(request)
    for (const s of db.state.sessions) {
      if (auth.kind !== 'ok' || s.token === auth.session.token) s.expiresAt = Date.now() - 1
    }
    db.commit()
    return HttpResponse.json({ ok: true })
  }),

  /** Changes price/stock of an edition; the simulated server emits `nft.updated`. */
  http.post<{ nftId: string; editionId: string }>(api('/__mock/nfts/:nftId/editions/:editionId'), async ({ params, request }) => {
    const nft = updateEdition(params.nftId, params.editionId, (await readJson<{ price?: string; available?: number }>(request)) ?? {})
    if (!nft) return apiError(404, 'NOT_FOUND', 'NFT ou edição não encontrados.')
    return HttpResponse.json({ ok: true, version: nft.version })
  }),

  http.post(api('/__mock/realtime/drop'), () => {
    dropAllConnections()
    return HttpResponse.json({ ok: true })
  }),
]

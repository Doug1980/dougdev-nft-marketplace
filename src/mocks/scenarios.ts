/**
 * MSW network and business scenarios. Selected via `?scenario=<id>`,
 * the demo scenario panel, or `POST /api/__mock/scenario` (used by Playwright).
 * Fully deterministic: no runtime randomness.
 */
export const SCENARIOS = [
  { id: 'default', label: 'Padrão', description: 'Latência variável curta (120–380 ms) e pagamento confirmado.' },
  { id: 'fast', label: 'Sem latência', description: 'Respostas imediatas. Usado nos testes automatizados.' },
  { id: 'slow', label: 'Rede lenta', description: 'Latência de 2,5 s em todas as chamadas para observar skeletons.' },
  { id: 'out-of-order', label: 'Fora de ordem', description: 'Buscas mais recentes respondem antes das antigas.' },
  { id: 'empty-catalog', label: 'Catálogo vazio', description: 'Listagem de NFTs sem resultados.' },
  { id: 'offline', label: 'Sem conexão', description: 'Falha de rede em todas as chamadas REST e no socket.' },
  { id: 'server-error', label: 'Erro 500', description: 'Catálogo e detalhe respondem HTTP 500.' },
  { id: 'flaky', label: 'Falha transitória', description: 'A primeira chamada de cada rota responde 503; a nova tentativa funciona.' },
  { id: 'favorites-fail', label: 'Favoritos falham', description: 'Inclusão e remoção de favoritos respondem 500.' },
  {
    id: 'price-change',
    label: 'Preço alterado na compra',
    description: 'Ao abrir o pagamento, o preço do primeiro item sobe via nft.updated.',
  },
  { id: 'sold-out', label: 'Edição esgotada na compra', description: 'Ao abrir o pagamento, a edição do primeiro item esgota.' },
  { id: 'order-timeout', label: 'Timeout no pedido', description: 'O pedido é criado, mas a resposta só chega após o timeout do cliente.' },
  { id: 'payment-declined', label: 'Pagamento recusado', description: 'O pedido fica pendente e depois é recusado.' },
  { id: 'wallet-rejected', label: 'Carteira recusa', description: 'A conexão da carteira é recusada.' },
  { id: 'socket-drop', label: 'Queda do socket', description: 'O socket cai após a criação do pedido, que confirma enquanto offline.' },
  { id: 'duplicate-events', label: 'Eventos duplicados', description: 'Cada evento chega duas vezes, seguido de uma versão antiga.' },
] as const

export type ScenarioId = (typeof SCENARIOS)[number]['id']

export const SCENARIO_STORAGE_KEY = 'kurio:mock:scenario'

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && SCENARIOS.some((s) => s.id === value)
}

/** Deterministic latency. `seq` is the request counter. */
export function latencyFor(scenario: ScenarioId, seq: number): number {
  switch (scenario) {
    case 'fast':
      return 0
    case 'slow':
      return 2500
    case 'out-of-order':
      // Each newer request answers faster than the previous one.
      return Math.max(150, 1600 - (seq % 6) * 280)
    default:
      return 120 + ((seq * 97) % 261)
  }
}

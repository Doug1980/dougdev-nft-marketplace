import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Cart } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { env } from '@/lib/env'
import { eth } from '@/lib/money'
import { qk } from '@/lib/query'
import { sessionStore } from '@/lib/session-store'
import { cn } from '@/lib/utils'
import { useRealtime } from '@/realtime/context'

type MockState = { scenario: string; scenarios: ReadonlyArray<{ id: string; label: string; description: string }> }

const LOCAL_PREFIXES = ['kurio:order-attempt', 'kurio:checkout-draft']

/** Simulation control routes (outside the product API, so plain fetch instead of the Axios client). */
async function control<T>(path: string, body?: unknown): Promise<T> {
  const token = sessionStore.token()
  const response = await fetch(`${env.apiUrl}/__mock${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return (await response.json()) as T
}

/**
 * Demo panel: switch MSW scenario, reset data and trigger realtime events.
 * Triggers change the simulated server state; the UI only reacts to what arrives through the socket.
 */
export function MockPanel() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()
  const { status } = useRealtime()
  const connected = status === 'connected'
  const { data, refetch } = useQuery({
    queryKey: ['__mock', 'state'],
    queryFn: () => control<MockState>('/state'),
    enabled: open,
    staleTime: 0,
  })

  const firstCartItem = () =>
    qc
      .getQueriesData<Cart>({ queryKey: qk.cartAll })
      .map(([, cart]) => cart?.items[0])
      .find(Boolean)

  const setScenario = async (scenario: string) => {
    await control('/scenario', { scenario })
    await refetch()
    void qc.invalidateQueries()
    toast.info(`Cenário ativo: ${data?.scenarios.find((s) => s.id === scenario)?.label ?? scenario}`)
  }

  const reset = async () => {
    await control('/reset', { scenario: 'default' })
    sessionStore.clear(null)
    sessionStore.setGuestCartId(null)
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of Object.keys(storage)) if (LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) storage.removeItem(key)
    }
    window.location.assign('/')
  }

  const changeFirstCartItem = async (patch: (item: NonNullable<ReturnType<typeof firstCartItem>>) => object) => {
    const item = firstCartItem()
    if (!item) {
      toast.error('Adicione um item ao carrinho primeiro.')
      return
    }
    await control(`/nfts/${item.nftId}/editions/${item.editionId}`, patch(item))
  }

  const expireSession = async () => {
    if (!sessionStore.token()) {
      toast.error('Entre em uma conta primeiro.')
      return
    }
    await control('/session/expire', {})
    // The next private request receives SESSION_EXPIRED and the SessionWatcher takes over.
    void qc.invalidateQueries({ type: 'active' })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="mock-panel-trigger"
        aria-label="Cenários da simulação"
        className="fixed top-[45%] right-0 z-40 flex items-center gap-1.5 rounded-l-full border border-r-0 border-border bg-surface/95 px-2 py-2 text-xs font-bold text-muted-foreground shadow-lg hover:text-brand md:top-auto md:right-auto md:bottom-4 md:left-3 md:rounded-full md:border-r md:px-3"
      >
        <FlaskConical className="size-4" aria-hidden />
        <span className="hidden md:inline">Cenários</span>
        <span aria-hidden className={cn('size-2 rounded-full', connected ? 'bg-success' : 'bg-destructive')} />
        <span className="sr-only">{connected ? 'tempo real conectado' : 'tempo real desconectado'}</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[min(24rem,92vw)] gap-4 overflow-y-auto p-5">
          <SheetTitle className="text-base font-bold">Cenários da simulação (MSW)</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Tempo real: {connected ? 'conectado' : status}. As mudanças valem para REST e Socket.IO.
          </SheetDescription>

          {data && (
            <RadioGroup
              value={data.scenario}
              onValueChange={(value) => void setScenario(value)}
              aria-label="Cenário ativo"
              className="gap-2"
            >
              {data.scenarios.map((scenario) => (
                <label
                  key={scenario.id}
                  className="flex cursor-pointer gap-3 rounded border border-border p-2 has-data-[state=checked]:border-primary"
                >
                  <RadioGroupItem value={scenario.id} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-bold">{scenario.label}</span>
                    <span className="block text-xs text-muted-foreground">{scenario.description}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-bold">Eventos em tempo real</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void changeFirstCartItem((item) => ({ price: eth.add(item.unitPrice, '0.05') }))}
            >
              Subir preço do 1º item do carrinho
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void changeFirstCartItem(() => ({ available: 0 }))}>
              Esgotar edição do 1º item do carrinho
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void control('/realtime/drop', {})}>
              Derrubar conexão em tempo real
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void expireSession()}>
              Expirar sessão
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={() => void reset()}>
            <RotateCcw className="size-4" aria-hidden /> Restaurar dados iniciais
          </Button>
        </SheetContent>
      </Sheet>
    </>
  )
}

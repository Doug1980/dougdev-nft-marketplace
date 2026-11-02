import { Link } from '@tanstack/react-router'
import { CircleCheck, LoaderCircle, TriangleAlert, Wallet as WalletIcon } from 'lucide-react'
import { NETWORK_LABELS, WALLET_TYPE_LABELS, type Wallet, type WalletSession } from '@/api/contracts'
import { WalletBadges } from '@/components/shared/wallet-badges'
import { Button } from '@/components/ui/button'
import { cn, shortAddress } from '@/lib/utils'

/** Simulated wallet handshake: idle -> connecting -> connected | rejected (user denied in the wallet). */
export type WalletState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; session: WalletSession }
  | { status: 'rejected'; message: string }

export function WalletPanel({
  wallets,
  selectedId,
  onSelect,
  state,
  onConnect,
  onDisconnect,
}: {
  wallets: Wallet[]
  selectedId: string | null
  onSelect: (id: string) => void
  state: WalletState
  onConnect: () => void
  onDisconnect: () => void
}) {
  if (!wallets.length) {
    return (
      <div role="status" className="rounded-[4px] border border-border p-4 text-sm">
        <p>Você ainda não cadastrou carteiras.</p>
        <Link to="/perfil/carteiras" className="mt-2 inline-block font-bold text-brand underline-offset-4 hover:underline">
          Cadastrar carteira
        </Link>
      </div>
    )
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 w-full text-center text-lg font-bold">Carteira e rede</legend>
      <div aria-hidden className="flex items-center gap-3 rounded-[2px] border border-border px-3 py-2.5">
        <span className="size-4 rounded-full border-[1.5px] border-primary" />
        <WalletBadges className="py-1" />
      </div>

      <div role="radiogroup" aria-label="Carteira para pagamento" className="flex flex-col gap-3">
        {wallets.map((wallet) => {
          const checked = wallet.id === selectedId
          return (
            <button
              key={wallet.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onSelect(wallet.id)}
              className={cn(
                'flex items-center gap-4 rounded-[2px] border px-3 py-3 text-left',
                checked ? 'border-foreground' : 'border-border hover:border-primary',
              )}
            >
              <span aria-hidden className="flex size-4 items-center justify-center rounded-full border-[1.5px] border-primary">
                {checked && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-base">{WALLET_TYPE_LABELS[wallet.walletType]}</span>
                <span className="text-xs text-muted-foreground">
                  {wallet.nickname} · {shortAddress(wallet.address)} · {NETWORK_LABELS[wallet.network]}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div aria-live="polite" className="text-sm">
        {state.status === 'connected' ? (
          <p className="flex flex-wrap items-center justify-between gap-2 text-success">
            <span className="flex items-center gap-1.5">
              <CircleCheck className="size-4" aria-hidden /> Carteira conectada ({shortAddress(state.session.address)},{' '}
              {NETWORK_LABELS[state.session.network]})
            </span>
            <button
              type="button"
              onClick={onDisconnect}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Desconectar
            </button>
          </p>
        ) : state.status === 'rejected' ? (
          <div role="alert" className="flex flex-col gap-2 text-destructive">
            <p className="flex items-center gap-1.5">
              <TriangleAlert className="size-4" aria-hidden /> {state.message}
            </p>
            <Button variant="outline" size="sm" onClick={onConnect}>
              Tentar conectar novamente
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={onConnect} disabled={!selectedId || state.status === 'connecting'}>
            {state.status === 'connecting' ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden /> Aguardando aprovação na carteira…
              </>
            ) : (
              <>
                <WalletIcon className="size-4" aria-hidden /> Conectar carteira
              </>
            )}
          </Button>
        )}
      </div>
    </fieldset>
  )
}

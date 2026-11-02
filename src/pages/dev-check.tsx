import { useCatalog } from '@/features/catalog'
import { formatEth } from '@/lib/money'
import { useNftSubscription, useRealtime } from '@/realtime/context'

/** Temporary technical page: validates REST + cache + Socket.IO end to end. Replaced by the Home in step 4. */
export function DevCheckPage() {
  const { data, isPending, isError, error, isFetching } = useCatalog({ page: 1 })
  const { status } = useRealtime()
  const first = data?.items[0]
  useNftSubscription(data?.items.map((item) => item.id) ?? [])

  const bumpPrice = async () => {
    if (!first) return
    const next = (Number(first.price) + 0.1).toFixed(2)
    await fetch(`/api/__mock/nfts/${first.id}/editions/1-50`, { method: 'POST', body: JSON.stringify({ price: next }) })
  }

  return (
    <section className="container-site py-10">
      <h1 className="text-2xl font-bold">Verificação técnica</h1>
      <p className="mt-2 text-sm">
        Socket.IO: <strong className={status === 'connected' ? 'text-success' : 'text-destructive'}>{status}</strong>
        {isFetching && <span className="text-muted-foreground ml-3">atualizando…</span>}
      </p>
      <button
        type="button"
        onClick={() => void bumpPrice()}
        className="bg-primary text-primary-foreground mt-4 h-10 rounded px-4 font-bold"
      >
        Subir preço do 1º NFT em 0.10 (via servidor)
      </button>
      {isPending && <p className="mt-6">Carregando…</p>}
      {isError && <p className="text-destructive mt-6">{error.message}</p>}
      <ul className="mt-6 grid gap-2">
        {data?.items.map((nft) => (
          <li key={nft.id} className="bg-surface flex items-center gap-4 rounded p-2">
            <img src={nft.image} alt="" width={48} height={48} className="size-12 rounded object-cover" />
            <span className="flex-1">{nft.name}</span>
            <span className="text-subtle text-xs">v{nft.version}</span>
            <strong className="text-brand">{formatEth(nft.price)}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}

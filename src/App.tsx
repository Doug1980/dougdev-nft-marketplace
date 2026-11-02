import { Button } from '@/components/ui/button'

const SWATCHES = [
  { name: 'background', className: 'bg-background' },
  { name: 'surface', className: 'bg-surface' },
  { name: 'surface-strong', className: 'bg-surface-strong' },
  { name: 'border', className: 'bg-border' },
  { name: 'primary', className: 'bg-primary' },
  { name: 'brand', className: 'bg-brand' },
  { name: 'muted-foreground', className: 'bg-muted-foreground' },
  { name: 'subtle', className: 'bg-subtle' },
  { name: 'destructive', className: 'bg-destructive' },
]

export default function App() {
  return (
    <main className="container-site py-12">
      <p className="text-sm tracking-[0.1em]">Bem-vindo à Kurio</p>
      <h1 className="mt-4 text-[44px] leading-[70px] font-bold tracking-[0.06em]">
        SEJA DONO DO FUTURO
        <br /> DA ARTE DIGITAL
      </h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">
        Descubra NFTs selecionados de criadores emergentes e consagrados.
      </p>
      <div className="mt-8 flex gap-3">
        <Button>EXPLORAR</Button>
        <Button variant="outline">Favoritar</Button>
      </div>
      <p className="text-brand mt-6 text-lg font-bold">1.19 ETH</p>
      <ul className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-9">
        {SWATCHES.map((s) => (
          <li key={s.name} className="text-xs">
            <span className={`block h-12 rounded border border-white/10 ${s.className}`} />
            {s.name}
          </li>
        ))}
      </ul>
    </main>
  )
}
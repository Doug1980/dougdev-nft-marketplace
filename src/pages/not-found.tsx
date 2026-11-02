import { Link } from '@tanstack/react-router'

export function NotFoundPage() {
  return (
    <section className="container-site flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-brand text-6xl font-bold">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground max-w-md text-sm">O endereço acessado não existe ou foi movido.</p>
      <Link to="/" className="bg-primary text-primary-foreground mt-2 inline-flex h-10 items-center rounded px-6 font-bold">
        Voltar ao início
      </Link>
    </section>
  )
}

/** Temporary page for routes whose screen is built later in step 4. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="container-site py-16">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Tela em construção.</p>
    </section>
  )
}

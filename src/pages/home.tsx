import { CatalogSection } from '@/components/home/catalog-section'
import { Journal, PromoBanners } from '@/components/home/editorial'
import { Hero } from '@/components/home/hero'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function HomePage() {
  useDocumentTitle('Kurio | Marketplace de NFTs')
  return (
    <div className="pt-4 md:pt-0">
      <Hero />
      <CatalogSection />
      <PromoBanners />
      <Journal />
    </div>
  )
}

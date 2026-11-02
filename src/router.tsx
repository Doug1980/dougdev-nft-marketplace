import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type ParsedLocation,
  redirect,
} from '@tanstack/react-router'
import { z } from 'zod'
import { catalogSort, catalogTab, categoryId, networkId } from '@/api/contracts'
import { RootLayout } from '@/components/layout/root-layout'
import { catalogQueryOptions, nftQueryOptions } from '@/features/catalog'
import { sessionStore } from '@/lib/session-store'
import { ComingSoonPage } from '@/pages/coming-soon'
import { HomePage } from '@/pages/home'
import { NotFoundPage } from '@/pages/not-found'
import { PlaceholderPage } from '@/pages/placeholder'

export type RouterContext = { queryClient: QueryClient }

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

/** Private routes: without a session, go to sign-in and come back afterwards. */
export function requireAuth({ location }: { location: ParsedLocation }) {
  const session = sessionStore.get()
  if (session.status === 'authenticated') return
  throw redirect({ to: '/entrar', search: { redirect: location.href, reason: session.reason === 'expired' ? 'expired' : undefined } })
}

const price = z.string().regex(/^\d+(\.\d{1,6})?$/)

/** Catalog state lives in the URL: survives refresh and history navigation. Invalid params are dropped. */
export const homeSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  tab: catalogTab.optional().catch(undefined),
  categories: z.array(categoryId).optional().catch(undefined),
  networks: z.array(networkId).optional().catch(undefined),
  minPrice: price.optional().catch(undefined),
  maxPrice: price.optional().catch(undefined),
  sort: catalogSort.optional().catch(undefined),
  page: z.number().int().min(1).max(999).optional().catch(undefined),
})
export type HomeSearch = z.infer<typeof homeSearchSchema>

export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(['expired']).optional().catch(undefined),
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: homeSearchSchema,
  loaderDeps: ({ search }) => search,
  // Non-blocking prefetch: the page renders skeletons while data loads.
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(catalogQueryOptions({ ...deps, sort: deps.sort ?? 'recent', page: deps.page ?? 1 }))
  },
  component: HomePage,
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$slug',
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftQueryOptions(params.slug))
  },
  // Code-split: the detail bundle loads only when this route is visited.
  component: lazyRouteComponent(() => import('@/pages/nft-detail'), 'NftDetailPage'),
})
const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/pages/cart'), 'CartPage'),
})
const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pagamento',
  beforeLoad: requireAuth,
  component: lazyRouteComponent(() => import('@/pages/checkout'), 'CheckoutPage'),
})
const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pedidos/$orderId',
  beforeLoad: requireAuth,
  component: () => <PlaceholderPage title="Pedido" />,
})
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  validateSearch: authSearchSchema,
  component: lazyRouteComponent(() => import('@/pages/auth'), 'LoginPage'),
})
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: authSearchSchema,
  component: lazyRouteComponent(() => import('@/pages/auth'), 'RegisterPage'),
})
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/perfil', beforeLoad: requireAuth })
const profileIndexRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/',
  component: () => <PlaceholderPage title="Perfil do colecionador" />,
})
const walletsRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/carteiras',
  component: () => <PlaceholderPage title="Carteiras" />,
})
const favoritesRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: '/favoritos',
  component: () => <PlaceholderPage title="Lista de interesse" />,
})
const comingSoonRoute = createRoute({ getParentRoute: () => rootRoute, path: '/em-breve/$section', component: ComingSoonPage })

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftRoute,
  cartRoute,
  checkoutRoute,
  orderRoute,
  loginRoute,
  registerRoute,
  profileRoute.addChildren([profileIndexRoute, walletsRoute, favoritesRoute]),
  comingSoonRoute,
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    // Data lives in TanStack Query; loaders only prefetch.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundPage,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

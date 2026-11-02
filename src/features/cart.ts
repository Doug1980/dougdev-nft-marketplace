import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AddCartItemInput, Cart, NetworkId } from '@/api/contracts'
import { cartApi, quoteApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { announce } from '@/lib/announcer'
import { type CartOwner, qk } from '@/lib/query'
import { sessionStore, useSession } from '@/lib/session-store'

const FIELD_ERRORS = new Set(['COUPON_INVALID', 'COUPON_EXPIRED', 'VALIDATION_ERROR'])
const STALE_CART_ERRORS = new Set(['AVAILABILITY_CONFLICT', 'EDITION_UNAVAILABLE', 'NOT_FOUND'])

export function useCartOwner(): CartOwner {
  const session = useSession()
  return session.status === 'authenticated' ? `user:${session.user.id}` : 'guest'
}

export function useCart() {
  return useQuery({
    queryKey: qk.cart(useCartOwner()),
    queryFn: async ({ signal }) => {
      const cart = await cartApi.get({ signal })
      // First guest visit: the server creates the cart and we persist its id.
      if (!cart.ownerId) sessionStore.setGuestCartId(cart.id)
      return cart
    },
    staleTime: 10_000,
  })
}

export const cartCount = (cart: Cart | undefined) => cart?.items.reduce((acc, item) => acc + item.quantity, 0) ?? 0

/** Cart mutations run serially (shared scope) so rapid clicks never race. */
function useCartMutation<TVars>(mutationFn: (vars: TVars) => Promise<Cart>, successMessage?: (vars: TVars) => string) {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    scope: { id: 'cart' },
    mutationFn,
    onSuccess: (cart, vars) => {
      qc.setQueryData(qk.cart(owner), cart)
      void qc.invalidateQueries({ queryKey: qk.quoteAll })
      const message = successMessage?.(vars)
      if (message) {
        toast.success(message)
        announce(message)
      }
    },
    onError: (error) => {
      const apiError = toApiError(error)
      if (FIELD_ERRORS.has(apiError.code)) return // shown next to the field
      toast.error(apiError.message)
      announce(apiError.message, 'assertive')
      if (STALE_CART_ERRORS.has(apiError.code)) void qc.invalidateQueries({ queryKey: qk.cartAll })
    },
  })
}

export const useAddToCart = () =>
  useCartMutation(
    ({ name: _name, ...input }: AddCartItemInput & { name: string }) => cartApi.add(input),
    (v) => `${v.name} adicionado ao carrinho.`,
  )

export const useUpdateCartItem = () =>
  useCartMutation(
    ({ itemId, quantity }: { itemId: string; quantity: number; name: string }) => cartApi.update(itemId, { quantity }),
    (v) => `Quantidade de ${v.name} atualizada para ${v.quantity}.`,
  )

export const useAcknowledgePrice = () =>
  useCartMutation(({ itemId }: { itemId: string }) => cartApi.update(itemId, { acknowledgePrice: true }))

export const useRemoveCartItem = () =>
  useCartMutation(
    ({ itemId }: { itemId: string; name: string }) => cartApi.remove(itemId),
    (v) => `${v.name} removido do carrinho.`,
  )

export const useApplyCoupon = () =>
  useCartMutation(
    (code: string) => cartApi.applyCoupon(code),
    (code) => `Cupom ${code.toUpperCase()} aplicado.`,
  )

export const useRemoveCoupon = () =>
  useCartMutation(
    () => cartApi.removeCoupon(),
    () => 'Cupom removido.',
  )

/** Totals always come from the API quote. */
export function useQuote(network: NetworkId, context: 'cart' | 'checkout', enabled = true) {
  return useQuery({
    queryKey: qk.quote(useCartOwner(), network, context),
    queryFn: ({ signal }) => quoteApi.create({ network, context }, { signal }),
    enabled,
    staleTime: 0,
    placeholderData: (previous) => previous,
  })
}

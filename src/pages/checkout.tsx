import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import type { z } from 'zod'
import { buyerInput, NETWORK_LABELS, type NetworkId, networkId, type Quote, WALLET_TYPE_LABELS } from '@/api/contracts'
import { cartApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { ReviewDialog } from '@/components/checkout/review-dialog'
import { WalletPanel, type WalletState } from '@/components/checkout/wallet-panel'
import { MobileTopBar } from '@/components/layout/mobile-nav'
import { CouponForm } from '@/components/shared/coupon-form'
import { OrderSummary } from '@/components/shared/order-summary'
import { SelectField } from '@/components/shared/select-field'
import { ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useProfile, useWalletConnection, useWallets } from '@/features/account'
import { useCart, useCartOwner, useQuote } from '@/features/cart'
import { orderAttempts, resumeAttempt, useSubmitOrder } from '@/features/orders'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { announce } from '@/lib/announcer'
import { applyApiErrors } from '@/lib/forms'
import { formatEth } from '@/lib/money'
import { qk } from '@/lib/query'
import { useSession } from '@/lib/session-store'
import { useNftSubscription } from '@/realtime/context'

const checkoutSchema = buyerInput.extend({ network: networkId })
type CheckoutValues = z.input<typeof checkoutSchema>
const BUYER_FIELDS = ['displayName', 'username', 'profileName', 'email', 'ensName', 'referralCode', 'note'] as const

// Form draft in sessionStorage: survives refresh and session expiry (login brings the user back here).
const draftKey = (userId: string) => `kurio:checkout-draft:${userId}`
const draft = {
  load(userId: string): Partial<CheckoutValues> | null {
    try {
      const raw = sessionStorage.getItem(draftKey(userId))
      return raw ? (JSON.parse(raw) as Partial<CheckoutValues>) : null
    } catch {
      return null
    }
  },
  save(userId: string, values: Partial<CheckoutValues>) {
    try {
      sessionStorage.setItem(draftKey(userId), JSON.stringify(values))
    } catch {
      // Storage unavailable: the form still works, only without a draft.
    }
  },
  clear(userId: string) {
    try {
      sessionStorage.removeItem(draftKey(userId))
    } catch {
      // Ignore.
    }
  },
}

export function CheckoutPage() {
  useDocumentTitle('Pagamento | Kurio')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const session = useSession()
  const userId = session.status === 'authenticated' ? session.user.id : ''
  const owner = useCartOwner()

  const cart = useCart()
  const profile = useProfile()
  const wallets = useWallets()
  const submit = useSubmitOrder()
  const connection = useWalletConnection()
  useNftSubscription(cart.data?.items.map((item) => item.nftId) ?? [])

  // ---------- Resume an interrupted attempt (reload or timeout mid-submit) ----------
  const [resuming, setResuming] = useState(() => !!(userId && orderAttempts.load(userId)))
  useEffect(() => {
    if (!userId || !orderAttempts.load(userId)) return
    let cancelled = false
    resumeAttempt(userId)
      .then((order) => {
        if (cancelled || !order) return
        if (order.status !== 'rejected') {
          void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id }, replace: true })
          return
        }
        orderAttempts.clear(userId)
        setResuming(false)
      })
      .catch(() => {
        // Quote changed or the attempt is no longer valid: start a new one.
        orderAttempts.clear(userId)
        if (!cancelled) setResuming(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, navigate])

  // ---------- Form ----------
  const form = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      displayName: '',
      username: '',
      profileName: '',
      email: '',
      ensName: '',
      referralCode: '',
      note: '',
      network: 'ethereum',
      ...(userId ? draft.load(userId) : null),
    },
  })
  const { errors } = form.formState
  const network = useWatch({ control: form.control, name: 'network' }) as NetworkId

  // Prefill once from profile + primary wallet; a saved draft wins over the prefill.
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current || !profile.data || !wallets.data) return
    hydrated.current = true
    const primary = wallets.data.find((w) => w.slot === 'primary') ?? wallets.data[0]
    form.reset({
      displayName: profile.data.displayName,
      username: profile.data.username,
      profileName: primary?.profileName ?? profile.data.username,
      email: profile.data.email,
      ensName: profile.data.ensName,
      referralCode: primary?.referralCode ?? '',
      note: '',
      network: primary?.network ?? 'ethereum',
      ...draft.load(userId),
    })
  }, [profile.data, wallets.data, form, userId])

  useEffect(() => {
    if (!userId) return
    // subscribe() notifies outside React render: saving the draft causes no re-render.
    return form.subscribe({ formState: { values: true }, callback: ({ values }) => draft.save(userId, values) })
  }, [form, userId])

  // ---------- Wallet ----------
  const [walletId, setWalletId] = useState<string | null>(null)
  const primaryWallet = wallets.data?.find((w) => w.slot === 'primary') ?? wallets.data?.[0]
  const selectedWallet = wallets.data?.find((w) => w.id === walletId) ?? primaryWallet
  const secondaryWallet = wallets.data?.find((w) => w.slot === 'secondary')
  const [walletState, setWalletState] = useState<WalletState>({ status: 'idle' })

  const disconnect = () => {
    if (walletState.status === 'connected') connection.disconnect.mutate(walletState.session.id)
    setWalletState({ status: 'idle' })
  }

  // Each wallet belongs to one network: selecting it also selects its network (and the matching fee).
  const selectWallet = (id: string) => {
    if (id === selectedWallet?.id) return
    disconnect()
    setWalletId(id)
    const wallet = wallets.data?.find((w) => w.id === id)
    if (wallet) form.setValue('network', wallet.network, { shouldDirty: true })
  }

  // A wallet session is bound to one network: changing it requires a new connection.
  const changeNetwork = (next: string, onChange: (value: string) => void) => {
    if (next === network) return
    onChange(next)
    if (walletState.status === 'connected') {
      disconnect()
      announce('A rede mudou. Conecte a carteira novamente.')
    }
  }

  const connect = () => {
    if (!selectedWallet) return
    setWalletState({ status: 'connecting' })
    connection.connect.mutate(
      { walletId: selectedWallet.id, network },
      {
        onSuccess: (walletSession) => {
          setWalletState({ status: 'connected', session: walletSession })
          announce('Carteira conectada.')
        },
        onError: (error) => setWalletState({ status: 'rejected', message: toApiError(error).message }),
      },
    )
  }

  // ---------- Quote and review ----------
  const hasItems = !!cart.data?.items.length
  const quote = useQuote(network, 'checkout', hasItems && !resuming)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewed, setReviewed] = useState<Quote | null>(null)
  const [serverStale, setServerStale] = useState<Quote['issues'] | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Derived: the quote changed while the dialog is open (realtime event or refetch).
  const liveStale = reviewOpen && reviewed && quote.data && quote.data.fingerprint !== reviewed.fingerprint ? quote.data.issues : null
  const staleIssues = serverStale ?? liveStale

  useEffect(() => {
    if (liveStale) announce('Os valores do pedido mudaram. Revise antes de confirmar.', 'assertive')
  }, [liveStale])

  const issues = quote.data?.issues ?? []
  const blockingIssues = issues.filter((issue) => issue.kind !== 'price_changed')
  const priceIssues = issues.filter((issue) => issue.kind === 'price_changed')

  const acceptPrices = async () => {
    const itemIds = [...new Set(priceIssues.map((issue) => issue.itemId))]
    for (const itemId of itemIds) await cartApi.update(itemId, { acknowledgePrice: true })
    await qc.invalidateQueries({ queryKey: qk.cart(owner) })
    return (await quote.refetch()).data
  }

  const openReview = form.handleSubmit(
    async () => {
      setSubmitError(null)
      if (walletState.status !== 'connected') {
        toast.error('Conecte a carteira para continuar.')
        announce('Conecte a carteira para continuar.', 'assertive')
        return
      }
      // Always review against a fresh quote.
      const fresh = (await quote.refetch()).data
      setReviewed(fresh ?? null)
      setServerStale(fresh?.issues.length ? fresh.issues : null)
      setReviewOpen(true)
    },
    () => announce('Há campos com erro no formulário.', 'assertive'),
  )

  const acceptNewValues = async () => {
    const fresh = await acceptPrices()
    if (fresh?.issues.some((issue) => issue.kind !== 'price_changed')) {
      setServerStale(fresh.issues)
      return
    }
    setReviewed(fresh ?? null)
    setServerStale(null)
    announce('Novos valores aceitos. Confirme o pedido.')
  }

  const confirm = () => {
    if (!reviewed || walletState.status !== 'connected' || !selectedWallet) return
    setSubmitError(null)
    const values = form.getValues()
    submit.mutate(
      {
        quoteId: reviewed.id,
        quoteFingerprint: reviewed.fingerprint,
        walletId: selectedWallet.id,
        walletSessionId: walletState.session.id,
        network,
        buyer: {
          displayName: values.displayName,
          username: values.username,
          profileName: values.profileName,
          email: values.email,
          ensName: values.ensName,
          referralCode: values.referralCode,
          note: values.note ?? '',
        },
      },
      {
        onSuccess: (order) => {
          draft.clear(userId)
          void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id } })
        },
        onError: (error) => {
          const apiError = toApiError(error)
          if (apiError.code === 'QUOTE_STALE') {
            // Server rejected the reviewed fingerprint: show the new quote and require a new confirmation.
            const details = apiError.details as { quote?: Quote } | undefined
            if (details?.quote) qc.setQueryData(qk.quote(owner, network, 'checkout'), details.quote)
            setServerStale(details?.quote?.issues ?? [])
            orderAttempts.clear(userId)
            announce('Os valores mudaram. Revise e confirme novamente.', 'assertive')
          } else if (apiError.status === 403) {
            // Wallet session expired or does not match.
            setWalletState({ status: 'idle' })
            setSubmitError(apiError.message)
            orderAttempts.clear(userId)
          } else if (apiError.code === 'VALIDATION_ERROR') {
            setReviewOpen(false)
            const message = applyApiErrors(error, form.setError, BUYER_FIELDS)
            if (message) setSubmitError(message)
          } else {
            setSubmitError(`${apiError.message} Seus itens continuam no carrinho.`)
          }
        },
      },
    )
  }

  if (resuming) {
    return (
      <div role="status" className="container-site flex min-h-[40vh] items-center justify-center gap-3 py-20">
        <LoaderCircle className="size-5 animate-spin text-brand" aria-hidden /> Recuperando seu pedido em andamento…
      </div>
    )
  }

  if (cart.isSuccess && !hasItems) {
    return (
      <div className="pb-10">
        <MobileTopBar title="Pagamento com carteira" />
        <div className="container-site py-16 text-center">
          <h1 className="text-xl font-bold">Seu carrinho está vazio</h1>
          <Button asChild className="mt-6">
            <Link to="/" hash="mercado">
              Explorar NFTs
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const field = (name: (typeof BUYER_FIELDS)[number]) => form.register(name)

  return (
    <div className="pb-10">
      <MobileTopBar title="Pagamento com carteira" />
      <nav aria-label="Trilha de navegação" className="container-site hidden pt-8 md:block">
        <ol className="flex gap-2 text-base font-bold">
          <li>
            <Link to="/">Início</Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link to="/carrinho">Carrinho</Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">Pagamento</li>
        </ol>
      </nav>
      <h1 className="sr-only">Pagamento</h1>

      {/* Two columns only from xl: at 1024px the fixed 762px column overflowed. */}
      <div className="container-site mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 xl:grid-cols-[762px_1fr] xl:gap-8">
        <form
          id="checkout-form"
          onSubmit={(event) => void openReview(event)}
          noValidate
          aria-labelledby="buyer-title"
          className="order-2 xl:order-1"
        >
          <h2 id="buyer-title" className="text-lg font-bold">
            Perfil do colecionador
          </h2>
          {profile.isPending || wallets.isPending ? (
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2">
              <FormField label="Nome de exibição" required error={errors.displayName?.message}>
                <Input autoComplete="name" {...field('displayName')} />
              </FormField>
              <FormField label="Nome de usuário" required error={errors.username?.message}>
                <Input autoComplete="username" {...field('username')} />
              </FormField>
              <FormField label="Rede" required error={errors.network?.message}>
                <Controller
                  control={form.control}
                  name="network"
                  render={({ field: networkField }) => (
                    <SelectField
                      value={networkField.value}
                      onChange={(next) => changeNetwork(next, networkField.onChange)}
                      placeholder="Selecione uma rede"
                      options={networkId.options.map((id) => ({ value: id, label: NETWORK_LABELS[id] }))}
                    />
                  )}
                />
              </FormField>
              <FormField label="Nome do perfil" required error={errors.profileName?.message}>
                <Input {...field('profileName')} />
              </FormField>
              <FormField label="Endereço da carteira" required hint="Definido pela carteira selecionada.">
                <Input readOnly value={selectedWallet?.address ?? ''} placeholder="Endereço 0x da carteira" />
              </FormField>
              <FormField label="ENS ou carteira secundária (opcional)">
                <Input
                  readOnly
                  value={secondaryWallet?.secondaryAddress || secondaryWallet?.address || ''}
                  placeholder="ENS ou carteira secundária (opcional)"
                />
              </FormField>
              <FormField label="Tipo de carteira" required>
                <Input
                  readOnly
                  value={selectedWallet ? WALLET_TYPE_LABELS[selectedWallet.walletType] : ''}
                  placeholder="Selecione uma carteira"
                />
              </FormField>
              <FormField label="Código de indicação" required error={errors.referralCode?.message}>
                <Input {...field('referralCode')} />
              </FormField>
              <FormField label="E-mail" required error={errors.email?.message}>
                <Input type="email" autoComplete="email" {...field('email')} />
              </FormField>
              <FormField label="Nome ENS" required error={errors.ensName?.message} hint="Sem o sufixo .eth">
                <Input {...field('ensName')} />
              </FormField>
              {secondaryWallet && (
                <label className="flex cursor-pointer items-center gap-2 text-base md:col-span-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selectedWallet?.id === secondaryWallet.id}
                    onChange={(event) =>
                      selectWallet(event.target.checked ? secondaryWallet.id : (primaryWallet?.id ?? secondaryWallet.id))
                    }
                  />
                  Usar outra carteira? <span className="text-sm text-muted-foreground">({secondaryWallet.nickname})</span>
                </label>
              )}
              <FormField label="Observação do colecionador (opcional)" error={errors.note?.message}>
                <Textarea {...field('note')} />
              </FormField>
            </div>
          )}
        </form>

        <aside aria-labelledby="your-nfts" className="order-1 flex flex-col gap-4 xl:order-2">
          <h2 id="your-nfts" className="text-lg font-bold">
            Seus NFTs
          </h2>
          <div aria-hidden className="flex justify-between text-base font-bold">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          {cart.isPending ? (
            <Skeleton className="h-[70px]" />
          ) : cart.isError ? (
            <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
          ) : (
            <ul className="flex flex-col gap-3">
              {cart.data.items.map((item) => {
                const line = quote.data?.lines.find((l) => l.itemId === item.id)
                return (
                  <li key={item.id} className="flex items-center gap-3 bg-surface p-1 pr-4">
                    <img src={item.image} alt="" width={70} height={70} className="size-[70px] rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold md:text-base">{item.name}</p>
                      <p className="truncate text-xs text-subtle md:text-sm">ID do token: {item.tokenId}</p>
                    </div>
                    <span className="text-sm">(x {item.quantity})</span>
                    <span className="text-lg font-bold whitespace-nowrap text-brand">{line ? formatEth(line.lineTotal) : '-'}</span>
                  </li>
                )
              })}
            </ul>
          )}

          {issues.length > 0 && !reviewOpen && (
            <div role="alert" className="rounded-[4px] border border-destructive/60 p-3 text-sm">
              <ul className="list-disc pl-5 text-muted-foreground">
                {issues.map((issue) => (
                  <li key={issue.itemId + issue.kind}>{issue.message}</li>
                ))}
              </ul>
              {blockingIssues.length > 0 ? (
                <Link to="/carrinho" className="mt-2 inline-block font-bold text-brand underline">
                  Ajustar no carrinho
                </Link>
              ) : (
                <Button size="sm" className="mt-2" onClick={() => void acceptPrices()}>
                  Aceitar novo preço
                </Button>
              )}
            </div>
          )}

          <details className="text-center text-sm">
            <summary className="cursor-pointer list-none">Tem um código promocional? Aplique aqui</summary>
            <div className="mt-3 text-left">{cart.data && <CouponForm appliedCode={cart.data.couponCode} />}</div>
          </details>

          {quote.isError && !quote.data ? (
            <ErrorState
              title="Não foi possível calcular os valores"
              error={quote.error}
              onRetry={() => void quote.refetch()}
              retrying={quote.isFetching}
            />
          ) : (
            <OrderSummary
              quote={quote.data}
              loading={quote.isPending}
              updating={quote.isFetching && !quote.isPending}
              className="border-b border-border pb-4"
            />
          )}

          {wallets.data && (
            <WalletPanel
              wallets={wallets.data}
              selectedId={selectedWallet?.id ?? null}
              onSelect={selectWallet}
              state={walletState}
              onConnect={connect}
              onDisconnect={disconnect}
            />
          )}

          {submitError && !reviewOpen && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}
          <Button
            type="submit"
            form="checkout-form"
            className="h-11 text-base max-md:h-14 max-md:rounded-full"
            disabled={!quote.data || issues.length > 0 || submit.isPending}
          >
            Confirmar compra
          </Button>
        </aside>
      </div>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open)
          if (!open) setServerStale(null)
        }}
        quote={staleIssues ? quote.data : (reviewed ?? undefined)}
        stale={staleIssues}
        wallet={selectedWallet}
        network={network}
        submitting={submit.isPending}
        error={submitError}
        onAccept={() => void acceptNewValues()}
        onConfirm={confirm}
      />
    </div>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { NETWORK_LABELS, networkId, WALLET_TYPE_LABELS, type Wallet, type WalletInput, walletInput, walletType } from '@/api/contracts'
import { SelectField } from '@/components/shared/select-field'
import { ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile, useSaveWallet, useWallets } from '@/features/account'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { applyApiErrors } from '@/lib/forms'

type Slot = WalletInput['slot']

const FIELDS = [
  'displayName',
  'nickname',
  'network',
  'profileName',
  'address',
  'secondaryAddress',
  'walletType',
  'referralCode',
  'email',
  'ensName',
] as const

const SLOT_LABELS: Record<Slot, string> = { primary: 'principal', secondary: 'secundária' }

const emptyWallet = (slot: Slot): WalletInput => ({
  slot,
  displayName: '',
  nickname: '',
  network: 'ethereum',
  profileName: '',
  address: '',
  secondaryAddress: '',
  walletType: 'metamask',
  referralCode: '',
  email: '',
  ensName: '',
})

function toInput(wallet: Wallet): WalletInput {
  const { id: _id, updatedAt: _updatedAt, ...input } = wallet
  return input
}

function WalletForm({ slot, wallet, initial, onSaved }: { slot: Slot; wallet?: Wallet; initial: WalletInput; onSaved?: () => void }) {
  const save = useSaveWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<WalletInput>({ resolver: zodResolver(walletInput), defaultValues: initial })
  const { errors, isSubmitting } = form.formState

  // Reset only when the initial values actually change (serialized to avoid object identity resets).
  const initialKey = JSON.stringify(initial)
  useEffect(() => {
    form.reset(JSON.parse(initialKey) as WalletInput)
  }, [initialKey, form])

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await save.mutateAsync({ walletId: wallet?.id, input: { ...values, slot } })
      toast.success(`Carteira ${SLOT_LABELS[slot]} salva.`)
      onSaved?.()
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, FIELDS))
    }
  })

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      aria-label={`Carteira ${SLOT_LABELS[slot]}`}
      className="mt-7 flex flex-col gap-6"
    >
      <div className="grid gap-x-7 gap-y-5 md:grid-cols-2">
        <FormField label="Nome de exibição" required error={errors.displayName?.message}>
          <Input data-testid={`wallet-${slot}-displayName`} {...form.register('displayName')} />
        </FormField>
        <FormField label="Apelido da carteira" required error={errors.nickname?.message}>
          <Input {...form.register('nickname')} />
        </FormField>
        <FormField label="Rede" required error={errors.network?.message}>
          <Controller
            control={form.control}
            name="network"
            render={({ field }) => (
              <SelectField
                value={field.value}
                onChange={field.onChange}
                placeholder="Selecione uma rede"
                options={networkId.options.map((id) => ({ value: id, label: NETWORK_LABELS[id] }))}
              />
            )}
          />
        </FormField>
        <FormField label="Nome do perfil" required error={errors.profileName?.message}>
          <Input {...form.register('profileName')} />
        </FormField>
        <FormField label="Endereço da carteira" required error={errors.address?.message}>
          <Input placeholder="Endereço 0x da carteira" autoComplete="off" spellCheck={false} {...form.register('address')} />
        </FormField>
        <FormField label="ENS ou carteira secundária (opcional)" error={errors.secondaryAddress?.message}>
          <Input
            placeholder="ENS ou carteira secundária (opcional)"
            autoComplete="off"
            spellCheck={false}
            {...form.register('secondaryAddress')}
          />
        </FormField>
        <FormField label="Tipo de carteira" required error={errors.walletType?.message}>
          <Controller
            control={form.control}
            name="walletType"
            render={({ field }) => (
              <SelectField
                value={field.value}
                onChange={field.onChange}
                placeholder="Selecione uma carteira"
                options={walletType.options.map((type) => ({ value: type, label: WALLET_TYPE_LABELS[type] }))}
              />
            )}
          />
        </FormField>
        <FormField label="Código de indicação" required error={errors.referralCode?.message}>
          <Input {...form.register('referralCode')} />
        </FormField>
        <FormField label="E-mail" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </FormField>
        <FormField label="Nome ENS" required error={errors.ensName?.message} hint="Sem o sufixo .eth">
          <Input {...form.register('ensName')} />
        </FormField>
      </div>
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" className="h-10 w-fit px-4" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-base font-bold text-brand hover:underline">
      Adicionar
    </button>
  )
}

export function WalletsPage() {
  useDocumentTitle('Carteiras | Kurio')
  const wallets = useWallets()
  const profile = useProfile()
  const [addingPrimary, setAddingPrimary] = useState(false)
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  if (wallets.isError) return <ErrorState error={wallets.error} onRetry={() => void wallets.refetch()} />
  if (wallets.isPending) return <Skeleton className="h-[480px]" aria-label="Carregando carteiras" />

  const primary = wallets.data.find((w) => w.slot === 'primary')
  const secondary = wallets.data.find((w) => w.slot === 'secondary')

  // New wallets start with the profile data already filled in.
  const fromProfile = (slot: Slot): WalletInput => ({
    ...emptyWallet(slot),
    displayName: profile.data?.displayName ?? '',
    email: profile.data?.email ?? '',
    ensName: profile.data?.ensName ?? '',
  })

  const secondaryInitial: WalletInput = secondary
    ? toInput(secondary)
    : sameAsPrimary && primary
      ? { ...toInput(primary), slot: 'secondary', nickname: 'Reserva', address: '' }
      : fromProfile('secondary')

  const toggleSameAsPrimary = (checked: boolean) => {
    setSameAsPrimary(checked)
    setAddingSecondary(true)
  }

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="primary-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="text-lg font-bold">
              Carteira principal
            </h1>
            <p className="text-sm text-muted-foreground">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!primary && !addingPrimary && <AddButton onClick={() => setAddingPrimary(true)} />}
        </div>
        {primary || addingPrimary ? (
          <WalletForm slot="primary" wallet={primary} initial={primary ? toInput(primary) : fromProfile('primary')} />
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Você ainda não adicionou uma carteira principal.</p>
        )}
      </section>

      <section aria-labelledby="secondary-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="secondary-title" className="text-lg font-bold">
              Carteira secundária
            </h2>
            {!secondary && !addingSecondary && (
              <p className="text-sm text-muted-foreground">Você ainda não adicionou uma carteira secundária.</p>
            )}
          </div>
          {!secondary && (
            <div className="flex items-center gap-3">
              {primary && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={sameAsPrimary}
                    onChange={(event) => toggleSameAsPrimary(event.target.checked)}
                  />
                  Igual à carteira principal
                </label>
              )}
              {!addingSecondary && <AddButton onClick={() => setAddingSecondary(true)} />}
            </div>
          )}
        </div>
        {(secondary || addingSecondary) && (
          <>
            {sameAsPrimary && !secondary && (
              <p className="mt-2 text-xs text-muted-foreground">Dados copiados da carteira principal. Informe um endereço diferente.</p>
            )}
            <WalletForm slot="secondary" wallet={secondary} initial={secondaryInitial} onSaved={() => setAddingSecondary(false)} />
          </>
        )}
      </section>
    </div>
  )
}

import { X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { toApiError } from '@/api/errors'
import { useApplyCoupon, useRemoveCoupon } from '@/features/cart'
import { cn } from '@/lib/utils'

/**
 * Coupon is validated by the API (never on the client). Invalid/expired errors show next to the field.
 * "desktop" is the boxed input from the desktop frame; "pill" is the rounded mobile variant.
 */
export function CouponForm({ appliedCode, variant = 'desktop' }: { appliedCode: string | null; variant?: 'desktop' | 'pill' }) {
  const id = useId()
  const [code, setCode] = useState('')
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const error = apply.error ? toApiError(apply.error) : null
  const message = error ? (error.fields.code ?? error.message) : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    apply.mutate(trimmed, { onSuccess: () => setCode('') })
  }

  if (appliedCode) {
    return (
      <div role="status" className="flex items-center justify-between rounded-[4px] border border-primary/60 px-3 py-2 text-sm">
        <span>
          Cupom <strong className="text-brand">{appliedCode}</strong> aplicado
        </span>
        <button
          type="button"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          aria-label={`Remover cupom ${appliedCode}`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden /> Remover
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={id} className={cn('text-sm font-bold', variant === 'pill' && 'sr-only')}>
        Código promocional
      </label>
      <div className={cn('flex', variant === 'pill' && 'rounded-full border border-input p-1 pl-4')}>
        <input
          id={id}
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
            apply.reset()
          }}
          placeholder={variant === 'pill' ? 'Código promocional' : 'Digite o código promocional...'}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          autoComplete="off"
          className={cn(
            'h-10 min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground placeholder:text-subtle',
            variant === 'desktop' && 'border border-primary',
          )}
        />
        <button
          type="submit"
          disabled={apply.isPending}
          className={cn(
            'h-10 bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/85 disabled:opacity-60',
            variant === 'pill' ? 'rounded-full' : 'rounded-r-[2px]',
          )}
        >
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {message && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
    </form>
  )
}

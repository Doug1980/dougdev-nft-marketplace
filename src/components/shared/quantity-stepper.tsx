import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Quantity control bounded by availability and the per-order cap. Value is announced via <output>. */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  size = 'md',
  disabled,
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  label: string
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}) {
  const button = cn(
    'flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-40',
    size === 'md' ? 'h-12 w-8' : 'size-5',
  )
  const icon = size === 'md' ? 'size-5' : 'size-3'
  return (
    <div role="group" aria-label={label} className={cn('flex items-center', size === 'md' ? 'gap-3' : 'gap-2.5', className)}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Diminuir quantidade de ${label}`}
      >
        <Minus className={icon} strokeWidth={3} aria-hidden />
      </button>
      <output
        aria-live="polite"
        aria-label={`Quantidade de ${label}`}
        className={cn('min-w-5 text-center', size === 'md' ? 'text-xl' : 'text-base')}
      >
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Aumentar quantidade de ${label}`}
      >
        <Plus className={icon} strokeWidth={3} aria-hidden />
      </button>
    </div>
  )
}

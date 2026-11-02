import { cloneElement, type ReactElement, type ReactNode, useId } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

/**
 * Wires label, control, hint and error together (htmlFor, aria-invalid, aria-describedby).
 * The red asterisk from the layout is decorative; "required" is announced to screen readers.
 */
export function FormField({
  label,
  required,
  error,
  hint,
  hideLabel,
  className,
  children,
}: {
  label: ReactNode
  required?: boolean
  error?: string
  hint?: ReactNode
  hideLabel?: boolean
  className?: string
  children: ReactElement<Record<string, unknown>>
}) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className={cn('text-sm font-normal', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="-ml-1 text-destructive">
              *
            </span>
            <span className="sr-only">(obrigatório)</span>
          </>
        )}
      </Label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

import type { ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * shadcn Select with the same accessibility contract as an input:
 * receives id, aria-invalid and aria-describedby from FormField and forwards them to the trigger.
 */
export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  ...aria
}: {
  value: string | undefined
  onChange: (value: string) => void
  options: Array<{ value: string; label: ReactNode }>
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-required'?: boolean
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className ?? 'h-10 w-full rounded-[2px] bg-background px-3 text-sm data-[size=default]:h-10'} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="rounded-[4px] border border-border bg-surface text-foreground">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

import { cn } from 'cn'
import type * as React from 'react'

function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-[2px] border border-input bg-background px-3 text-sm text-foreground transition-colors outline-none placeholder:text-subtle',
        'focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary',
        'disabled:cursor-not-allowed disabled:opacity-60 read-only:text-muted-foreground',
        'aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { Slot } from 'radix-ui'
import type * as React from 'react'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-[4px] border border-transparent font-bold tracking-wide whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85',
        outline: 'border-primary bg-transparent font-medium text-brand hover:bg-primary/10',
        secondary: 'border-border bg-surface text-foreground hover:border-primary',
        ghost: 'bg-transparent hover:bg-muted hover:text-foreground',
        destructive: 'bg-destructive/15 text-destructive hover:bg-destructive/25',
        link: 'p-0 font-medium text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-6 text-sm',
        sm: 'h-8 px-3 text-sm',
        lg: 'h-11 px-8 text-base',
        pill: 'h-14 rounded-full px-8 text-base',
        icon: 'size-10 rounded-full',
        'icon-sm': 'size-8 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  type,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      // Explicit type avoids accidental form submits.
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

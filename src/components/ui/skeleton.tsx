import { cn } from 'cn'
import type * as React from 'react'

/** Shimmer skeleton. Reduced-motion users get a static block (global rule in index.css). */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-strong/70',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-linear-to-r before:from-transparent before:via-foreground/10 before:to-transparent',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }

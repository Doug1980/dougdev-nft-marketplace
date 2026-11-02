import { RotateCcw, SearchX, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { errorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Error state with retry. role="alert" makes screen readers announce it. */
export function ErrorState({
  error,
  onRetry,
  retrying,
  title = 'Não foi possível carregar',
  className,
}: {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  title?: string
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-[4px] border border-destructive/40 bg-surface px-6 py-10 text-center',
        className,
      )}
    >
      <TriangleAlert className="size-8 text-destructive" aria-hidden />
      <p className="text-base font-bold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button onClick={onRetry} disabled={retrying} className="mt-2">
          <RotateCcw className={cn('size-4', retrying && 'animate-spin')} aria-hidden />
          {retrying ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div role="status" className={cn('flex flex-col items-center gap-3 rounded-[4px] bg-surface px-6 py-12 text-center', className)}>
      <SearchX className="size-8 text-brand" aria-hidden />
      <p className="text-base font-bold">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

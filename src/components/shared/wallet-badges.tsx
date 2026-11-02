import { cn } from '@/lib/utils'

/** "METAMASK • WALLETCONNECT • COINBASE" badge from the footer and checkout frames. */
export function WalletBadges({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-[4px] border border-primary/60 bg-surface-strong px-2.5 py-1.5 text-[9px] font-bold tracking-wide text-brand',
        className,
      )}
    >
      <span>METAMASK</span>
      <span aria-hidden>•</span>
      <span>WALLETCONNECT</span>
      <span aria-hidden>•</span>
      <span>COINBASE</span>
    </p>
  )
}

import { Eye, EyeOff } from 'lucide-react'
import { type ComponentProps, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Password input with a show/hide toggle (aria-pressed tells screen readers the current state). */
export function PasswordInput({ className, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center text-subtle hover:text-foreground"
      >
        {visible ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
      </button>
    </div>
  )
}

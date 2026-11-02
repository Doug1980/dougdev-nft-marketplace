import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { type ReactNode, useState } from 'react'
import { useForm } from 'react-hook-form'
import { type LoginInput, loginInput, type RegisterInput, registerInput } from '@/api/contracts'
import { Hero } from '@/components/home/hero'
import { FacebookBrandIcon, GoogleIcon } from '@/components/shared/brand-icons'
import { PasswordInput } from '@/components/shared/password-input'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { useLogin, useRegister } from '@/features/auth'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { applyApiErrors, safeRedirect } from '@/lib/forms'
import { cn } from '@/lib/utils'

const loginApi = getRouteApi('/entrar')
const registerApi = getRouteApi('/cadastro')

const PRIVATE_PREFIXES = ['/pagamento', '/pedidos', '/perfil']

/** Explicit notice for features outside the demo scope: never fake a success. */
function OutOfScope({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <p
      role="status"
      className="flex items-start justify-between gap-2 rounded-[4px] border border-border bg-background px-3 py-2 text-xs text-muted-foreground"
    >
      {message}
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="shrink-0 text-subtle hover:text-foreground">
        <X className="size-3.5" aria-hidden />
      </button>
    </p>
  )
}

function SocialLogin() {
  const [notice, setNotice] = useState(false)
  const socialClass = 'h-10 rounded-[2px] border border-input text-xs font-medium text-muted-foreground'
  return (
    <div className="flex flex-col gap-3">
      <div className="relative my-2 flex items-center justify-center md:-mx-20">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
        <span className="relative bg-background px-3 text-xs md:bg-surface">Ou continue com</span>
      </div>
      <Button variant="ghost" className={socialClass} onClick={() => setNotice(true)}>
        <GoogleIcon /> Continuar com Google
      </Button>
      <Button variant="ghost" className={socialClass} onClick={() => setNotice(true)}>
        <FacebookBrandIcon /> Continuar com Facebook
      </Button>
      {notice && (
        <OutOfScope message="Login social não está disponível nesta demonstração. Use e-mail e senha." onClose={() => setNotice(false)} />
      )}
    </div>
  )
}

/**
 * Desktop: dialog over the Home hero (Figma Desktop/Login).
 * Mobile: full screen (Figma Mobile/Login). Same component, layout switched by breakpoint.
 * Closing goes back to the origin, unless the origin is private (then Home).
 */
function AuthShell({
  mode,
  redirect,
  description,
  children,
}: {
  mode: 'login' | 'register'
  redirect?: string
  description: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  const close = () => {
    const target = safeRedirect(redirect)
    const isPrivate = PRIVATE_PREFIXES.some((prefix) => target.startsWith(prefix))
    void navigate({ to: isPrivate ? '/' : target, replace: true })
  }

  return (
    <>
      {/* Decorative backdrop: inert removes it from focus and the accessibility tree. */}
      <div inert aria-hidden className="pointer-events-none hidden select-none md:block">
        <Hero />
      </div>
      <DialogPrimitive.Root open onOpenChange={(open) => !open && close()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 hidden bg-black/50 md:block" />
          <DialogPrimitive.Content
            aria-describedby="auth-description"
            className={cn(
              'fixed inset-0 z-50 overflow-y-auto bg-background px-6 pt-16 pb-10 text-foreground focus:outline-none',
              'md:inset-auto md:top-[160px] md:left-1/2 md:w-[500px] md:-translate-x-1/2 md:border-b-[10px] md:border-primary md:bg-surface md:px-20 md:pt-12 md:pb-24',
            )}
          >
            <p className="mb-16 text-center text-3xl font-bold tracking-[0.12em] md:hidden" aria-hidden>
              KURIO
            </p>
            <DialogPrimitive.Title asChild>
              <h1 className="flex items-center justify-center gap-2 text-xl">
                <Link
                  to="/entrar"
                  search={{ redirect }}
                  replace
                  aria-current={mode === 'login' ? 'page' : undefined}
                  className={cn(mode === 'login' ? 'text-brand max-md:text-foreground' : 'max-md:hidden')}
                >
                  Entrar
                </Link>
                <span aria-hidden className="h-5 w-px bg-primary max-md:hidden" />
                <Link
                  to="/cadastro"
                  search={{ redirect }}
                  replace
                  aria-current={mode === 'register' ? 'page' : undefined}
                  className={cn(mode === 'register' ? 'text-brand max-md:text-foreground' : 'max-md:hidden')}
                >
                  <span className="md:hidden">{mode === 'register' ? 'Criar perfil de colecionador' : 'Criar conta'}</span>
                  <span className="max-md:hidden">Criar conta</span>
                </Link>
              </h1>
            </DialogPrimitive.Title>
            <DialogPrimitive.Description id="auth-description" className="mt-6 hidden text-center text-sm md:block">
              {description}
            </DialogPrimitive.Description>
            <div className="mt-8">{children}</div>
            <DialogPrimitive.Close className="absolute top-5 right-5 text-brand hover:text-foreground" aria-label="Fechar">
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  )
}

export function LoginPage() {
  useDocumentTitle('Entrar | Kurio')
  const { redirect, reason } = loginApi.useSearch()
  const navigate = useNavigate()
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)
  const form = useForm<LoginInput>({ resolver: zodResolver(loginInput), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login.mutateAsync(values)
      void navigate({ to: safeRedirect(redirect), replace: true })
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, ['email', 'password']))
    }
  })

  return (
    <AuthShell mode="login" redirect={redirect} description="Entre para gerenciar sua carteira, coleção e perfil de criador.">
      {reason === 'expired' && (
        <p role="status" className="mb-4 rounded-[4px] border border-primary/60 px-3 py-2 text-sm text-brand">
          Sua sessão expirou. Entre novamente para retomar de onde parou.
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <FormField label="E-mail" hideLabel error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="contato@email.com" {...form.register('email')} />
        </FormField>
        <FormField label="Senha" hideLabel error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" placeholder="Senha" {...form.register('password')} />
        </FormField>
        <button type="button" onClick={() => setForgot(true)} className="self-end text-sm text-brand hover:underline">
          Esqueceu a senha?
        </button>
        {forgot && <OutOfScope message="A recuperação de senha não faz parte desta demonstração." onClose={() => setForgot(false)} />}
        <FormError message={formError} />
        <Button type="submit" disabled={isSubmitting} className="mt-4 h-11 rounded-[2px] text-base max-md:h-14">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <div className="mt-6">
        <SocialLogin />
      </div>
      <p className="mt-10 text-center text-sm md:hidden">
        Novo na Kurio?{' '}
        <Link to="/cadastro" search={{ redirect }} className="text-brand">
          Crie uma conta
        </Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  useDocumentTitle('Criar conta | Kurio')
  const { redirect } = registerApi.useSearch()
  const navigate = useNavigate()
  const register = useRegister()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerInput),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null)
    try {
      await register.mutateAsync(values)
      void navigate({ to: safeRedirect(redirect), replace: true })
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, ['username', 'email', 'password', 'confirmPassword']))
    }
  })

  return (
    <AuthShell mode="register" redirect={redirect} description="Crie seu perfil de colecionador e conecte uma carteira quando quiser.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <FormField label="Nome de usuário" hideLabel error={errors.username?.message}>
          <Input autoComplete="username" placeholder="Nome de usuário" {...form.register('username')} />
        </FormField>
        <FormField label="E-mail" hideLabel error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="Digite seu e-mail" {...form.register('email')} />
        </FormField>
        <FormField label="Senha" hideLabel error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          <PasswordInput autoComplete="new-password" placeholder="Senha" {...form.register('password')} />
        </FormField>
        <FormField label="Confirmar senha" hideLabel error={errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" placeholder="Confirmar senha" {...form.register('confirmPassword')} />
        </FormField>
        <FormError message={formError} />
        <Button type="submit" disabled={isSubmitting} className="mt-4 h-11 rounded-[2px] text-base max-md:h-14">
          {isSubmitting ? (
            'Criando conta…'
          ) : (
            <>
              <span className="md:hidden">Criar perfil</span>
              <span className="max-md:hidden">Criar conta</span>
            </>
          )}
        </Button>
      </form>
      <div className="mt-6">
        <SocialLogin />
      </div>
      <p className="mt-10 text-center text-sm md:hidden">
        Já tem uma conta?{' '}
        <Link to="/entrar" search={{ redirect }} className="text-brand">
          Entre
        </Link>
      </p>
    </AuthShell>
  )
}

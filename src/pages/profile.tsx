import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus } from 'lucide-react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { type PasswordChangeInput, passwordChangeInput, profileInput } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { PasswordInput } from '@/components/shared/password-input'
import { ErrorState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAvatar, useChangePassword, useProfile, useUpdateProfile } from '@/features/account'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { applyApiErrors } from '@/lib/forms'

const EMPTY_PASSWORD = { currentPassword: '', newPassword: '', confirmPassword: '' }

/** Password change shares the same "Salvar": it is validated only when one of its fields is filled. */
const optionalPassword = z
  .object({ currentPassword: z.string(), newPassword: z.string(), confirmPassword: z.string() })
  .superRefine((value, ctx) => {
    if (!value.currentPassword && !value.newPassword && !value.confirmPassword) return
    const result = passwordChangeInput.safeParse(value)
    if (result.success) return
    for (const issue of result.error.issues) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
  })

const schema = profileInput.extend({ password: optionalPassword })
type Values = z.infer<typeof schema>

const AVATAR_TYPES = /^image\/(png|jpe?g|webp|gif)$/
const MAX_AVATAR_BYTES = 1_500_000

/** Avatar is validated on the client (type and size) before upload, and again by the API. */
function AvatarField() {
  const profile = useProfile()
  const avatar = useAvatar()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const url = profile.data?.avatarUrl

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allows choosing the same file again
    if (!file) return
    if (!AVATAR_TYPES.test(file.type)) return setError('Use uma imagem PNG, JPG, WEBP ou GIF.')
    if (file.size > MAX_AVATAR_BYTES) return setError('A imagem deve ter no máximo 1,5 MB.')
    setError(null)
    const reader = new FileReader()
    reader.onload = () =>
      avatar.set.mutate(String(reader.result), {
        onSuccess: () => toast.success('Avatar atualizado.'),
        onError: (err) => setError(errorMessage(err)),
      })
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <span id="avatar-label" className="text-sm">
        Avatar
      </span>
      <div role="group" aria-labelledby="avatar-label" className="flex items-center gap-6">
        <span className="flex size-[50px] items-center justify-center overflow-hidden rounded-full border border-border bg-surface">
          {url ? (
            <img src={url} alt="Seu avatar atual" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6 text-brand" aria-label="Sem avatar" />
          )}
        </span>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onFile}
          aria-label="Escolher imagem de avatar"
          tabIndex={-1}
          data-testid="avatar-input"
          className="sr-only"
        />
        <Button size="sm" className="h-10 px-6" onClick={() => input.current?.click()} disabled={avatar.set.isPending}>
          {avatar.set.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        {url && (
          <Button
            variant="ghost"
            size="sm"
            className="font-normal"
            onClick={() => avatar.remove.mutate(undefined, { onSuccess: () => toast.success('Avatar removido.') })}
            disabled={avatar.remove.isPending}
          >
            Remover
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function ProfilePage() {
  useDocumentTitle('Perfil do colecionador | Kurio')
  const profile = useProfile()
  const update = useUpdateProfile()
  const changePassword = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', username: '', email: '', ensName: '', walletNickname: '', password: EMPTY_PASSWORD },
  })
  const { errors, isSubmitting } = form.formState

  // Fill the form when the profile arrives (or changes after save).
  useEffect(() => {
    if (!profile.data) return
    const { displayName, username, email, ensName, walletNickname } = profile.data
    form.reset({ displayName, username, email, ensName, walletNickname, password: EMPTY_PASSWORD })
  }, [profile.data, form])

  const onSubmit = form.handleSubmit(async ({ password, ...data }) => {
    setFormError(null)
    try {
      await update.mutateAsync(data)
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, ['displayName', 'username', 'email', 'ensName', 'walletNickname']))
      return
    }

    if (!password.currentPassword && !password.newPassword) {
      toast.success('Perfil atualizado.')
      return
    }

    try {
      await changePassword.mutateAsync(password as PasswordChangeInput)
      form.setValue('password', EMPTY_PASSWORD)
      toast.success('Perfil e senha atualizados.')
    } catch (error) {
      // API field names are relative to the password group ("currentPassword" -> "password.currentPassword").
      const message = applyApiErrors<PasswordChangeInput>(
        error,
        (field, err, options) => form.setError(`password.${field as keyof PasswordChangeInput}`, err, options),
        ['currentPassword', 'newPassword', 'confirmPassword'],
      )
      setFormError(message ?? 'Dados salvos, mas a senha não foi alterada.')
    }
  })

  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />

  return (
    <section aria-labelledby="profile-title">
      <h1 id="profile-title" className="text-base font-bold">
        Perfil do colecionador
      </h1>
      {profile.isPending ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="mt-8 flex flex-col gap-8">
          <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
            <FormField label="Nome de exibição" required error={errors.displayName?.message}>
              <Input autoComplete="name" {...form.register('displayName')} />
            </FormField>
            <FormField label="Nome de usuário" required error={errors.username?.message}>
              <Input autoComplete="username" {...form.register('username')} />
            </FormField>
            <FormField label="E-mail" required error={errors.email?.message}>
              <Input type="email" autoComplete="email" {...form.register('email')} />
            </FormField>
            <FormField label="Nome ENS" required error={errors.ensName?.message} hint="Sem o sufixo .eth">
              <Input {...form.register('ensName')} />
            </FormField>
            <FormField label="Apelido da carteira" required error={errors.walletNickname?.message}>
              <Input {...form.register('walletNickname')} />
            </FormField>
            <AvatarField />
          </div>

          <fieldset className="flex max-w-[417px] flex-col gap-5">
            <legend className="mb-5 text-base font-bold">Alterar senha</legend>
            <FormField label="Senha atual" error={errors.password?.currentPassword?.message}>
              <PasswordInput autoComplete="current-password" {...form.register('password.currentPassword')} />
            </FormField>
            <FormField
              label="Nova senha"
              error={errors.password?.newPassword?.message}
              hint="Mínimo de 8 caracteres, com letras e números."
            >
              <PasswordInput autoComplete="new-password" {...form.register('password.newPassword')} />
            </FormField>
            <FormField label="Confirmar nova senha" error={errors.password?.confirmPassword?.message}>
              <PasswordInput autoComplete="new-password" {...form.register('password.confirmPassword')} />
            </FormField>
          </fieldset>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button type="submit" className="h-10 w-[131px]" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      )}
    </section>
  )
}

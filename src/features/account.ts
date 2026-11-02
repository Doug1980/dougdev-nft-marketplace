import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NetworkId, PasswordChangeInput, ProfileInput, User, Wallet, WalletInput } from '@/api/contracts'
import { profileApi, walletApi } from '@/api/endpoints'
import { announce } from '@/lib/announcer'
import { qk } from '@/lib/query'
import { sessionStore, useSession } from '@/lib/session-store'

function useUserId() {
  const session = useSession()
  return session.status === 'authenticated' ? session.user.id : null
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.profile(userId ?? 'anonymous'),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: userId !== null,
  })
}

function useOnUserSaved() {
  const qc = useQueryClient()
  const userId = useUserId()
  return (user: User) => {
    qc.setQueryData(qk.profile(userId ?? 'anonymous'), user)
    sessionStore.updateUser(user)
  }
}

export function useUpdateProfile() {
  const onSaved = useOnUserSaved()
  return useMutation({
    mutationFn: (input: ProfileInput) => profileApi.update(input),
    onSuccess: (user) => {
      onSaved(user)
      announce('Perfil atualizado.')
    },
  })
}

export function useAvatar() {
  const onSaved = useOnUserSaved()
  return {
    set: useMutation({
      mutationFn: (dataUrl: string) => profileApi.setAvatar(dataUrl),
      onSuccess: (user) => {
        onSaved(user)
        announce('Avatar atualizado.')
      },
    }),
    remove: useMutation({
      mutationFn: () => profileApi.removeAvatar(),
      onSuccess: (user) => {
        onSaved(user)
        announce('Avatar removido.')
      },
    }),
  }
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: PasswordChangeInput) => profileApi.changePassword(input),
    onSuccess: () => announce('Senha alterada.'),
  })
}

export function useWallets() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.wallets(userId ?? 'anonymous'),
    queryFn: ({ signal }) => walletApi.list({ signal }),
    enabled: userId !== null,
  })
}

export function useSaveWallet() {
  const qc = useQueryClient()
  const key = qk.wallets(useUserId() ?? 'anonymous')
  return useMutation({
    mutationFn: ({ walletId, input }: { walletId?: string; input: WalletInput }) =>
      walletId ? walletApi.update(walletId, input) : walletApi.create(input),
    onSuccess: (wallet) => {
      qc.setQueryData<Wallet[]>(key, (old = []) =>
        old.some((w) => w.id === wallet.id) ? old.map((w) => (w.id === wallet.id ? wallet : w)) : [...old, wallet],
      )
      announce(`Carteira ${wallet.slot === 'primary' ? 'principal' : 'secundária'} salva.`)
    },
  })
}

export function useWalletConnection() {
  return {
    connect: useMutation({
      mutationFn: ({ walletId, network }: { walletId: string; network: NetworkId }) => walletApi.connect(walletId, network),
    }),
    disconnect: useMutation({ mutationFn: (sessionId: string) => walletApi.disconnect(sessionId) }),
  }
}

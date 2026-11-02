import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Favorites } from '@/api/contracts'
import { favoritesApi } from '@/api/endpoints'
import { errorMessage } from '@/api/errors'
import { announce } from '@/lib/announcer'
import { qk } from '@/lib/query'
import { useSession } from '@/lib/session-store'

function useUserId() {
  const session = useSession()
  return session.status === 'authenticated' ? session.user.id : null
}

export function useFavorites() {
  const userId = useUserId()
  return useQuery({
    queryKey: qk.favorites(userId ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: userId !== null,
    staleTime: 60_000,
  })
}

/** Optimistic toggle with rollback on failure. */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const key = qk.favorites(useUserId() ?? 'anonymous')

  return useMutation({
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Favorites>(key)
      const ids = new Set(previous?.nftIds ?? [])
      if (favorite) ids.add(nftId)
      else ids.delete(nftId)
      qc.setQueryData<Favorites>(key, { nftIds: [...ids] })
      return { previous }
    },
    onError: (error, { name }, context) => {
      qc.setQueryData(key, context?.previous)
      const message = `Não foi possível atualizar "${name}" nos favoritos. ${errorMessage(error)}`
      toast.error(message)
      announce(message, 'assertive')
    },
    onSuccess: (data, { favorite, name }) => {
      qc.setQueryData(key, data)
      announce(favorite ? `${name} adicionado aos favoritos.` : `${name} removido dos favoritos.`)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

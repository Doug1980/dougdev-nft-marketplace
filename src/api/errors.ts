import { isAxiosError } from 'axios'
import { apiErrorBody, type ErrorCode } from './contracts'

type ClientErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELED' | 'CONTRACT_ERROR'

/** Single normalized error for every transport failure. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | ClientErrorCode
  readonly fields: Record<string, string>
  readonly details: unknown

  constructor(init: { status: number; code: ApiError['code']; message: string; fields?: Record<string, string>; details?: unknown }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fields = init.fields ?? {}
    this.details = init.details
  }

  /** Safe to retry: network failure, timeout or 5xx. Never 4xx. */
  get isTransient() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.status >= 500
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') return new ApiError({ status: 0, code: 'CANCELED', message: 'Requisição cancelada.' })
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ status: 0, code: 'TIMEOUT', message: 'O servidor demorou para responder. Tentando novamente…' })
    }
    if (!error.response)
      return new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Sem conexão com o servidor. Verifique sua internet.' })
    const body = apiErrorBody.safeParse(error.response.data)
    if (body.success) return new ApiError({ status: error.response.status, ...body.data.error })
    return new ApiError({ status: error.response.status, code: 'INTERNAL_ERROR', message: 'Erro inesperado no servidor.' })
  }
  return new ApiError({ status: 0, code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Erro inesperado.' })
}

export const errorMessage = (error: unknown) => toApiError(error).message

import axios from 'axios'
import { env } from '@/lib/env'
import { sessionStore } from '@/lib/session-store'
import { toApiError } from './errors'

export const REQUEST_TIMEOUT_MS = 8000

/** The only Axios instance. Every REST call goes through it. */
export const http = axios.create({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  // An explicit Authorization header (session handoff on login) wins over the stored session.
  if (config.headers.has('Authorization')) return config
  const token = sessionStore.token()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  } else {
    const guestCartId = sessionStore.guestCartId()
    if (guestCartId) config.headers.set('X-Cart-Id', guestCartId)
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error)
    // Token was sent and rejected: the session expired server-side.
    if (apiError.code === 'SESSION_EXPIRED' && sessionStore.token()) sessionStore.clear('expired')
    return Promise.reject(apiError)
  },
)

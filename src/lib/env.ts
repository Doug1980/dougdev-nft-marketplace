/** Typed environment with safe defaults for the demo build. */
export const env = {
  enableMocks: (import.meta.env.VITE_ENABLE_MOCKS ?? 'true') !== 'false',
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '/api',
  socketUrl: (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? 'wss://realtime.kurio.mock',
} as const

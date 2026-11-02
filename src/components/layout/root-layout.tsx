import { Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'

export function RootLayout() {
  return (
    <>
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <Toaster theme="dark" position="top-center" />
    </>
  )
}

import { useEffect } from 'react'

/** Per-route document title (screen readers announce it on navigation; also helps SEO). */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = title
  }, [title])
}

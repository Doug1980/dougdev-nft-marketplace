import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * The boot chain is dynamic (main -> mocks -> auth -> App), so the browser only discovers each chunk after
 * the previous one runs. This plugin adds <link rel="modulepreload"> for those chunks (and their imports)
 * to the built index.html, so they download in parallel with the entry script.
 */
function preloadBootChunks(entries: string[]): Plugin {
  return {
    name: 'kurio:preload-boot-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return
        const chunks = Object.values(bundle).filter((output) => output.type === 'chunk')
        const files = new Set<string>()
        const visit = (fileName: string) => {
          if (files.has(fileName)) return
          files.add(fileName)
          const chunk = chunks.find((c) => c.fileName === fileName)
          for (const dep of chunk?.imports ?? []) visit(dep)
        }
        for (const chunk of chunks) {
          if (chunk.facadeModuleId && entries.some((entry) => chunk.facadeModuleId?.endsWith(entry))) visit(chunk.fileName)
        }
        // The entry chunk is already loaded by its own <script>.
        for (const chunk of chunks) if (chunk.isEntry) files.delete(chunk.fileName)
        return [...files].map((file) => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', crossorigin: '', href: `/${file}` },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const mocks = (env.VITE_ENABLE_MOCKS ?? 'true') !== 'false'
  const bootEntries = ['src/App.tsx', 'src/features/auth.ts', ...(mocks ? ['src/mocks/browser.ts'] : [])]

  return {
    plugins: [react(), tailwindcss(), preloadBootChunks(bootEntries)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // MSW's cookie jar is unused here (Bearer auth): drop tough-cookie from the mock bundle. See the stub.
        'tough-cookie': fileURLToPath(new URL('./src/mocks/tough-cookie-stub.ts', import.meta.url)),
      },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
    build: { target: 'es2022' },
  }
})

import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/**
 * Same suite against the public deployment (no local server).
 * Visual baselines are a local check and are skipped here.
 * Override the target with E2E_BASE_URL.
 */
export default defineConfig({
  ...base,
  webServer: undefined,
  grepInvert: /Visual regression/,
  use: { ...base.use, baseURL: process.env.E2E_BASE_URL ?? 'https://kurio-nft2026.vercel.app' },
})

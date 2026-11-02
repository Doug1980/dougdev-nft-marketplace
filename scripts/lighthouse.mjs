/**
 * Lighthouse audit (challenge section 10).
 *
 * - Builds the app and serves the optimized build with `vite preview` (mocks on, default scenario).
 * - Audits Home and NFT detail, mobile and desktop profiles, 3 runs each, fresh Chrome profile per run.
 * - Writes every HTML/JSON report plus a median summary (scores, LCP, CLS, TBT), tool versions and environment.
 *
 * Usage: npm run lighthouse            (build + audit)
 *        npm run lighthouse -- --skip-build
 * Chrome: Playwright's Chromium by default; set CHROME_PATH to use another browser.
 */
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

const PORT = 4174
const BASE_URL = `http://localhost:${PORT}`
const RUNS = 3
const OUT_DIR = path.resolve('.lighthouse')

const PAGES = [
  { id: 'home', path: '/' },
  { id: 'nft-detail', path: '/nft/emerald-ape-042' },
]
const PROFILES = [
  { id: 'mobile', config: undefined }, // Lighthouse default: Moto G Power emulation, slow 4G, 4x CPU throttling
  { id: 'desktop', config: desktopConfig },
]
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
const METRICS = {
  LCP: 'largest-contentful-paint',
  CLS: 'cumulative-layout-shift',
  TBT: 'total-blocking-time',
  FCP: 'first-contentful-paint',
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))))
  })
}

async function startPreview() {
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE_URL)).ok) return child
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  child.kill()
  throw new Error(`vite preview did not start on ${BASE_URL}`)
}

async function audit(url, profile) {
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH ?? chromium.executablePath(),
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  })
  try {
    const result = await lighthouse(url, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' }, profile.config)
    if (!result) throw new Error(`No Lighthouse result for ${url}`)
    return result
  } finally {
    await chrome.kill()
  }
}

async function main() {
  if (!process.argv.includes('--skip-build')) await run('npm', ['run', 'build'])
  await rm(path.join(OUT_DIR, 'reports'), { recursive: true, force: true })
  await mkdir(path.join(OUT_DIR, 'reports'), { recursive: true })

  const preview = await startPreview()
  const rows = []
  try {
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        const runs = []
        for (let i = 1; i <= RUNS; i++) {
          process.stdout.write(`Auditing ${page.id} (${profile.id}) run ${i}/${RUNS}… `)
          const { lhr, report } = await audit(`${BASE_URL}${page.path}`, profile)
          const base = path.join(OUT_DIR, 'reports', `${page.id}-${profile.id}-run${i}`)
          await writeFile(`${base}.html`, report[0])
          await writeFile(`${base}.json`, report[1])
          const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]))
          const metrics = Object.fromEntries(Object.entries(METRICS).map(([k, id]) => [k, lhr.audits[id]?.numericValue ?? 0]))
          runs.push({ scores, metrics, lighthouseVersion: lhr.lighthouseVersion, userAgent: lhr.environment.hostUserAgent })
          console.log(CATEGORIES.map((c) => `${c} ${scores[c]}`).join(' · '))
        }
        rows.push({
          page: page.id,
          path: page.path,
          profile: profile.id,
          median: {
            scores: Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
            metrics: Object.fromEntries(Object.keys(METRICS).map((k) => [k, median(runs.map((r) => r.metrics[k]))])),
          },
          runs,
        })
      }
    }
  } finally {
    preview.kill()
  }

  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  const environment = {
    date: new Date().toISOString(),
    lighthouse: rows[0]?.runs[0]?.lighthouseVersion,
    browser: rows[0]?.runs[0]?.userAgent,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model,
    vite: pkg.devDependencies.vite,
    conditions: `vite preview (optimized build), mocks on, default scenario, ${RUNS} runs per page/profile, fresh Chrome profile per run, Lighthouse default throttling`,
  }
  await writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify({ environment, targets: TARGETS, results: rows }, null, 2))

  const ms = (v) => `${Math.round(v)} ms`
  const lines = [
    '# Lighthouse summary (median of 3 runs)',
    '',
    ...Object.entries(environment).map(([k, v]) => `- **${k}**: ${v}`),
    '',
    '| Page | Profile | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map(({ page, profile, median: m }) => {
      const score = (c) => `${m.scores[c]}${m.scores[c] < TARGETS[c] ? ' ⚠️' : ''}`
      return `| ${page} | ${profile} | ${CATEGORIES.map(score).join(' | ')} | ${ms(m.metrics.LCP)} | ${m.metrics.CLS.toFixed(3)} | ${ms(m.metrics.TBT)} |`
    }),
    '',
    `Targets: ${CATEGORIES.map((c) => `${c} ≥ ${TARGETS[c]}`).join(', ')}. ⚠️ marks a median below target.`,
    '',
  ]
  await writeFile(path.join(OUT_DIR, 'summary.md'), lines.join('\n'))
  console.log(`\n${lines.join('\n')}\nReports: ${path.join(OUT_DIR, 'reports')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

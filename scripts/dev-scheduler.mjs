/**
 * dev-scheduler.mjs
 *
 * Local development scheduler — mimics Vercel Cron.
 * Calls /api/cron every 60 seconds (configurable via SCHEDULER_INTERVAL_MS).
 *
 * Usage:  node scripts/dev-scheduler.mjs
 * Or via npm script: npm run scheduler
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET ?? ''
const INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS ?? 60_000)

const RESET = '\x1b[0m'
const CYAN  = '\x1b[36m'
const GREEN = '\x1b[32m'
const RED   = '\x1b[31m'
const DIM   = '\x1b[2m'
const BOLD  = '\x1b[1m'

function timestamp() {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false })
}

function log(color, ...args) {
  console.log(`${DIM}[${timestamp()}]${RESET} ${color}${args.join(' ')}${RESET}`)
}

async function tick() {
  log(CYAN, `⚡ Running cron tick → ${BASE_URL}/api/cron`)

  const headers = { 'Content-Type': 'application/json' }
  if (CRON_SECRET) headers['x-cron-secret'] = CRON_SECRET

  try {
    const res = await fetch(`${BASE_URL}/api/cron`, { headers })
    const body = await res.json()

    if (!res.ok) {
      log(RED, `✗ Cron failed ${res.status}: ${JSON.stringify(body)}`)
      return
    }

    if (body.ran === 0) {
      log(DIM, `  Nothing to trigger (all monitors are on cooldown or paused)`)
      return
    }

    log(GREEN, `✓ Triggered ${body.ran} monitor(s)`)

    for (const r of (body.results ?? [])) {
      if (r.error) {
        log(RED, `  ✗ ${r.name ?? r.id}: error — ${r.error}`)
      } else {
        const icon = r.success ? '✓' : '✗'
        const color = r.success ? GREEN : RED
        log(color, `  ${icon} ${r.name} — HTTP ${r.status_code ?? '?'} — ${r.response_time_ms}ms`)
      }
    }
  } catch (err) {
    log(RED, `✗ Could not reach ${BASE_URL}/api/cron — is Next.js running?`)
    log(RED, `  ${err.message}`)
  }
}

// ─── Boot ────────────────────────────────────────────────────────

console.log()
console.log(`${BOLD}${CYAN}  TriggerBot Dev Scheduler${RESET}`)
console.log(`${DIM}  Polling every ${INTERVAL_MS / 1000}s → ${BASE_URL}/api/cron${RESET}`)
console.log()

// First tick immediately
tick()

// Then on interval
setInterval(tick, INTERVAL_MS)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${DIM}Scheduler stopped.${RESET}`)
  process.exit(0)
})

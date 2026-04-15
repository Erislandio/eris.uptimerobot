import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Monitor } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Creates a Supabase client with service role key (bypasses RLS).
 *  Falls back to anon key when service role key is not set. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) throw new Error('Missing Supabase environment variables')

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function executeRequest(monitor: Monitor) {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), monitor.timeout_seconds * 1000)

    const options: RequestInit = {
      method: monitor.method,
      headers: { 'Content-Type': 'application/json', ...monitor.headers },
      signal: controller.signal,
    }

    // HEAD and GET have no body
    if (monitor.body && monitor.method !== 'GET' && monitor.method !== 'HEAD') {
      options.body = monitor.body
    }

    const res = await fetch(monitor.url, options)
    clearTimeout(timeoutId)

    return {
      success: res.ok,
      status_code: res.status,
      response_time_ms: Date.now() - start,
      error_message: res.ok ? null : `HTTP ${res.status} ${res.statusText}`,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      status_code: null,
      response_time_ms: Date.now() - start,
      error_message: msg.toLowerCase().includes('abort') ? 'Request timed out' : msg,
    }
  }
}

async function runMonitor(supabase: ReturnType<typeof getAdminClient>, monitor: Monitor) {
  let result = await executeRequest(monitor)

  // Exponential back-off retry
  if (!result.success && monitor.retry_count > 0) {
    for (let i = 1; i <= monitor.retry_count; i++) {
      await sleep(Math.min(1000 * Math.pow(2, i - 1), 8000))
      const retry = await executeRequest(monitor)
      if (retry.success) { result = retry; break }
      if (i === monitor.retry_count) result = retry
    }
  }

  const triggerTime = new Date()
  const nextTrigger = new Date(triggerTime.getTime() + monitor.interval_seconds * 1000)

  // Persist log
  const { error: logError } = await supabase.from('monitor_logs').insert({
    monitor_id: monitor.id,
    success: result.success,
    status_code: result.status_code,
    response_time_ms: result.response_time_ms,
    error_message: result.error_message,
    triggered_at: triggerTime.toISOString(),
  })

  if (logError) console.error(`[cron] log insert error (${monitor.id}):`, logError.message)

  // Update monitor timestamps & status
  const { error: updateError } = await supabase.from('monitors').update({
    last_triggered_at: triggerTime.toISOString(),
    next_trigger_at: nextTrigger.toISOString(),
    status: result.success ? 'active' : 'error',
    updated_at: triggerTime.toISOString(),
  }).eq('id', monitor.id)

  if (updateError) console.error(`[cron] monitor update error (${monitor.id}):`, updateError.message)

  return { id: monitor.id, name: monitor.name, ...result }
}

// ─── GET /api/cron ─────────────────────────────────────────────────────────────
// Called every minute by Vercel Cron (vercel.json) or by the dev-scheduler script.

export async function GET(req: NextRequest) {
  // Optional secret-based auth (set CRON_SECRET in env)
  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret) {
    const provided = req.headers.get('x-cron-secret')
      ?? req.nextUrl.searchParams.get('secret')
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  let supabase: ReturnType<typeof getAdminClient>
  try {
    supabase = getAdminClient()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const now = new Date()
  console.log(`[cron] tick at ${now.toISOString()}`)

  // Fetch all active monitors that are due
  const { data: dueMonitors, error: fetchError } = await supabase
    .from('monitors')
    .select('*')
    .eq('status', 'active')
    .or(`next_trigger_at.is.null,next_trigger_at.lte.${now.toISOString()}`)

  if (fetchError) {
    console.error('[cron] fetch error:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!dueMonitors || dueMonitors.length === 0) {
    console.log('[cron] nothing to trigger')
    return NextResponse.json({ ran: 0, message: 'Nothing to trigger' })
  }

  console.log(`[cron] ${dueMonitors.length} monitor(s) due — running concurrently`)

  // Run all due monitors in parallel
  const settled = await Promise.allSettled(
    (dueMonitors as Monitor[]).map(m => runMonitor(supabase, m))
  )

  const results = settled.map(r =>
    r.status === 'fulfilled'
      ? r.value
      : { error: String((r as PromiseRejectedResult).reason) }
  )

  console.log(`[cron] done — ${results.filter(r => !('error' in r)).length} succeeded`)
  return NextResponse.json({ ran: dueMonitors.length, results })
}

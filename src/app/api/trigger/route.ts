import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Monitor } from '@/lib/types'

// Helper: sleep
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function executeRequest(monitor: Monitor): Promise<{
  success: boolean
  status_code: number | null
  response_time_ms: number | null
  error_message: string | null
}> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), monitor.timeout_seconds * 1000)

    const options: RequestInit = {
      method: monitor.method,
      headers: { 'Content-Type': 'application/json', ...monitor.headers },
      signal: controller.signal,
    }

    if (monitor.body && monitor.method !== 'GET') {
      options.body = monitor.body
    }

    const res = await fetch(monitor.url, options)
    clearTimeout(timeoutId)

    const ms = Date.now() - start
    return {
      success: res.ok,
      status_code: res.status,
      response_time_ms: ms,
      error_message: res.ok ? null : `HTTP ${res.status} ${res.statusText}`,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      status_code: null,
      response_time_ms: Date.now() - start,
      error_message: msg.includes('abort') ? 'Request timed out' : msg,
    }
  }
}

async function runMonitor(monitor: Monitor) {
  const supabase = await createClient()

  let result = await executeRequest(monitor)

  // Retry logic with exponential back-off
  if (!result.success && monitor.retry_count > 0) {
    for (let attempt = 1; attempt <= monitor.retry_count; attempt++) {
      await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10000))
      const retry = await executeRequest(monitor)
      if (retry.success) { result = retry; break }
      if (attempt === monitor.retry_count) result = retry
    }
  }

  const now = new Date()
  const nextTrigger = new Date(now.getTime() + monitor.interval_seconds * 1000)

  // Log result
  await supabase.from('monitor_logs').insert({
    monitor_id: monitor.id,
    success: result.success,
    status_code: result.status_code,
    response_time_ms: result.response_time_ms,
    error_message: result.error_message,
    triggered_at: now.toISOString(),
  })

  // Update monitor
  await supabase.from('monitors').update({
    last_triggered_at: now.toISOString(),
    next_trigger_at: nextTrigger.toISOString(),
    status: result.success ? 'active' : 'error',
    updated_at: now.toISOString(),
  }).eq('id', monitor.id)

  return result
}

// POST /api/trigger — Manual trigger for a single monitor
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { monitorId } = body

  if (!monitorId) {
    return NextResponse.json({ error: 'monitorId required' }, { status: 400 })
  }

  const { data: monitor, error } = await supabase
    .from('monitors')
    .select('*')
    .eq('id', monitorId)
    .eq('user_id', user.id)  // Security: only owner can trigger
    .single()

  if (error || !monitor) {
    return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
  }

  const result = await runMonitor(monitor as Monitor)
  return NextResponse.json({ ok: true, result })
}

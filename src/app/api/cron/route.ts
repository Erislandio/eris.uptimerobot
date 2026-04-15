import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Monitor } from '@/lib/types'
import { cookies } from 'next/headers'

// This cron endpoint should be called every minute by Vercel Cron
// vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "* * * * *" }] }
// Secure it with a secret header: CRON_SECRET env var

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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

    if (monitor.body && monitor.method !== 'GET') {
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
      error_message: msg.includes('abort') ? 'Request timed out' : msg,
    }
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Create Supabase admin-style client (service-role for cron)
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const now = new Date()

  // Find all active monitors that are due to run
  const { data: dueMonitors, error } = await supabase
    .from('monitors')
    .select('*')
    .eq('status', 'active')
    .or(`next_trigger_at.is.null,next_trigger_at.lte.${now.toISOString()}`)

  if (error) {
    console.error('Cron fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!dueMonitors || dueMonitors.length === 0) {
    return NextResponse.json({ ran: 0, message: 'Nothing to trigger' })
  }

  // Run all due monitors concurrently
  const results = await Promise.allSettled(
    (dueMonitors as Monitor[]).map(async (monitor) => {
      let result = await executeRequest(monitor)

      // Retry
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

      await supabase.from('monitor_logs').insert({
        monitor_id: monitor.id,
        success: result.success,
        status_code: result.status_code,
        response_time_ms: result.response_time_ms,
        error_message: result.error_message,
        triggered_at: triggerTime.toISOString(),
      })

      await supabase.from('monitors').update({
        last_triggered_at: triggerTime.toISOString(),
        next_trigger_at: nextTrigger.toISOString(),
        status: result.success ? 'active' : 'error',
        updated_at: triggerTime.toISOString(),
      }).eq('id', monitor.id)

      return { id: monitor.id, name: monitor.name, ...result }
    })
  )

  const summary = results.map(r => r.status === 'fulfilled' ? r.value : { error: (r as PromiseRejectedResult).reason })
  return NextResponse.json({ ran: dueMonitors.length, results: summary })
}

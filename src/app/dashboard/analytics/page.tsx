import { createClient } from '@/lib/supabase/server'
import { Monitor, MonitorLog } from '@/lib/types'
import { TrendingUp, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'

interface MonitorStats {
  monitor: Monitor
  logs: MonitorLog[]
  successRate: number
  avgResponseTime: number
  totalRuns: number
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: monitors } = await supabase
    .from('monitors')
    .select('*, monitor_logs(*)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const stats: MonitorStats[] = (monitors ?? []).map((m: Monitor & { monitor_logs: MonitorLog[] }) => {
    const logs = m.monitor_logs ?? []
    const successful = logs.filter(l => l.success)
    const times = logs.filter(l => l.response_time_ms != null).map(l => l.response_time_ms as number)
    return {
      monitor: m,
      logs,
      successRate: logs.length ? Math.round((successful.length / logs.length) * 100) : 0,
      avgResponseTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      totalRuns: logs.length,
    }
  })

  return (
    <>
      <header className="topbar">
        <h2 className="topbar-title">Analytics</h2>
      </header>

      <div className="page-content">
        {stats.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><TrendingUp size={28} color="var(--text-muted)" /></div>
              <p className="empty-title">No data yet</p>
              <p className="empty-description">Analytics will appear once your monitors have run.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {stats.map(s => (
              <div key={s.monitor.id} className="card">
                <div className="card-header">
                  <div className="flex items-center gap-3">
                    <div className={`monitor-status-dot ${s.monitor.status}`} />
                    <div>
                      <h3 style={{ fontSize: '1rem' }}>{s.monitor.name}</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, fontFamily: 'monospace' }}>
                        {s.monitor.method} {s.monitor.url}
                      </p>
                    </div>
                  </div>
                  <span className={`badge badge-${s.monitor.status}`}>{s.monitor.status}</span>
                </div>
                <div className="card-body">
                  <div className="stats-grid" style={{ marginBottom: s.logs.length > 0 ? '1.25rem' : 0 }}>
                    <div className="stat-card" style={{ padding: '1rem' }}>
                      <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.12)', width: 32, height: 32, marginBottom: '0.5rem' }}>
                        <CheckCircle size={16} color="var(--accent-success)" />
                      </div>
                      <div className="stat-value" style={{ fontSize: '1.5rem' }}>{s.successRate}%</div>
                      <div className="stat-label">Success Rate</div>
                    </div>
                    <div className="stat-card" style={{ padding: '1rem' }}>
                      <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)', width: 32, height: 32, marginBottom: '0.5rem' }}>
                        <Zap size={16} color="var(--accent-primary-light)" />
                      </div>
                      <div className="stat-value" style={{ fontSize: '1.5rem' }}>{s.totalRuns}</div>
                      <div className="stat-label">Total Runs</div>
                    </div>
                    <div className="stat-card" style={{ padding: '1rem' }}>
                      <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)', width: 32, height: 32, marginBottom: '0.5rem' }}>
                        <Clock size={16} color="var(--accent-warning)" />
                      </div>
                      <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                        {s.avgResponseTime > 0 ? `${s.avgResponseTime}ms` : '—'}
                      </div>
                      <div className="stat-label">Avg Response</div>
                    </div>
                    <div className="stat-card" style={{ padding: '1rem' }}>
                      <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)', width: 32, height: 32, marginBottom: '0.5rem' }}>
                        <XCircle size={16} color="var(--accent-danger)" />
                      </div>
                      <div className="stat-value" style={{ fontSize: '1.5rem' }}>{s.logs.filter(l => !l.success).length}</div>
                      <div className="stat-label">Failures</div>
                    </div>
                  </div>

                  {/* Mini log bar chart - success/fail visual indicator */}
                  {s.logs.length > 0 && (
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Last {Math.min(s.logs.length, 60)} runs
                      </p>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 40 }}>
                        {s.logs.slice(0, 60).reverse().map((log, i) => (
                          <div
                            key={i}
                            title={`${log.success ? 'OK' : 'Failed'} · ${log.response_time_ms ?? '?'}ms`}
                            style={{
                              flex: 1,
                              minWidth: 4,
                              borderRadius: 2,
                              height: log.response_time_ms
                                ? `${Math.min(100, Math.max(20, (log.response_time_ms / 2000) * 100))}%`
                                : '30%',
                              background: log.success ? 'var(--accent-success)' : 'var(--accent-danger)',
                              opacity: 0.8,
                              transition: 'opacity 0.15s',
                              cursor: 'default',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

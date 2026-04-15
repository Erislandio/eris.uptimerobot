import { createClient } from '@/lib/supabase/server'
import { Monitor, MonitorLog } from '@/lib/types'
import { Activity, Radio, CheckCircle, XCircle, Clock, TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

function getStatusRate(logs: MonitorLog[]) {
  if (!logs.length) return 0
  const success = logs.filter(l => l.success).length
  return Math.round((success / logs.length) * 100)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: monitors } = await supabase
    .from('monitors')
    .select('*, monitor_logs(id, success, triggered_at, response_time_ms, status_code)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const allMonitors: (Monitor & { monitor_logs: MonitorLog[] })[] = monitors ?? []

  const activeCount = allMonitors.filter(m => m.status === 'active').length
  const errorCount = allMonitors.filter(m => m.status === 'error').length
  const totalTriggers = allMonitors.reduce((sum, m) => sum + m.monitor_logs.length, 0)
  const recentLogs = allMonitors
    .flatMap(m => m.monitor_logs.map(l => ({ ...l, monitor: m })))
    .sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime())
    .slice(0, 8)

  const successLogs = allMonitors.flatMap(m => m.monitor_logs).filter(l => l.success)
  const successRate = allMonitors.flatMap(m => m.monitor_logs).length > 0
    ? Math.round((successLogs.length / allMonitors.flatMap(m => m.monitor_logs).length) * 100)
    : 0

  return (
    <>
      <header className="topbar">
        <h2 className="topbar-title">Overview</h2>
        <div className="topbar-actions">
          <Link href="/dashboard/monitors" className="btn btn-primary btn-sm">
            <Zap size={14} /> New Trigger
          </Link>
        </div>
      </header>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
              <Radio size={20} color="var(--accent-primary-light)" />
            </div>
            <div className="stat-value">{allMonitors.length}</div>
            <div className="stat-label">Total Monitors</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
              <Activity size={20} color="var(--accent-success)" />
            </div>
            <div className="stat-value" style={{ color: 'var(--accent-success)' }}>{activeCount}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.12)' }}>
              <XCircle size={20} color="var(--accent-danger)" />
            </div>
            <div className="stat-value" style={{ color: errorCount > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
              {errorCount}
            </div>
            <div className="stat-label">Errors</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
              <TrendingUp size={20} color="var(--accent-warning)" />
            </div>
            <div className="stat-value">{successRate}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(168,85,247,0.12)' }}>
              <Zap size={20} color="var(--accent-purple)" />
            </div>
            <div className="stat-value">{totalTriggers.toLocaleString()}</div>
            <div className="stat-label">Total Triggers</div>
          </div>
        </div>

        <div className="grid-2" style={{ gap: '1.5rem' }}>
          {/* Active monitors quick view */}
          <div className="card">
            <div className="card-header">
              <h3>Active Monitors</h3>
              <Link href="/dashboard/monitors" className="btn btn-secondary btn-sm">View all</Link>
            </div>
            <div className="card-body">
              {allMonitors.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <div className="empty-icon"><Radio size={24} color="var(--text-muted)" /></div>
                  <p className="empty-title">No monitors yet</p>
                  <p className="empty-description">Create your first trigger to get started</p>
                  <Link href="/dashboard/monitors" className="btn btn-primary btn-sm">
                    <Zap size={14} /> Create Monitor
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {allMonitors.slice(0, 5).map(m => {
                    const rate = getStatusRate(m.monitor_logs)
                    return (
                      <div key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.875rem',
                        padding: '0.75rem', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)'
                      }}>
                        <div className={`monitor-status-dot ${m.status}`} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {m.method} · {new URL(m.url).hostname}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: rate >= 90 ? 'var(--accent-success)' : rate >= 70 ? 'var(--accent-warning)' : 'var(--accent-danger)' }}>
                          {rate}%
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent logs */}
          <div className="card">
            <div className="card-header">
              <h3>Recent Activity</h3>
              <Link href="/dashboard/logs" className="btn btn-secondary btn-sm">View all</Link>
            </div>
            <div className="card-body">
              {recentLogs.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <div className="empty-icon"><Clock size={24} color="var(--text-muted)" /></div>
                  <p className="empty-title">No logs yet</p>
                  <p className="empty-description">Logs will appear here once triggers run</p>
                </div>
              ) : (
                <div className="log-list">
                  {recentLogs.map(log => (
                    <div key={log.id} className="log-item">
                      {log.success
                        ? <CheckCircle size={15} color="var(--accent-success)" className="log-status-icon" />
                        : <XCircle size={15} color="var(--accent-danger)" className="log-status-icon" />
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                          {log.monitor.name}
                        </div>
                        <div className="log-time">
                          {formatDistanceToNow(new Date(log.triggered_at), { addSuffix: true })}
                        </div>
                      </div>
                      {log.status_code && (
                        <span className="log-code" style={{
                          color: log.success ? 'var(--accent-success)' : 'var(--accent-danger)',
                          fontSize: '0.8rem'
                        }}>
                          {log.status_code}
                        </span>
                      )}
                      {log.response_time_ms != null && (
                        <span className="log-duration">{log.response_time_ms}ms</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

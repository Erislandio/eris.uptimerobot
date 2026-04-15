import { createClient } from '@/lib/supabase/server'
import { MonitorLog, Monitor } from '@/lib/types'
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

export default async function LogsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user monitors
  const { data: monitors } = await supabase
    .from('monitors')
    .select('id, name, url, method')
    .eq('user_id', user!.id)

  const monitorIds = (monitors ?? []).map((m: Pick<Monitor, 'id'>) => m.id)
  const monitorsById = Object.fromEntries(
    (monitors ?? []).map((m: Pick<Monitor, 'id' | 'name' | 'url' | 'method'>) => [m.id, m])
  )

  const { data: logs } = monitorIds.length > 0
    ? await supabase
        .from('monitor_logs')
        .select('*')
        .in('monitor_id', monitorIds)
        .order('triggered_at', { ascending: false })
        .limit(200)
    : { data: [] }

  const allLogs: MonitorLog[] = logs ?? []

  return (
    <>
      <header className="topbar">
        <h2 className="topbar-title">Trigger Logs</h2>
        <div className="topbar-actions">
          <span className="text-sm text-muted">{allLogs.length} entries</span>
        </div>
      </header>

      <div className="page-content">
        {allLogs.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><Clock size={28} color="var(--text-muted)" /></div>
              <p className="empty-title">No logs yet</p>
              <p className="empty-description">
                Trigger logs will appear here once your monitors start running.
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <h3>Execution History</h3>
              <span className="badge badge-active">{allLogs.filter(l => l.success).length} success</span>
            </div>
            <div style={{ padding: '1rem' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 120px 80px 80px 100px',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '0.5rem'
              }}>
                <span></span>
                <span>Monitor</span>
                <span>Triggered</span>
                <span>Status</span>
                <span>Time</span>
                <span>Response</span>
              </div>
              <div className="log-list">
                {allLogs.map(log => {
                  const monitor = monitorsById[log.monitor_id]
                  return (
                    <div key={log.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '36px 1fr 120px 80px 80px 100px',
                      gap: '0.75rem',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem',
                      transition: 'all 0.15s ease',
                    }}
                    className="log-item"
                    >
                      <div>
                        {log.success
                          ? <CheckCircle size={16} color="var(--accent-success)" />
                          : <XCircle size={16} color="var(--accent-danger)" />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {monitor?.name ?? 'Deleted monitor'}
                        </div>
                        {log.error_message && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle size={11} />
                            {log.error_message}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {format(new Date(log.triggered_at), 'MMM d, HH:mm:ss')}
                      </div>
                      <div>
                        {log.status_code ? (
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            color: log.success ? 'var(--accent-success)' : 'var(--accent-danger)'
                          }}>
                            {log.status_code}
                          </span>
                        ) : '—'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {log.response_time_ms != null ? `${log.response_time_ms}ms` : '—'}
                      </div>
                      <div>
                        <span className={`badge badge-${log.success ? 'active' : 'error'}`}>
                          {log.success ? 'OK' : 'Failed'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

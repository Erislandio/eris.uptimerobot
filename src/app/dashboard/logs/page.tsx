'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MonitorLog, Monitor } from '@/lib/types'
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

const POLL_INTERVAL = 10_000 // 10 segundos — logs precisam ser mais frescos

export default function LogsPage() {
  const [logs, setLogs] = useState<MonitorLog[]>([])
  const [monitorsById, setMonitorsById] = useState<Record<string, Pick<Monitor, 'id' | 'name' | 'url' | 'method'>>>({})
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const supabase = createClient()

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: monitors } = await supabase
      .from('monitors')
      .select('id, name, url, method')
      .eq('user_id', user.id)

    const byId = Object.fromEntries(
      (monitors ?? []).map((m: Pick<Monitor, 'id' | 'name' | 'url' | 'method'>) => [m.id, m])
    )
    setMonitorsById(byId)

    const monitorIds = (monitors ?? []).map((m: Pick<Monitor, 'id'>) => m.id)

    if (monitorIds.length > 0) {
      const { data } = await supabase
        .from('monitor_logs')
        .select('*')
        .in('monitor_id', monitorIds)
        .order('triggered_at', { ascending: false })
        .limit(200)
      setLogs(data ?? [])
    } else {
      setLogs([])
    }

    setLastRefreshed(new Date())
    if (!silent) setLoading(false)
  }, [supabase])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Auto-poll
  useEffect(() => {
    const id = setInterval(() => fetchLogs(true), POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchLogs])

  const successCount = logs.filter(l => l.success).length
  const failCount = logs.filter(l => !l.success).length

  return (
    <>
      <header className="topbar">
        <h2 className="topbar-title">Trigger Logs</h2>
        <div className="topbar-actions">
          <span style={{
            fontSize: '0.75rem', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--accent-success)',
              display: 'inline-block',
              boxShadow: '0 0 5px var(--accent-success)',
              animation: 'pulse-ring 2s infinite'
            }} />
            {lastRefreshed
              ? `Atualizado ${formatDistanceToNow(lastRefreshed, { addSuffix: true })}`
              : 'Atualizando…'}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchLogs()}
            id="refresh-logs-btn"
            title="Refresh now"
          >
            <RefreshCw size={13} />
          </button>
          <span className="badge badge-active">{successCount} ok</span>
          <span className="badge badge-error">{failCount} falhas</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {logs.length} entradas
          </span>
        </div>
      </header>

      <div className="page-content">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><Clock size={28} color="var(--text-muted)" /></div>
              <p className="empty-title">Nenhum log ainda</p>
              <p className="empty-description">
                Os logs aparecerão aqui automaticamente assim que os monitors dispararem.
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <h3>Histórico de Execuções</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="badge badge-active">{successCount} ok</span>
                <span className="badge badge-error">{failCount} erro{failCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div style={{ padding: '1rem' }}>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 140px 80px 80px 100px',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '0.5rem',
              }}>
                <span></span>
                <span>Monitor</span>
                <span>Disparado</span>
                <span>Status</span>
                <span>Tempo</span>
                <span>Resultado</span>
              </div>

              <div className="log-list">
                {logs.map(log => {
                  const monitor = monitorsById[log.monitor_id]
                  return (
                    <div
                      key={log.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr 140px 80px 80px 100px',
                        gap: '0.75rem',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.8125rem',
                        transition: 'border-color 0.15s',
                      }}
                      className="log-item"
                    >
                      {/* Icon */}
                      <div>
                        {log.success
                          ? <CheckCircle size={16} color="var(--accent-success)" />
                          : <XCircle size={16} color="var(--accent-danger)" />}
                      </div>

                      {/* Monitor name + error */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {monitor?.name ?? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>monitor removido</span>}
                        </div>
                        {log.error_message && (
                          <div style={{
                            fontSize: '0.73rem', color: 'var(--accent-danger)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <AlertCircle size={11} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.error_message}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {format(new Date(log.triggered_at), 'dd/MM HH:mm:ss')}
                      </div>

                      {/* HTTP status code */}
                      <div>
                        {log.status_code ? (
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            color: log.success ? 'var(--accent-success)' : 'var(--accent-danger)',
                          }}>
                            {log.status_code}
                          </span>
                        ) : '—'}
                      </div>

                      {/* Response time */}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {log.response_time_ms != null ? `${log.response_time_ms}ms` : '—'}
                      </div>

                      {/* Badge */}
                      <div>
                        <span className={`badge badge-${log.success ? 'active' : 'error'}`}>
                          {log.success ? 'OK' : 'Falhou'}
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

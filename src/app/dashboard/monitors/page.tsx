'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Monitor } from '@/lib/types'
import MonitorModal from '@/components/MonitorModal'
import {
  Plus, Radio, Pause, Play, Trash2, Edit2, ExternalLink,
  Zap, Clock, RefreshCw, CheckCircle, XCircle
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

const POLL_INTERVAL = 15_000 // 15 segundos

function formatInterval(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${seconds / 60}m`
  return `${seconds / 3600}h`
}

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editMonitor, setEditMonitor] = useState<Monitor | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const supabase = createClient()

  const fetchMonitors = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('monitors')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setMonitors(data ?? [])
    setLastRefreshed(new Date())
    if (!silent) setLoading(false)
  }, [supabase])

  // Initial load
  useEffect(() => {
    fetchMonitors()
  }, [fetchMonitors])

  // Auto-poll every 15 seconds
  useEffect(() => {
    const id = setInterval(() => fetchMonitors(true), POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchMonitors])

  async function handleDelete(id: string) {
    if (!confirm('Delete this monitor? This will also remove all logs.')) return
    setDeletingId(id)
    await supabase.from('monitors').delete().eq('id', id)
    setMonitors(prev => prev.filter(m => m.id !== id))
    setDeletingId(null)
  }

  async function handleToggle(monitor: Monitor) {
    setTogglingId(monitor.id)
    const newStatus = monitor.status === 'paused' ? 'active' : 'paused'
    const { error } = await supabase
      .from('monitors')
      .update({
        status: newStatus,
        // When resuming, schedule next trigger immediately
        next_trigger_at: newStatus === 'active'
          ? new Date(Date.now() + monitor.interval_seconds * 1000).toISOString()
          : null,
      })
      .eq('id', monitor.id)
    if (!error) {
      setMonitors(prev => prev.map(m => m.id === monitor.id ? { ...m, status: newStatus } : m))
    }
    setTogglingId(null)
  }

  async function handleTriggerNow(monitor: Monitor) {
    setTriggeringId(monitor.id)
    try {
      const res = await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitorId: monitor.id }),
      })
      const data = await res.json()
      if (!res.ok) console.error('Trigger error:', data)
    } catch (e) {
      console.error('Trigger failed:', e)
    }
    await fetchMonitors(true)
    setTriggeringId(null)
  }

  return (
    <>
      <header className="topbar">
        <h2 className="topbar-title">Monitors</h2>
        <div className="topbar-actions">
          {lastRefreshed && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Updated {format(lastRefreshed, 'HH:mm:ss')}
            </span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchMonitors()}
            title="Refresh now"
            id="refresh-monitors-btn"
          >
            <RefreshCw size={13} />
          </button>
          <button
            className="btn btn-primary"
            onClick={() => { setEditMonitor(null); setShowModal(true) }}
            id="new-monitor-btn"
          >
            <Plus size={16} /> New Monitor
          </button>
        </div>
      </header>

      <div className="page-content">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : monitors.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><Radio size={28} color="var(--text-muted)" /></div>
              <p className="empty-title">No monitors yet</p>
              <p className="empty-description">
                Create your first API trigger monitor. It will ping your endpoint at the
                scheduled interval, keeping APIs warm and out of cool-down.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => { setEditMonitor(null); setShowModal(true) }}
                id="create-first-monitor-btn"
              >
                <Zap size={16} /> Create First Monitor
              </button>
            </div>
          </div>
        ) : (
          <div className="monitors-list">
            {monitors.map(monitor => (
              <div key={monitor.id} className="monitor-item">
                <div className={`monitor-status-dot ${monitor.status}`} />

                <div className="monitor-info">
                  <div className="monitor-name">{monitor.name}</div>
                  <div className="monitor-url">
                    <span className={`method-badge ${monitor.method}`}>{monitor.method}</span>
                    {' '}
                    {monitor.url}
                  </div>
                </div>

                <div className="monitor-meta">
                  <div className="meta-item">
                    <span className="meta-label">Interval</span>
                    <span className="meta-value">
                      <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                      {formatInterval(monitor.interval_seconds)}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Retry</span>
                    <span className="meta-value">
                      <RefreshCw size={11} style={{ display: 'inline', marginRight: 3 }} />
                      {monitor.retry_count}x
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Status</span>
                    <span className={`badge badge-${monitor.status}`}>
                      {monitor.status === 'active' && <CheckCircle size={11} />}
                      {monitor.status === 'error' && <XCircle size={11} />}
                      {monitor.status}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Próximo em</span>
                    <span className="meta-value" style={{ fontSize: '0.75rem' }}>
                      {monitor.next_trigger_at
                        ? formatDistanceToNow(new Date(monitor.next_trigger_at), { addSuffix: true })
                        : '—'}
                    </span>
                  </div>
                  {monitor.last_triggered_at && (
                    <div className="meta-item">
                      <span className="meta-label">Último</span>
                      <span className="meta-value" style={{ fontSize: '0.75rem' }}>
                        {format(new Date(monitor.last_triggered_at), 'HH:mm:ss')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="monitor-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleTriggerNow(monitor)}
                    disabled={triggeringId === monitor.id}
                    id={`trigger-now-${monitor.id}`}
                    title="Trigger now"
                  >
                    {triggeringId === monitor.id
                      ? <span className="spinner" style={{ width: 13, height: 13 }} />
                      : <Zap size={13} />}
                    Run
                  </button>

                  <button
                    className={`btn btn-icon ${monitor.status === 'paused' ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => handleToggle(monitor)}
                    disabled={togglingId === monitor.id}
                    id={`toggle-${monitor.id}`}
                    title={monitor.status === 'paused' ? 'Resume' : 'Pause'}
                  >
                    {togglingId === monitor.id
                      ? <span className="spinner" style={{ width: 14, height: 14 }} />
                      : monitor.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
                  </button>

                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => { setEditMonitor(monitor); setShowModal(true) }}
                    id={`edit-${monitor.id}`}
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>

                  <a
                    href={monitor.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost btn-icon"
                    title="Open URL"
                  >
                    <ExternalLink size={14} />
                  </a>

                  <button
                    className="btn btn-danger btn-icon"
                    onClick={() => handleDelete(monitor.id)}
                    disabled={deletingId === monitor.id}
                    id={`delete-${monitor.id}`}
                    title="Delete monitor"
                  >
                    {deletingId === monitor.id
                      ? <span className="spinner" style={{ width: 14, height: 14 }} />
                      : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <MonitorModal
          monitor={editMonitor}
          onClose={() => { setShowModal(false); setEditMonitor(null) }}
          onSaved={() => {
            setShowModal(false)
            setEditMonitor(null)
            fetchMonitors()
          }}
        />
      )}
    </>
  )
}

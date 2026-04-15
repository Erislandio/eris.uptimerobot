'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Monitor, HttpMethod } from '@/lib/types'
import { X, Globe, Zap, Clock, RefreshCw, Shield, ChevronDown, Plus, Minus } from 'lucide-react'

interface MonitorModalProps {
  monitor?: Monitor | null
  onClose: () => void
  onSaved: () => void
}

const METHODS: HttpMethod[] = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']

const INTERVALS = [
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
  { label: '15 minutes', value: 900 },
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
  { label: '2 hours', value: 7200 },
  { label: '6 hours', value: 21600 },
  { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
]

export default function MonitorModal({ monitor, onClose, onSaved }: MonitorModalProps) {
  const isEdit = !!monitor

  const [name, setName] = useState(monitor?.name ?? '')
  const [url, setUrl] = useState(monitor?.url ?? '')
  const [method, setMethod] = useState<HttpMethod>(monitor?.method ?? 'GET')
  const [intervalSeconds, setIntervalSeconds] = useState(monitor?.interval_seconds ?? 300)
  const [retryCount, setRetryCount] = useState(monitor?.retry_count ?? 3)
  const [timeoutSeconds, setTimeoutSeconds] = useState(monitor?.timeout_seconds ?? 30)
  const [body, setBody] = useState(monitor?.body ?? '')
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(
    monitor?.headers
      ? Object.entries(monitor.headers).map(([key, value]) => ({ key, value }))
      : []
  )
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function addHeader() {
    setHeaders(prev => [...prev, { key: '', value: '' }])
  }

  function removeHeader(i: number) {
    setHeaders(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateHeader(i: number, field: 'key' | 'value', val: string) {
    setHeaders(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: val } : h))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated'); setLoading(false); return }

    const headersObj = headers.reduce((acc, { key, value }) => {
      if (key.trim()) acc[key.trim()] = value
      return acc
    }, {} as Record<string, string>)

    const payload = {
      name,
      url,
      method,
      interval_seconds: intervalSeconds,
      retry_count: retryCount,
      timeout_seconds: timeoutSeconds,
      body: body.trim() || null,
      headers: headersObj,
    }

    let err
    if (isEdit) {
      const { error } = await supabase.from('monitors').update(payload).eq('id', monitor!.id)
      err = error
    } else {
      const { error } = await supabase.from('monitors').insert({
        ...payload,
        user_id: user.id,
        status: 'active',
        next_trigger_at: new Date(Date.now() + intervalSeconds * 1000).toISOString(),
      })
      err = error
    }

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      onSaved()
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'var(--gradient-primary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Zap size={18} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>{isEdit ? 'Edit Monitor' : 'New Monitor'}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                {isEdit ? 'Update trigger configuration' : 'Schedule a new API trigger'}
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} id="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="monitor-name">
                Monitor Name
              </label>
              <input
                id="monitor-name"
                type="text"
                className="form-input"
                placeholder="e.g. Wake up Render API"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="monitor-url">
                <Globe size={13} /> Endpoint URL
              </label>
              <div className="flex gap-2 items-center" style={{ gap: '0.5rem' }}>
                <select
                  className="form-select"
                  style={{ width: 'auto', flexShrink: 0 }}
                  value={method}
                  onChange={e => setMethod(e.target.value as HttpMethod)}
                  id="monitor-method"
                >
                  {METHODS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <input
                  id="monitor-url"
                  type="url"
                  className="form-input"
                  placeholder="https://api.example.com/ping"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="monitor-interval">
                  <Clock size={13} /> Interval
                </label>
                <select
                  id="monitor-interval"
                  className="form-select"
                  value={intervalSeconds}
                  onChange={e => setIntervalSeconds(Number(e.target.value))}
                >
                  {INTERVALS.map(i => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="monitor-retry">
                  <RefreshCw size={13} /> Retry Count
                </label>
                <input
                  id="monitor-retry"
                  type="number"
                  className="form-input"
                  min={0} max={10}
                  value={retryCount}
                  onChange={e => setRetryCount(Number(e.target.value))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="monitor-timeout">
                  <Shield size={13} /> Timeout (s)
                </label>
                <input
                  id="monitor-timeout"
                  type="number"
                  className="form-input"
                  min={5} max={120}
                  value={timeoutSeconds}
                  onChange={e => setTimeoutSeconds(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Advanced */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              id="toggle-advanced"
              style={{ marginBottom: showAdvanced ? '1rem' : 0 }}
            >
              <ChevronDown
                size={14}
                style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              />
              Advanced Options
            </button>

            {showAdvanced && (
              <div style={{ marginTop: '1rem' }}>
                {/* Headers */}
                <div className="form-group">
                  <div className="flex items-center justify-between">
                    <label className="form-label" style={{ marginBottom: 0 }}>Request Headers</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addHeader} id="add-header-btn">
                      <Plus size={13} /> Add Header
                    </button>
                  </div>
                  {headers.map((h, i) => (
                    <div key={i} className="flex gap-2 items-center" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
                      <input
                        className="form-input form-mono"
                        placeholder="Header name"
                        value={h.key}
                        onChange={e => updateHeader(i, 'key', e.target.value)}
                      />
                      <input
                        className="form-input form-mono"
                        placeholder="Value"
                        value={h.value}
                        onChange={e => updateHeader(i, 'value', e.target.value)}
                      />
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeHeader(i)}>
                        <Minus size={14} />
                      </button>
                    </div>
                  ))}
                  {headers.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      No headers added
                    </p>
                  )}
                </div>

                {/* Body */}
                {method !== 'GET' && method !== 'HEAD' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="monitor-body">Request Body (JSON)</label>
                    <textarea
                      id="monitor-body"
                      className="form-textarea form-mono"
                      placeholder='{"key": "value"}'
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      style={{ minHeight: '100px' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} id="modal-cancel-btn">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              id="monitor-save-btn"
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Zap size={16} />}
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

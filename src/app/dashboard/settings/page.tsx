'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Settings, LogOut, Trash2, ShieldAlert, CheckCircle } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') {
      setMessage('Type DELETE to confirm')
      return
    }
    setDeleting(true)
    // In production, call a server action to delete the user account
    setMessage('Account deletion requires a server-side admin call. Contact support.')
    setDeleting(false)
  }

  return (
    <>
      <header className="topbar">
        <h2 className="topbar-title">Settings</h2>
      </header>

      <div className="page-content" style={{ maxWidth: 640 }}>
        {/* Sign out */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={17} /> Account
            </h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
              Sign out of your TriggerBot account on this device.
            </p>
            <button
              className="btn btn-secondary"
              onClick={handleSignOut}
              disabled={signingOut}
              id="settings-signout-btn"
            >
              {signingOut
                ? <span className="spinner" style={{ width: 16, height: 16 }} />
                : <LogOut size={16} />}
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          </div>
        </div>

        {/* About triggers */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3>How Triggers Work</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                ['Scheduling', 'Monitors are triggered by a cron job that calls /api/cron every minute. Set your Vercel cron schedule accordingly.'],
                ['Cool-down Management', 'The app tracks next_trigger_at so each monitor fires only when its interval elapses — perfect for keeping Render, Railway or back-end APIs warm.'],
                ['Retry Logic', 'If a trigger fails, TriggerBot retries up to your configured retry count with exponential back-off.'],
                ['Logs', 'Every trigger attempt is logged with status code, response time, and error details for full observability.'],
              ].map(([title, desc]) => (
                <div key={title as string} style={{ display: 'flex', gap: '0.875rem' }}>
                  <CheckCircle size={18} color="var(--accent-success)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="card-header" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-danger)' }}>
              <ShieldAlert size={17} /> Danger Zone
            </h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Permanently delete your account and all monitors. This cannot be undone.
            </p>
            {message && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                {message}
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="delete-confirm">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                className="form-input"
                placeholder="DELETE"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
              />
            </div>
            <button
              className="btn btn-danger"
              onClick={handleDeleteAccount}
              disabled={deleting}
              id="delete-account-btn"
            >
              {deleting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Trash2 size={16} />}
              Delete My Account
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

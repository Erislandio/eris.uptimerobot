'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Activity, LayoutDashboard, Radio, Clock,
  BarChart2, Settings, LogOut, Zap
} from 'lucide-react'

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Monitors', href: '/dashboard/monitors', icon: Radio },
  { label: 'Logs', href: '/dashboard/logs', icon: Clock },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart2 },
]

interface SidebarProps {
  userEmail?: string
}

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : 'U'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap size={20} color="white" fill="white" />
        </div>
        <span className="sidebar-logo-text">TriggerBot</span>
        <span className="sidebar-logo-badge">Beta</span>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Navigation</span>
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} className="icon" />
              {item.label}
            </Link>
          )
        })}

        <span className="sidebar-section-label" style={{ marginTop: '0.75rem' }}>Account</span>
        <Link href="/dashboard/settings" className={`sidebar-item ${pathname === '/dashboard/settings' ? 'active' : ''}`}>
          <Settings size={17} className="icon" />
          Settings
        </Link>
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-email">{userEmail}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="btn btn-ghost btn-icon"
            title="Sign out"
            id="signout-btn"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}

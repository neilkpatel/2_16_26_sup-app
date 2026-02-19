import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import './History.css'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function History() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetch = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*, from_user:users!notifications_from_user_id_fkey(username)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotifications(data || [])
      setLoading(false)
    }
    fetch()
  }, [user])

  return (
    <div className="history-container">
      <header className="history-header">
        <Link to="/" className="history-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="history-title">Activity</h1>
      </header>

      <div className="history-list">
        {loading ? (
          <p className="history-empty">Loading...</p>
        ) : notifications.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">🔔</div>
            <p>No activity yet</p>
            <p className="history-empty-hint">When someone in your squad goes Sup, you'll see it here</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="history-item">
              <div className="history-avatar">
                {(n.from_user?.username || '?')[0].toUpperCase()}
              </div>
              <div className="history-content">
                <p className="history-message">{n.message}</p>
                <p className="history-time">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default History

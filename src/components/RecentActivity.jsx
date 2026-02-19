import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './RecentActivity.css'

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

export function RecentActivity({ userId }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchRecent = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*, from_user:users!notifications_from_user_id_fkey(username)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)

      setNotifications(data || [])
      setLoading(false)
    }
    fetchRecent()
  }, [userId])

  if (loading || notifications.length === 0) return null

  return (
    <div className="recent-activity">
      <h3 className="recent-activity-title">Recent</h3>
      {notifications.map((n) => (
        <div key={n.id} className="recent-activity-item">
          <div className="recent-activity-avatar">
            {(n.from_user?.username || '?')[0].toUpperCase()}
          </div>
          <span className="recent-activity-text">{n.message}</span>
          <span className="recent-activity-time">{timeAgo(n.created_at)}</span>
        </div>
      ))}
      <Link to="/history" className="recent-activity-more">See all</Link>
    </div>
  )
}

export default RecentActivity

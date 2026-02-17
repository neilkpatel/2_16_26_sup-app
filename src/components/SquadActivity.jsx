import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './SquadActivity.css'

function timeAgo(dateStr) {
  const now = new Date()
  const then = new Date(dateStr)
  const mins = Math.floor((now - then) / 60000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

export function SquadActivity({ friendIds, friends }) {
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!friendIds.length) {
      setActivity([])
      setLoading(false)
      return
    }

    async function fetchActivity() {
      try {
        // Get most recent expired session per friend
        const { data, error } = await supabase
          .from('sup_sessions')
          .select('user_id, started_at')
          .in('user_id', friendIds)
          .order('started_at', { ascending: false })
          .limit(20)

        if (error) throw error

        // Deduplicate — keep only the most recent per user
        const seen = new Set()
        const recent = (data || []).filter(s => {
          if (seen.has(s.user_id)) return false
          seen.add(s.user_id)
          return true
        })

        // Map to friend data
        const friendMap = Object.fromEntries(friends.map(f => [f.id, f]))
        const items = recent
          .map(s => ({
            userId: s.user_id,
            username: friendMap[s.user_id]?.username || 'someone',
            lastSup: s.started_at
          }))
          .slice(0, 5)

        setActivity(items)
      } catch (err) {
        console.error('Error fetching squad activity:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
  }, [friendIds, friends])

  if (loading || activity.length === 0) return null

  return (
    <div className="squad-activity">
      <h3>Squad activity</h3>
      <div className="activity-list">
        {activity.map(item => (
          <div key={item.userId} className="activity-item">
            <div className="activity-avatar">
              {item.username[0].toUpperCase()}
            </div>
            <span className="activity-text">
              <strong>@{item.username}</strong> was last free {timeAgo(item.lastSup)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SquadActivity

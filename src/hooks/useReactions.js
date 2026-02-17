import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook for managing quick reactions on Sup sessions.
 * Follows same pattern as useSupStatus: realtime + 5s polling fallback.
 *
 * @param {string} userId - Current user's ID
 * @param {Array} sessionIds - Array of active friend session IDs to watch reactions for
 * @returns {Object} Reaction state and actions
 */
export function useReactions(userId, sessionIds = []) {
  const [reactions, setReactions] = useState([])
  const [myReactions, setMyReactions] = useState({}) // { sessionId: 'im_in' | 'cant_tonight' | 'maybe_later' }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Stabilize sessionIds to prevent infinite re-renders
  const sessionIdsKey = JSON.stringify(sessionIds)
  const stableSessionIds = useMemo(() => sessionIds, [sessionIdsKey])
  const stableSessionIdsRef = useRef(stableSessionIds)
  useEffect(() => { stableSessionIdsRef.current = stableSessionIds }, [stableSessionIds])

  // Fetch all reactions for the given sessions
  const fetchReactions = useCallback(async () => {
    if (!stableSessionIds.length) {
      setReactions([])
      setMyReactions({})
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('sup_reactions')
        .select(`
          *,
          user:users(id, username)
        `)
        .in('session_id', stableSessionIds)

      if (fetchError) throw fetchError

      setReactions(data || [])

      // Build myReactions map from results
      if (userId && data) {
        const mine = {}
        data.forEach(r => {
          if (r.user_id === userId) {
            mine[r.session_id] = r.reaction
          }
        })
        setMyReactions(mine)
      }
    } catch (err) {
      console.error('Error fetching reactions:', err)
      setError(err.message)
    }
  }, [stableSessionIds, userId])

  // Send/toggle a reaction (upsert — one per user per session)
  const sendReaction = useCallback(async (sessionId, reaction) => {
    if (!userId || !sessionId) return

    try {
      const currentReaction = myReactions[sessionId]

      if (currentReaction === reaction) {
        // Toggle off — same reaction tapped again
        const { error: deleteError } = await supabase
          .from('sup_reactions')
          .delete()
          .eq('session_id', sessionId)
          .eq('user_id', userId)

        if (deleteError) throw deleteError

        setMyReactions(prev => {
          const next = { ...prev }
          delete next[sessionId]
          return next
        })
      } else {
        // Upsert — new reaction or switching
        const { error: upsertError } = await supabase
          .from('sup_reactions')
          .upsert(
            {
              session_id: sessionId,
              user_id: userId,
              reaction
            },
            { onConflict: 'session_id,user_id' }
          )

        if (upsertError) throw upsertError

        setMyReactions(prev => ({ ...prev, [sessionId]: reaction }))
      }

      // Refresh to get latest state
      fetchReactions().catch(() => {})
    } catch (err) {
      console.error('Error sending reaction:', err)
      setError(err.message)
    }
  }, [userId, myReactions, fetchReactions])

  // Get reactions grouped by session
  const getReactionsForSession = useCallback((sessionId) => {
    return reactions.filter(r => r.session_id === sessionId)
  }, [reactions])

  // Initial fetch
  useEffect(() => {
    if (stableSessionIds.length > 0) {
      setLoading(true)
      fetchReactions().finally(() => setLoading(false))
    }
  }, [fetchReactions, stableSessionIds])

  // Realtime subscription for reactions
  useEffect(() => {
    if (!userId || !stableSessionIds.length) return

    const channelName = `sup-reactions-${userId}`
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sup_reactions'
        },
        (payload) => {
          const sessionId = payload.new?.session_id || payload.old?.session_id
          if (stableSessionIdsRef.current.includes(sessionId)) {
            fetchReactions().catch(() => {})
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, fetchReactions])

  // Polling fallback (5s) — same as useSupStatus
  useEffect(() => {
    if (!stableSessionIds.length) return

    const interval = setInterval(() => {
      fetchReactions().catch(() => {})
    }, 5000)

    return () => clearInterval(interval)
  }, [stableSessionIds, fetchReactions])

  return {
    reactions,
    myReactions,
    loading,
    error,
    sendReaction,
    getReactionsForSession,
    refresh: fetchReactions
  }
}

export default useReactions

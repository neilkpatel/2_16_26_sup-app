import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const SUP_DURATION_HOURS = 2

/**
 * Hook for managing Sup status and realtime updates
 * @param {string} userId - Current user's ID
 * @param {Array} friendIds - Array of friend user IDs
 * @returns {Object} Sup status state and actions
 */
export function useSupStatus(userId, friendIds = []) {
  const [isSupActive, setIsSupActive] = useState(false)
  const [mySession, setMySession] = useState(null)
  const [friendSessions, setFriendSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch current user's sup status
  const fetchMyStatus = useCallback(async () => {
    if (!userId) return

    try {
      const { data, error: fetchError } = await supabase
        .from('sup_sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      if (data) {
        setMySession(data)
        setIsSupActive(true)
      } else {
        setMySession(null)
        setIsSupActive(false)
      }
    } catch (err) {
      console.error('Error fetching sup status:', err)
      setError(err.message)
    }
  }, [userId])

  // Fetch friends' sup statuses
  const fetchFriendSessions = useCallback(async () => {
    if (!friendIds.length) {
      setFriendSessions([])
      return
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('sup_sessions')
        .select(`
          *,
          user:users(id, username)
        `)
        .in('user_id', friendIds)
        .gt('expires_at', new Date().toISOString())

      if (fetchError) throw fetchError

      setFriendSessions(data || [])
    } catch (err) {
      console.error('Error fetching friend sessions:', err)
      setError(err.message)
    }
  }, [friendIds])

  // Go Sup - create a new sup session
  const goSup = useCallback(async (location) => {
    if (!userId) {
      throw new Error('Not logged in')
    }

    if (!location) {
      throw new Error('Location required to go Sup')
    }

    try {
      setLoading(true)

      // First, expire any existing sessions
      await supabase
        .from('sup_sessions')
        .delete()
        .eq('user_id', userId)

      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + SUP_DURATION_HOURS)

      const { data, error: insertError } = await supabase
        .from('sup_sessions')
        .insert({
          user_id: userId,
          location: `POINT(${location.lng} ${location.lat})`,
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single()

      if (insertError) throw insertError

      setMySession(data)
      setIsSupActive(true)
      return data
    } catch (err) {
      console.error('Error going sup:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Cancel Sup - end current session
  const cancelSup = useCallback(async () => {
    if (!userId || !mySession) return

    try {
      setLoading(true)

      const { error: deleteError } = await supabase
        .from('sup_sessions')
        .delete()
        .eq('id', mySession.id)

      if (deleteError) throw deleteError

      setMySession(null)
      setIsSupActive(false)
    } catch (err) {
      console.error('Error canceling sup:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId, mySession])

  // Update location for active session
  const updateLocation = useCallback(async (location) => {
    if (!mySession) return

    try {
      const { error: updateError } = await supabase
        .from('sup_sessions')
        .update({
          location: `POINT(${location.lng} ${location.lat})`
        })
        .eq('id', mySession.id)

      if (updateError) throw updateError
    } catch (err) {
      console.error('Error updating location:', err)
    }
  }, [mySession])

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchMyStatus(), fetchFriendSessions()])
      setLoading(false)
    }
    init()
  }, [fetchMyStatus, fetchFriendSessions])

  // Set up realtime subscription for sup sessions
  useEffect(() => {
    if (!userId) return

    const allUserIds = [userId, ...friendIds]

    const subscription = supabase
      .channel('sup-sessions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sup_sessions'
        },
        (payload) => {
          // Check if this change is relevant to us
          const affectedUserId = payload.new?.user_id || payload.old?.user_id
          if (allUserIds.includes(affectedUserId)) {
            if (affectedUserId === userId) {
              fetchMyStatus()
            } else {
              fetchFriendSessions()
            }
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, friendIds, fetchMyStatus, fetchFriendSessions])

  // Parse location from PostGIS POINT format
  const parseLocation = (pointStr) => {
    if (!pointStr) return null
    // Format: POINT(lng lat) or (lng,lat)
    const match = pointStr.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/) ||
                  pointStr.match(/\(([-\d.]+),([-\d.]+)\)/)
    if (match) {
      return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) }
    }
    return null
  }

  // Get friend sessions with parsed locations
  const friendSessionsWithLocations = friendSessions.map(session => ({
    ...session,
    parsedLocation: parseLocation(session.location)
  }))

  const myParsedLocation = mySession ? parseLocation(mySession.location) : null

  return {
    isSupActive,
    mySession,
    myLocation: myParsedLocation,
    friendSessions: friendSessionsWithLocations,
    loading,
    error,
    goSup,
    cancelSup,
    updateLocation,
    refresh: async () => {
      await Promise.all([fetchMyStatus(), fetchFriendSessions()])
    }
  }
}

export default useSupStatus

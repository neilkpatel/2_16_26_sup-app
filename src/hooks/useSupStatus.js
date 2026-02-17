import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

const SUP_DURATION_HOURS = 2

/**
 * Parse a 64-bit double from hex string
 */
function hexToDouble(hex, littleEndian) {
  const bytes = hex.match(/../g).map(b => parseInt(b, 16))
  if (littleEndian) bytes.reverse()
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  bytes.forEach((b, i) => view.setUint8(i, b))
  return view.getFloat64(0)
}

/**
 * Parse location from PostGIS format — handles both:
 * - WKB hex: "0101000020E61000005C5DD0CCA67F52C0E260C270615E4440"
 * - Text: "POINT(lng lat)" or "(lng,lat)"
 */
function parseLocation(pointStr) {
  if (!pointStr) return null

  // Try WKB hex format (PostGIS default output for geography columns)
  if (/^[0-9a-fA-F]+$/.test(pointStr) && pointStr.length >= 42) {
    const le = pointStr.substring(0, 2) === '01'
    let offset = 10 // skip byte order (2) + type (8)
    // Check SRID flag (0x20000000) in type field
    const typeHex = pointStr.substring(2, 10)
    const typeBytes = typeHex.match(/../g)
    const typeVal = parseInt((le ? [...typeBytes].reverse() : typeBytes).join(''), 16)
    if (typeVal & 0x20000000) offset += 8 // skip SRID
    const lng = hexToDouble(pointStr.substring(offset, offset + 16), le)
    const lat = hexToDouble(pointStr.substring(offset + 16, offset + 32), le)
    if (isFinite(lng) && isFinite(lat)) return { lng, lat }
  }

  // Try text formats
  const match = pointStr.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/) ||
                pointStr.match(/\(([-\d.]+),([-\d.]+)\)/)
  if (match) {
    return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) }
  }
  return null
}

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

  // Stabilize friendIds — prevent infinite re-renders from new array references
  const friendIdsKey = JSON.stringify(friendIds)
  const stableFriendIds = useMemo(() => friendIds, [friendIdsKey])

  // Keep a ref for use in realtime callback (avoids stale closure)
  const stableFriendIdsRef = useRef(stableFriendIds)
  useEffect(() => { stableFriendIdsRef.current = stableFriendIds }, [stableFriendIds])

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
        .maybeSingle()

      if (fetchError) {
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
    if (!stableFriendIds.length) {
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
        .in('user_id', stableFriendIds)
        .gt('expires_at', new Date().toISOString())

      if (fetchError) throw fetchError

      setFriendSessions(data || [])
    } catch (err) {
      console.error('Error fetching friend sessions:', err)
      setError(err.message)
    }
  }, [stableFriendIds])

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

  // Set destination (bar the user is heading to)
  const setDestination = useCallback(async (bar) => {
    if (!mySession) return

    try {
      const updateData = bar
        ? {
            destination_name: bar.name,
            destination_location: `POINT(${bar.location.lng} ${bar.location.lat})`
          }
        : {
            destination_name: null,
            destination_location: null
          }

      const { error: updateError } = await supabase
        .from('sup_sessions')
        .update(updateData)
        .eq('id', mySession.id)

      if (updateError) throw updateError

      // Optimistic update
      setMySession(prev => prev ? { ...prev, ...updateData } : prev)
    } catch (err) {
      console.error('Error setting destination:', err)
      setError(err.message)
    }
  }, [mySession])

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        await Promise.all([fetchMyStatus(), fetchFriendSessions()])
      } catch (err) {
        console.error('Error initializing sup status:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [fetchMyStatus, fetchFriendSessions])

  // Set up realtime subscription for sup sessions
  useEffect(() => {
    if (!userId) return

    const channelName = `sup-sessions-${userId}`
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sup_sessions'
        },
        (payload) => {
          const affectedUserId = payload.new?.user_id || payload.old?.user_id
          const allUserIds = [userId, ...stableFriendIdsRef.current]
          if (allUserIds.includes(affectedUserId)) {
            if (affectedUserId === userId) {
              fetchMyStatus().catch(() => {})
            } else {
              fetchFriendSessions().catch(() => {})
            }
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, fetchMyStatus, fetchFriendSessions])

  // Poll for friend sessions while Sup is active (Realtime can be unreliable on mobile)
  useEffect(() => {
    if (!isSupActive || !stableFriendIds.length) return

    const interval = setInterval(() => {
      fetchFriendSessions().catch(() => {})
    }, 5000)

    return () => clearInterval(interval)
  }, [isSupActive, stableFriendIds, fetchFriendSessions])

  // Memoize derived values
  const friendSessionsWithLocations = useMemo(
    () => friendSessions.map(session => ({
      ...session,
      parsedLocation: parseLocation(session.location),
      parsedDestination: parseLocation(session.destination_location)
    })),
    [friendSessions]
  )

  const myParsedLocation = useMemo(
    () => mySession ? parseLocation(mySession.location) : null,
    [mySession]
  )

  const myDestination = useMemo(
    () => mySession?.destination_name
      ? { name: mySession.destination_name, location: parseLocation(mySession.destination_location) }
      : null,
    [mySession]
  )

  return {
    isSupActive,
    mySession,
    myLocation: myParsedLocation,
    myDestination,
    friendSessions: friendSessionsWithLocations,
    loading,
    error,
    goSup,
    cancelSup,
    updateLocation,
    setDestination,
    refresh: async () => {
      await Promise.all([fetchMyStatus(), fetchFriendSessions()])
    }
  }
}

export default useSupStatus

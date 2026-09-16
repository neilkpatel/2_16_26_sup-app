import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook for managing friend connections
 * @param {string} userId - Current user's ID
 * @returns {Object} Friends state and actions
 */
export function useFriends(userId) {
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch friends list
  const fetchFriends = useCallback(async () => {
    if (!userId) {
      setFriends([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get all friendships where user is either user_id or friend_id
      const { data, error: fetchError } = await supabase
        .from('friendships')
        .select(`
          id,
          user_id,
          friend_id,
          created_at,
          friend:users!friendships_friend_id_fkey(id, username, phone),
          user:users!friendships_user_id_fkey(id, username, phone)
        `)
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

      if (fetchError) throw fetchError

      // Normalize the data to always get the "other" person
      const friendsList = data.map(f => {
        const isFriend = f.user_id === userId
        const friendData = isFriend ? f.friend : f.user
        return {
          id: f.id,
          friendshipId: f.id,
          ...friendData,
          createdAt: f.created_at
        }
      })

      setFriends(friendsList)
    } catch (err) {
      console.error('Error fetching friends:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Add a friend by username
  const addFriend = useCallback(async (friendUsername) => {
    if (!userId) {
      throw new Error('Not logged in')
    }

    try {
      // First, find the user by username
      const { data: friendData, error: findError } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', friendUsername.toLowerCase())
        .maybeSingle()

      if (findError || !friendData) {
        throw new Error('User not found')
      }

      if (friendData.id === userId) {
        throw new Error("You can't add yourself as a friend")
      }

      // Check if friendship already exists
      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${userId},friend_id.eq.${friendData.id}),and(user_id.eq.${friendData.id},friend_id.eq.${userId})`)
        .maybeSingle()

      if (existingFriendship) {
        throw new Error('Already friends with this user')
      }

      // Create the friendship
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({
          user_id: userId,
          friend_id: friendData.id
        })

      if (insertError) throw insertError

      // Refresh friends list
      await fetchFriends()
      return friendData
    } catch (err) {
      console.error('Error adding friend:', err)
      throw err
    }
  }, [userId, fetchFriends])

  // Remove a friend
  const removeFriend = useCallback(async (friendshipId) => {
    try {
      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId)

      if (deleteError) throw deleteError

      await fetchFriends()
    } catch (err) {
      console.error('Error removing friend:', err)
      throw err
    }
  }, [fetchFriends])

  // Set up realtime subscription for friend changes
  useEffect(() => {
    if (!userId) return

    fetchFriends().catch(() => {})

    const subscription = supabase
      .channel(`friendships-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'sup',
          table: 'friendships',
          filter: `user_id=eq.${userId}`
        },
        () => { fetchFriends().catch(() => {}) }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'sup',
          table: 'friendships',
          filter: `friend_id=eq.${userId}`
        },
        () => { fetchFriends().catch(() => {}) }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, fetchFriends])

  return {
    friends,
    loading,
    error,
    addFriend,
    removeFriend,
    refresh: fetchFriends
  }
}

export default useFriends

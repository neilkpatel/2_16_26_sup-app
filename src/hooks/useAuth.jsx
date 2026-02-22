import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

/**
 * Auth Provider component
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const initialized = useRef(false)

  // Fetch user profile from our users table
  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (fetchError) throw fetchError

      setProfile(data)
      return data
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }, [])

  // Sign up with email and password
  const signUp = useCallback(async (email, password, username) => {
    try {
      setError(null)

      // Check if username is taken
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', username.toLowerCase())
        .maybeSingle()

      if (existingUser) {
        throw new Error('Username already taken')
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      })

      if (signUpError) throw signUpError

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            username: username.toLowerCase(),
            phone: null
          })

        if (profileError) throw profileError

        // Set state directly — don't rely on onAuthStateChange
        setUser(data.user)
        await fetchProfile(data.user.id)
      }

      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [fetchProfile])

  // Sign in with email
  const signIn = useCallback(async (email, password) => {
    try {
      setError(null)
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) throw signInError

      setUser(data.user)
      if (data.user) {
        await fetchProfile(data.user.id)
      }

      return data
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [fetchProfile])

  // Sign out
  const signOut = useCallback(async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError

      setUser(null)
      setProfile(null)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [])

  // Update username
  const updateUsername = useCallback(async (newUsername) => {
    if (!user) throw new Error('Not logged in')

    try {
      // Check if username is taken
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', newUsername.toLowerCase())
        .neq('id', user.id)
        .maybeSingle()

      if (existingUser) {
        throw new Error('Username already taken')
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ username: newUsername.toLowerCase() })
        .eq('id', user.id)

      if (updateError) throw updateError

      await fetchProfile(user.id)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }, [user, fetchProfile])

  // Initialize auth state — single flow, no races
  useEffect(() => {
    // First, actively check for an existing session.
    // This runs before onAuthStateChange fires and prevents the race condition
    // where ProtectedRoute sees loading=false + user=null before session restores.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
      }
      initialized.current = true
      setLoading(false)
    })

    // onAuthStateChange handles subsequent changes (sign in, sign out, token refresh).
    // IMPORTANT: Do NOT call async supabase methods inside this callback —
    // the auth client locks during the callback, causing deadlocks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user)
        } else {
          setUser(null)
          setProfile(null)
        }
        // If getSession hasn't resolved yet, mark as initialized
        if (!initialized.current) {
          initialized.current = true
          setLoading(false)
        }
      }
    )

    // Safety timeout — if nothing fires (edge case),
    // don't leave the user on a loading screen forever
    const timeout = setTimeout(() => {
      if (!initialized.current) {
        initialized.current = true
        setLoading(false)
      }
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  // Refresh session when app comes back to foreground
  // Covers token expiry while backgrounded (e.g. clicked notification after hours)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && initialized.current) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            setUser(session.user)
          } else {
            setUser(null)
            setProfile(null)
          }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // Fetch profile when user changes — separate from onAuthStateChange
  // to avoid Supabase auth client deadlock
  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id)
    }
  }, [user?.id, fetchProfile])

  const value = {
    user,
    profile,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    updateUsername,
    refreshProfile: () => user && fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default useAuth

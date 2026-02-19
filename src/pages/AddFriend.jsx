import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import './AddFriend.css'

export function AddFriend() {
  const { username } = useParams()
  const { user, profile } = useAuth()
  const { friends, addFriend } = useFriends(user?.id)
  const navigate = useNavigate()

  const [friendProfile, setFriendProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Show iOS install steps if on iOS and not in standalone PWA
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true
  const showInstallSteps = isIOS && !isStandalone

  // Check if already friends
  const isAlreadyFriends = friends.some(
    f => f.username?.toLowerCase() === username?.toLowerCase()
  )

  // Check if this is the current user — compare IDs (works even if profile hasn't loaded)
  const isSelf = !!(user && friendProfile && user.id === friendProfile.id)

  // Fetch the friend's profile using direct REST call
  // (bypasses Supabase client auth state which can block in incognito)
  useEffect(() => {
    async function fetchFriend() {
      if (!username) {
        setLoading(false)
        return
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        const res = await fetch(
          `${supabaseUrl}/rest/v1/users?username=eq.${encodeURIComponent(username.toLowerCase())}&select=id,username`,
          {
            headers: {
              'apikey': supabaseKey,
              'Accept': 'application/json'
            }
          }
        )

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const users = await res.json()

        if (users.length === 0) {
          setError('User not found')
        } else {
          setFriendProfile(users[0])
        }
      } catch (err) {
        console.error('Error fetching friend:', err)
        setError('Failed to load user profile')
      } finally {
        setLoading(false)
      }
    }

    fetchFriend()
  }, [username])

  const handleAddFriend = async () => {
    if (!user) {
      // Save invite intent and redirect to login
      localStorage.setItem('pending_invite', username)
      navigate(`/login?return=/add/${username}`)
      return
    }

    setAdding(true)
    setError('')

    try {
      // Timeout after 10s to prevent infinite hang
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 10000)
      )
      await Promise.race([addFriend(username), timeout])
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="add-friend-container">
        <div className="add-friend-card">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="add-friend-container">
      <div className="add-friend-card">
        <h1 className="logo">Sup</h1>

        {error && !friendProfile ? (
          <>
            <div className="error-message">{error}</div>
            <Link to="/" className="back-link">Go to Sup</Link>
          </>
        ) : friendProfile ? (
          <>
            <div className="friend-avatar">
              {friendProfile.username[0].toUpperCase()}
            </div>
            <h2 className="friend-name">@{friendProfile.username}</h2>

            {isSelf ? (
              <p className="info-message">This is your profile!</p>
            ) : isAlreadyFriends ? (
              <p className="success-message">Already in your squad!</p>
            ) : success ? (
              <>
                <p className="success-message">
                  @{friendProfile.username} joined your squad!
                </p>
                <button onClick={() => navigate('/')} className="primary-button">
                  Open Sup
                </button>
                {showInstallSteps && (
                  <div className="install-steps">
                    <p className="install-steps-title">Add to your home screen for push notifications:</p>
                    <ol className="install-steps-list">
                      <li>Tap the <strong>Share</strong> button <span className="install-icon">⬆</span></li>
                      <li>Tap <strong>Add to Home Screen</strong></li>
                      <li>Open Sup from your home screen</li>
                    </ol>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="invite-text">
                  {user
                    ? `Add @${friendProfile.username} to your squad?`
                    : `Sign up to join @${friendProfile.username}'s squad`}
                </p>

                {error && <div className="error-message">{error}</div>}

                <button
                  onClick={handleAddFriend}
                  disabled={adding}
                  className="primary-button"
                >
                  {adding
                    ? 'Adding...'
                    : user
                    ? 'Join Squad'
                    : 'Sign Up & Join Squad'}
                </button>

                {!user && (
                  <p className="login-prompt">
                    Already have an account?{' '}
                    <Link to={`/login?return=/add/${username}`}>Sign In</Link>
                  </p>
                )}
              </>
            )}

            {(isAlreadyFriends || isSelf) && (
              <button onClick={() => navigate('/')} className="secondary-button">
                Open Sup
              </button>
            )}
          </>
        ) : (
          <>
            <p className="error-message">User not found</p>
            <Link to="/" className="back-link">Go to Sup</Link>
          </>
        )}
      </div>
    </div>
  )
}

export default AddFriend

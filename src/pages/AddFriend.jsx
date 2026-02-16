import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { supabase } from '../lib/supabase'
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

  // Check if already friends
  const isAlreadyFriends = friends.some(
    f => f.username?.toLowerCase() === username?.toLowerCase()
  )

  // Check if this is the current user
  const isSelf = profile?.username?.toLowerCase() === username?.toLowerCase()

  // Fetch the friend's profile
  useEffect(() => {
    async function fetchFriend() {
      if (!username) {
        setLoading(false)
        return
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('id, username')
          .eq('username', username.toLowerCase())
          .single()

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('User not found')
          } else {
            throw fetchError
          }
        } else {
          setFriendProfile(data)
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
      // Redirect to login with return URL
      navigate(`/login?return=/add/${username}`)
      return
    }

    setAdding(true)
    setError('')

    try {
      await addFriend(username)
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

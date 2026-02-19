import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { supabase } from '../lib/supabase'

const DURATION_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 'eod', label: 'End of day' },
]
import './Profile.css'

export function Profile() {
  const { user, profile, signOut, updateUsername, refreshProfile } = useAuth()
  const { friends } = useFriends(user?.id)
  const navigate = useNavigate()

  const [isEditing, setIsEditing] = useState(false)
  const [newUsername, setNewUsername] = useState(profile?.username || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareLink = `${window.location.origin}/add/${profile?.username}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = shareLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Add me on Sup!',
          text: `Add me on Sup so we can hang out! My username is @${profile?.username}`,
          url: shareLink
        })
      } catch (shareErr) {
        // User cancelled or error
        if (shareErr.name !== 'AbortError') {
          handleCopyLink()
        }
      }
    } else {
      handleCopyLink()
    }
  }

  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      setError('Username cannot be empty')
      return
    }

    if (newUsername.length < 3) {
      setError('Username must be at least 3 characters')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }

    setLoading(true)
    setError('')

    try {
      await updateUsername(newUsername)
      setIsEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDurationChange = useCallback(async (value) => {
    const minutes = value === 'eod' ? -1 : Number(value)
    await supabase
      .from('users')
      .update({ sup_duration: minutes })
      .eq('id', user.id)
    // Refresh profile to pick up the change
    if (refreshProfile) refreshProfile()
  }, [user?.id])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="profile-container">
      <header className="profile-header">
        <button onClick={() => navigate('/')} className="back-button">
          Back
        </button>
        <h1>Profile</h1>
        <div></div>
      </header>

      <main className="profile-main">
        <section className="profile-section">
          <h2>Your Username</h2>
          {isEditing ? (
            <div className="edit-username">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="username"
              />
              {error && <p className="error">{error}</p>}
              <div className="edit-actions">
                <button
                  onClick={handleSaveUsername}
                  disabled={loading}
                  className="save-button"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setNewUsername(profile?.username || '')
                    setError('')
                  }}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="username-display">
              <span className="username">@{profile?.username}</span>
              <button onClick={() => setIsEditing(true)} className="edit-button">
                Edit
              </button>
            </div>
          )}
        </section>

        <section className="profile-section">
          <h2>Your Squad Link</h2>
          <p className="hint">Share this link to add people to your squad</p>
          <div className="share-link">
            <input
              type="text"
              value={shareLink}
              readOnly
              onClick={(e) => e.target.select()}
            />
            <button onClick={handleShare} className="share-button">
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </section>

        <section className="profile-section">
          <h2>Squad</h2>
          <p className="friend-count">{friends.length} in your squad</p>
        </section>

        <section className="profile-section">
          <h2>Sup Duration</h2>
          <p className="hint">How long your Sup lasts when you tap it</p>
          <div className="duration-options">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`duration-btn ${(profile?.sup_duration || 15) === (opt.value === 'eod' ? -1 : opt.value) ? 'active' : ''}`}
                onClick={() => handleDurationChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="profile-section">
          <h2>Account</h2>
          <p className="email">{user?.email}</p>
          <button onClick={handleSignOut} className="signout-button">
            Sign Out
          </button>
        </section>
      </main>
    </div>
  )
}

export default Profile

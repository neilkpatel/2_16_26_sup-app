import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import './FriendsList.css'

export function FriendsList({ friends, activeFriends = [], onClose }) {
  const { user, profile } = useAuth()
  const { removeFriend } = useFriends(user?.id)

  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const shareLink = `${window.location.origin}/add/${profile?.username}`

  // Check if a friend is currently Sup
  const isActive = (friendId) => {
    return activeFriends.some(s => s.user_id === friendId)
  }

  const handleShare = async () => {
    // Only use native share on mobile — on desktop it concatenates text+URL badly
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          url: shareLink,
          text: 'Join my squad on Sup!'
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopy()
        }
      }
    } else {
      handleCopy()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
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

  const handleRemove = async (friendshipId, friendUsername) => {
    if (!confirm(`Remove @${friendUsername} from your squad?`)) return

    try {
      await removeFriend(friendshipId)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="friends-list">
      <div className="friends-header">
        <h2>Squad</h2>
        <button onClick={onClose} className="close-button">&times;</button>
      </div>

      <div className="friends-actions">
        <button onClick={handleShare} className="add-button">
          {copied ? 'Link copied!' : 'Share your squad link'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="friends-scroll">
        {friends.length === 0 ? (
          <p className="empty">No one in your squad yet</p>
        ) : (
          <ul className="friends-items">
            {friends.map(friend => (
              <li key={friend.friendshipId} className="friend-item">
                <div className="friend-info">
                  <div className={`friend-avatar ${isActive(friend.id) ? 'active' : ''}`}>
                    {friend.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="friend-details">
                    <span className="friend-username">@{friend.username}</span>
                    {isActive(friend.id) && (
                      <span className="friend-status">Sup!</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(friend.friendshipId, friend.username)}
                  className="remove-button"
                  title="Remove from squad"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default FriendsList

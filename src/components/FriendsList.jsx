import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import './FriendsList.css'

export function FriendsList({ friends, activeFriends = [], onClose }) {
  const { user } = useAuth()
  const { addFriend, removeFriend } = useFriends(user?.id)

  const [showAdd, setShowAdd] = useState(false)
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Check if a friend is currently Sup
  const isActive = (friendId) => {
    return activeFriends.some(s => s.user_id === friendId)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!username.trim()) return

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const friend = await addFriend(username.trim())
      setSuccess(`Added @${friend.username}!`)
      setUsername('')
      setTimeout(() => {
        setSuccess('')
        setShowAdd(false)
      }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (friendshipId, friendUsername) => {
    if (!confirm(`Remove @${friendUsername} from friends?`)) return

    try {
      await removeFriend(friendshipId)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="friends-list">
      <div className="friends-header">
        <h2>Friends</h2>
        <button onClick={onClose} className="close-button">&times;</button>
      </div>

      <div className="friends-actions">
        {showAdd ? (
          <form onSubmit={handleAdd} className="add-form">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoFocus
            />
            <button type="submit" disabled={loading}>
              {loading ? '...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false)
                setError('')
                setSuccess('')
              }}
              className="cancel"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button onClick={() => setShowAdd(true)} className="add-button">
            + Add Friend
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="friends-scroll">
        {friends.length === 0 ? (
          <p className="empty">No friends yet. Add some!</p>
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
                  title="Remove friend"
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

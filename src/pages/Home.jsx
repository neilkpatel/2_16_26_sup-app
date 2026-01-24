import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { useSupStatus } from '../hooks/useSupStatus'
import { useLocation } from '../hooks/useLocation'
import Map from '../components/Map'
import SupButton from '../components/SupButton'
import BarSuggestions from '../components/BarSuggestions'
import FriendsList from '../components/FriendsList'
import { calculateMidpoint } from '../lib/geo'
import './Home.css'

export function Home() {
  const { user, profile } = useAuth()
  const { friends } = useFriends(user?.id)
  const friendIds = useMemo(() => friends.map(f => f.id), [friends])

  const {
    isSupActive,
    myLocation,
    friendSessions,
    goSup,
    cancelSup,
    loading: supLoading
  } = useSupStatus(user?.id, friendIds)

  const {
    location,
    error: locationError,
    loading: locationLoading,
    getCurrentLocation
  } = useLocation()

  const [showFriends, setShowFriends] = useState(false)
  const [error, setError] = useState('')

  // Calculate midpoint of all active Sup users
  const midpoint = useMemo(() => {
    const points = []

    if (myLocation) {
      points.push(myLocation)
    }

    friendSessions.forEach(session => {
      if (session.parsedLocation) {
        points.push(session.parsedLocation)
      }
    })

    return calculateMidpoint(points)
  }, [myLocation, friendSessions])

  // Get active friends (those with active sup sessions)
  const activeFriends = useMemo(() => {
    return friendSessions.map(session => ({
      ...session,
      username: session.user?.username
    }))
  }, [friendSessions])

  const handleSupToggle = async () => {
    setError('')

    if (isSupActive) {
      try {
        await cancelSup()
      } catch (err) {
        setError(err.message)
      }
    } else {
      try {
        let loc = location
        if (!loc) {
          loc = await getCurrentLocation()
        }
        await goSup(loc)
      } catch (err) {
        setError(err.message)
      }
    }
  }

  // Request location on mount if not available
  useEffect(() => {
    if (!location && !locationLoading && !locationError) {
      getCurrentLocation().catch(() => {
        // Location permission may be denied, that's ok
      })
    }
  }, [location, locationLoading, locationError, getCurrentLocation])

  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="logo">Sup</h1>
        <nav className="nav-links">
          <button
            className="nav-button"
            onClick={() => setShowFriends(!showFriends)}
          >
            Friends ({friends.length})
          </button>
          <Link to="/profile" className="nav-button">
            @{profile?.username || 'Profile'}
          </Link>
        </nav>
      </header>

      <main className="home-main">
        {showFriends && (
          <div className="friends-panel">
            <FriendsList
              friends={friends}
              activeFriends={activeFriends}
              onClose={() => setShowFriends(false)}
            />
          </div>
        )}

        <div className="map-container">
          <Map
            userLocation={location}
            isSupActive={isSupActive}
            friendSessions={activeFriends}
            midpoint={midpoint}
          />
        </div>

        {isSupActive && activeFriends.length > 0 && midpoint && (
          <div className="suggestions-container">
            <BarSuggestions location={midpoint} />
          </div>
        )}

        <div className="sup-button-container">
          {(error || locationError) && (
            <div className="error-toast">{error || locationError}</div>
          )}

          <SupButton
            isActive={isSupActive}
            loading={supLoading || locationLoading}
            onClick={handleSupToggle}
            activeCount={activeFriends.length}
          />

          {isSupActive && (
            <p className="sup-status">
              You're Sup! {activeFriends.length > 0
                ? `${activeFriends.length} friend${activeFriends.length === 1 ? '' : 's'} also free`
                : 'Waiting for friends...'}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

export default Home

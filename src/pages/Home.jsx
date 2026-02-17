import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { useSupStatus } from '../hooks/useSupStatus'
import { useLocation } from '../hooks/useLocation'
import { usePushNotifications } from '../hooks/usePushNotifications'
import Map from '../components/Map'
import SupButton from '../components/SupButton'
import BarSuggestions from '../components/BarSuggestions'
import FriendsList from '../components/FriendsList'
import InstallPrompt from '../components/InstallPrompt'
import { calculateMidpoint } from '../lib/geo'
import { supabase } from '../lib/supabase'
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

  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    permission: pushPermission,
    subscribe: pushSubscribe
  } = usePushNotifications(user?.id)

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

        // After going Sup: prompt for push if not subscribed, then notify squad
        if (pushSupported && !pushSubscribed) {
          pushSubscribe()
        }

        // Fire-and-forget: notify squad via edge function
        supabase.functions.invoke('send-push', {
          body: { userId: user.id }
        })
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
            Squad ({friends.length})
          </button>
          <Link to="/profile" className="nav-button">
            @{profile?.username || 'Profile'}
          </Link>
        </nav>
      </header>

      <main className="home-main">
        {pushSupported && pushPermission === 'default' && !pushSubscribed && (
          <div className="notification-banner">
            <span>Enable notifications to know when your squad is free</span>
            <button onClick={pushSubscribe} className="notification-banner-btn">Enable</button>
          </div>
        )}

        <InstallPrompt />

        {!isSupActive && activeFriends.length > 0 && (
          <div className="active-friends-banner">
            <span>
              {activeFriends.length === 1
                ? `@${activeFriends[0].username} is free to hang!`
                : `${activeFriends.map(f => `@${f.username}`).join(', ')} are free to hang!`}
            </span>
            <span className="active-friends-cta">Tap Sup to join</span>
          </div>
        )}

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
              {activeFriends.length > 0
                ? `${activeFriends.length} in your squad also free — check the map!`
                : 'Your squad has been notified. Hang tight!'}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

export default Home

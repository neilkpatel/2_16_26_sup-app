import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFriends } from '../hooks/useFriends'
import { useSupStatus } from '../hooks/useSupStatus'
import { useLocation } from '../hooks/useLocation'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useReactions } from '../hooks/useReactions'
import Map from '../components/Map'
import SupButton from '../components/SupButton'
import BarSuggestions from '../components/BarSuggestions'
import FriendsList from '../components/FriendsList'
import InstallPrompt from '../components/InstallPrompt'
import SquadActivity from '../components/SquadActivity'
import ReactionButtons from '../components/ReactionButtons'
import ReactionsSummary from '../components/ReactionsSummary'
import { calculateMidpoint } from '../lib/geo'
import { supabase } from '../lib/supabase'
import './Home.css'

export function Home() {
  const { user, profile } = useAuth()
  const { friends } = useFriends(user?.id)
  const friendIds = useMemo(() => friends.map(f => f.id), [friends])

  const {
    isSupActive,
    mySession,
    myLocation,
    myDestination,
    friendSessions,
    goSup,
    cancelSup,
    setDestination,
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

  // Collect session IDs for reactions — friend sessions (when NOT Sup'd) or my session (when Sup'd)
  const reactionSessionIds = useMemo(() => {
    if (isSupActive && mySession) {
      // When Sup'd, watch reactions on my own session
      return [mySession.id]
    }
    // When NOT Sup'd, watch friend sessions to react to
    return friendSessions.map(s => s.id)
  }, [isSupActive, mySession, friendSessions])

  const {
    myReactions,
    sendReaction,
    getReactionsForSession
  } = useReactions(user?.id, reactionSessionIds)

  const [showFriends, setShowFriends] = useState(false)
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState(null)
  const [selectedBarId, setSelectedBarId] = useState(null)
  const [joinFlash, setJoinFlash] = useState(false)
  const [declined, setDeclined] = useState(false)

  // Countdown timer for active Sup session
  useEffect(() => {
    if (!isSupActive || !mySession?.expires_at) {
      setTimeLeft(null)
      return
    }

    const tick = () => {
      const remaining = new Date(mySession.expires_at) - Date.now()
      if (remaining <= 0) {
        setTimeLeft(null)
        cancelSup().catch(() => {})
        return
      }
      setTimeLeft(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isSupActive, mySession?.expires_at, cancelSup])

  // Get active friends (those with active sup sessions)
  const activeFriends = useMemo(() => {
    return friendSessions.map(session => ({
      ...session,
      username: session.user?.username
    }))
  }, [friendSessions])

  // Clear selected bar when Sup ends
  useEffect(() => {
    if (!isSupActive) {
      setSelectedBarId(null)
    }
  }, [isSupActive])

  // Clear declined state when no friends are active
  useEffect(() => {
    if (activeFriends.length === 0) {
      setDeclined(false)
    }
  }, [activeFriends.length])

  // Format countdown string
  const countdownText = useMemo(() => {
    if (!timeLeft) return null
    const totalMins = Math.floor(timeLeft / 60000)
    const hrs = Math.floor(totalMins / 60)
    const mins = totalMins % 60
    const secs = Math.floor((timeLeft % 60000) / 1000)
    if (hrs > 0) return `${hrs}h ${mins}m left`
    if (mins >= 10) return `${mins}m left`
    return `${mins}m ${secs}s left`
  }, [timeLeft])

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

  // Handle bar selection for "heading there"
  const handleSelectBar = useCallback((bar) => {
    if (selectedBarId === bar.id) {
      // Deselect — tap same bar again
      setSelectedBarId(null)
      setDestination(null)
    } else {
      setSelectedBarId(bar.id)
      setDestination(bar)
    }
  }, [selectedBarId, setDestination])

  // Core Sup trigger — shared by Sup button and "i'm in" reaction
  const triggerSup = useCallback(async () => {
    setError('')
    try {
      let loc = location
      if (!loc) {
        loc = await getCurrentLocation()
      }
      await goSup(loc)

      if (pushSupported && !pushSubscribed) {
        pushSubscribe()
      }

      // Fire-and-forget: notify squad via edge function
      supabase.functions.invoke('send-push', {
        body: { userId: user.id }
      })

      // Show "You're in!" flash
      setJoinFlash(true)
      setTimeout(() => setJoinFlash(false), 2000)
      setDeclined(false)
    } catch (err) {
      setError(err.message)
    }
  }, [location, getCurrentLocation, goSup, pushSupported, pushSubscribed, pushSubscribe, user?.id])

  const handleSupToggle = async () => {
    setError('')

    if (isSupActive) {
      try {
        await cancelSup()
      } catch (err) {
        setError(err.message)
      }
    } else {
      await triggerSup()
    }
  }

  // Handle reaction — "i'm in" auto-triggers Sup, others decline
  const handleReaction = useCallback(async (sessionId, reaction) => {
    await sendReaction(sessionId, reaction)

    if (reaction === 'im_in' && !isSupActive) {
      await triggerSup()
    } else if (reaction === 'cant_tonight' || reaction === 'maybe_later') {
      setDeclined(true)
    }
  }, [sendReaction, isSupActive, triggerSup])

  // Request location on mount if not available
  useEffect(() => {
    if (!location && !locationLoading && !locationError) {
      getCurrentLocation().catch(() => {
        // Location permission may be denied, that's ok
      })
    }
  }, [location, locationLoading, locationError, getCurrentLocation])

  // Friend destinations for pinning bars
  const friendDestinations = useMemo(() => {
    const dests = []
    activeFriends.forEach(f => {
      if (f.destination_name && f.parsedDestination) {
        const existing = dests.find(d => d.name === f.destination_name)
        if (existing) {
          existing.usernames.push(f.username)
        } else {
          dests.push({
            name: f.destination_name,
            location: f.parsedDestination,
            usernames: [f.username]
          })
        }
      }
    })
    return dests
  }, [activeFriends])

  // Reactions on my session (shown when I'm Sup'd)
  const mySessionReactions = useMemo(() => {
    if (!mySession) return []
    return getReactionsForSession(mySession.id)
  }, [mySession, getReactionsForSession])

  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="logo">
          <img src="/logo.png" alt="Sup" className="logo-icon" />
          <span className="tagline">— see who's free</span>
        </h1>
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
            <div className="active-friends-info">
              <span>
                {activeFriends.length === 1
                  ? `@${activeFriends[0].username} is free to hang!`
                  : `${activeFriends.map(f => `@${f.username}`).join(', ')} are free to hang!`}
              </span>
              {!declined && <span className="active-friends-cta">Tap Sup to join</span>}
            </div>
            {activeFriends.map(friend => (
              <ReactionButtons
                key={friend.id}
                sessionId={friend.id}
                currentReaction={myReactions[friend.id]}
                onReact={handleReaction}
              />
            ))}
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
            myDestination={myDestination}
          />
        </div>

        {isSupActive && activeFriends.length > 0 && midpoint && (
          <div className="suggestions-container">
            <BarSuggestions
              location={midpoint}
              selectedBarId={selectedBarId}
              onSelectBar={handleSelectBar}
              friendDestinations={friendDestinations}
            />
          </div>
        )}

        {!isSupActive && friends.length > 0 && (
          <SquadActivity friendIds={friendIds} friends={friends} />
        )}

        <div className="sup-button-container">
          {(error || locationError) && (
            <div className="error-toast">{error || locationError}</div>
          )}

          {joinFlash && (
            <div className="join-flash">You're in!</div>
          )}

          {(!declined || isSupActive) && (
            <SupButton
              isActive={isSupActive}
              loading={supLoading || locationLoading}
              onClick={handleSupToggle}
              activeCount={activeFriends.length}
            />
          )}

          {isSupActive ? (
            <div className="sup-active-info">
              <p className="sup-status">
                {activeFriends.length > 0
                  ? `${activeFriends.length} in your squad also free — check the map!`
                  : 'Your squad has been notified. Hang tight!'}
              </p>
              {mySessionReactions.length > 0 && (
                <ReactionsSummary reactions={mySessionReactions} />
              )}
              {activeFriends.some(f => f.destination_name) && (
                <div className="friend-destinations">
                  {activeFriends.filter(f => f.destination_name).map(f => (
                    <p key={f.id} className="friend-destination-status">
                      @{f.username} is heading to {f.destination_name}
                    </p>
                  ))}
                </div>
              )}
              {countdownText && (
                <p className="sup-countdown">{countdownText}</p>
              )}
            </div>
          ) : declined ? (
            <p className="sup-declined-text">You can always change your mind and tap "i'm in"</p>
          ) : activeFriends.length === 0 && (
            <p className="sup-cta">Tap Sup to see who wants to hang</p>
          )}
        </div>
      </main>
    </div>
  )
}

export default Home

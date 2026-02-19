import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import EmptySquad from '../components/EmptySquad'
import { calculateMidpoint } from '../lib/geo'
import { supabase } from '../lib/supabase'
import './Home.css'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return 'earlier today'
}

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
    refresh: refreshSup,
    loading: supLoading
  } = useSupStatus(user?.id, friendIds, profile?.sup_duration || 30)

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

  const navTo = useNavigate()

  // Check for pending invite from pre-signup flow
  useEffect(() => {
    const pendingInvite = localStorage.getItem('pending_invite')
    if (pendingInvite) {
      localStorage.removeItem('pending_invite')
      navTo(`/add/${pendingInvite}`)
    }
  }, [navTo])

  const [showFriends, setShowFriends] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState(null)
  const [selectedBarId, setSelectedBarId] = useState(null)
  const [dismissedSessionIds, setDismissedSessionIds] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('dismissed_sups') || '[]')
    } catch { return [] }
  })

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

  // All active friend sessions dismissed?
  const declined = activeFriends.length > 0 &&
    activeFriends.every(f => dismissedSessionIds.includes(f.id))

  // Clear selected bar when Sup ends
  useEffect(() => {
    if (!isSupActive) {
      setSelectedBarId(null)
    }
  }, [isSupActive])

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

      // Notify active squad members about bar choice
      supabase.functions.invoke('send-push', {
        body: {
          userId: user.id,
          message: `${profile?.username} is heading to ${bar.name}`,
          targetActive: true
        }
      })
    }
  }, [selectedBarId, setDestination, user?.id, profile?.username])

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

      setDismissedSessionIds([])
      sessionStorage.removeItem('dismissed_sups')
    } catch (err) {
      setError(err.message)
    }
  }, [location, getCurrentLocation, goSup, pushSupported, pushSubscribed, pushSubscribe, user?.id])

  const handleSupToggle = async () => {
    setError('')

    if (isSupActive) {
      try {
        await cancelSup()
        const ids = activeFriends.map(f => f.id)
        const updated = [...new Set([...dismissedSessionIds, ...ids])]
        setDismissedSessionIds(updated)
        sessionStorage.setItem('dismissed_sups', JSON.stringify(updated))
        refreshSup()
      } catch (err) {
        setError(err.message)
      }
    } else {
      await triggerSup()
    }
  }

  // "Not now" — dismiss the overlay and notify the sender
  const handleNotNow = useCallback(() => {
    const ids = activeFriends.map(f => f.id)
    const updated = [...new Set([...dismissedSessionIds, ...ids])]
    setDismissedSessionIds(updated)
    sessionStorage.setItem('dismissed_sups', JSON.stringify(updated))

    // Notify active friends that we can't make it
    supabase.functions.invoke('send-push', {
      body: {
        userId: user.id,
        message: `${profile?.username} can't make it right now`,
        targetActive: true
      }
    })
  }, [activeFriends, dismissedSessionIds, user?.id, profile?.username])

  // Share squad link
  const shareLink = `${window.location.origin}/add/${profile?.username}`
  const handleShareLink = useCallback(async () => {
    const text = 'Join my squad on Sup!'
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isMobile && navigator.share) {
      try {
        await navigator.share({ url: shareLink, text })
        return
      } catch (err) {
        if (err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(shareLink)
    } catch {
      const input = document.createElement('input')
      input.value = shareLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [shareLink])

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

  // Consensus detection — when 2+ people pick the same bar
  const consensus = useMemo(() => {
    // Case 1: I picked a bar and friends match
    if (myDestination?.name) {
      const matchingFriends = friendDestinations.find(d => d.name === myDestination.name)
      if (matchingFriends) {
        return {
          barName: myDestination.name,
          usernames: matchingFriends.usernames,
          includesMe: true
        }
      }
    }

    // Case 2: I haven't picked, but 2+ friends agree on a bar
    if (isSupActive && !myDestination?.name) {
      const popular = friendDestinations.find(d => d.usernames.length >= 2)
      if (popular) {
        return {
          barName: popular.name,
          usernames: popular.usernames,
          includesMe: false
        }
      }
    }

    return null
  }, [myDestination, friendDestinations, isSupActive])

  // Track previous consensus to detect new matches
  const prevConsensusRef = useRef(null)
  const [showConsensus, setShowConsensus] = useState(false)

  useEffect(() => {
    const prevKey = prevConsensusRef.current
    const newKey = consensus ? `${consensus.barName}-${consensus.usernames.join(',')}` : null

    if (consensus && newKey !== prevKey) {
      setShowConsensus(true)
      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => setShowConsensus(false), 8000)
      prevConsensusRef.current = newKey
      return () => clearTimeout(timer)
    }

    if (!consensus) {
      setShowConsensus(false)
      prevConsensusRef.current = null
    }
  }, [consensus])

  return (
    <div className="home-container">
      <header className="home-header">
        <h1 className="logo">
          <img src="/logo.png" alt="Sup" className="logo-icon" />
        </h1>
        <nav className="nav-links">
          <button className="nav-button invite-btn" onClick={handleShareLink}>
            {copied ? 'Copied!' : 'Invite'}
          </button>
          <button
            className="nav-button invite-btn"
            onClick={() => setShowFriends(!showFriends)}
          >
            Squad ({friends.length})
          </button>
          <Link to="/history" className="nav-button invite-btn">Recent</Link>
          <Link to="/profile" className="nav-button profile-avatar">
            {(profile?.username || '?')[0].toUpperCase()}
          </Link>
        </nav>
      </header>

      <main className="home-main">
        {(error || locationError) && (
          <div className="error-toast">{error || locationError}</div>
        )}

        {pushSupported && pushPermission === 'default' && !pushSubscribed && (
          <div className="notification-banner">
            <span>Enable notifications to know when your squad is free</span>
            <button onClick={pushSubscribe} className="notification-banner-btn">Enable</button>
          </div>
        )}

        <InstallPrompt />

        {!isSupActive && activeFriends.length > 0 && !declined && (
          <div className="active-friends-overlay">
            <div className="active-friends-card">
              <div className="active-friends-pulse" />
              <p className="active-friends-names">
                {activeFriends.length === 1
                  ? `@${activeFriends[0].username}`
                  : activeFriends.map(f => `@${f.username}`).join(', ')}
              </p>
              <p className="active-friends-label">
                {activeFriends.length === 1 ? 'is free to hang!' : 'are free to hang!'}
              </p>
              <p className="active-friends-since">
                {activeFriends.length === 1
                  ? `Went Sup ${timeAgo(activeFriends[0].started_at)}`
                  : `Started ${timeAgo(activeFriends[activeFriends.length - 1].started_at)}`}
              </p>
              <p className="active-friends-hint">Tap Sup to join</p>
              <button className="active-friends-dismiss-btn" onClick={handleNotNow}>
                Not now
              </button>
            </div>
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

        {friends.length === 0 ? (
          <EmptySquad profile={profile} />
        ) : (
          <>
            <div className="map-container">
              <Map
                userLocation={location}
                isSupActive={isSupActive}
                friendSessions={activeFriends}
                midpoint={midpoint}
                myDestination={myDestination}
              />
            </div>

            {isSupActive && (
              <div className="sup-status-bar">
                <span className="sup-status-names">
                  {activeFriends.length > 0
                    ? activeFriends.map(f => `@${f.username}`).join(', ') + ' also free'
                    : 'Waiting on your squad...'}
                </span>
                {countdownText && (
                  <span className="sup-status-timer">{countdownText}</span>
                )}
              </div>
            )}

            {showConsensus && consensus && (
              <div className="consensus-banner">
                <div className="consensus-icon">🎉</div>
                <p className="consensus-text">
                  {consensus.includesMe ? (
                    <>
                      You and {consensus.usernames.length === 1
                        ? `@${consensus.usernames[0]}`
                        : consensus.usernames.slice(0, -1).map(u => `@${u}`).join(', ') +
                          ` and @${consensus.usernames[consensus.usernames.length - 1]}`
                      } are heading to <strong>{consensus.barName}</strong>!
                    </>
                  ) : (
                    <>
                      {consensus.usernames.length === 1
                        ? `@${consensus.usernames[0]} is`
                        : consensus.usernames.map(u => `@${u}`).join(' and ') + ' agreed on'
                      } <strong>{consensus.barName}</strong>!
                    </>
                  )}
                </p>
                <p className="consensus-subtext">
                  {consensus.includesMe ? 'Go meet them there!' : 'Tap it to join them!'}
                </p>
                <button className="consensus-dismiss" onClick={() => setShowConsensus(false)}>Got it</button>
              </div>
            )}

            {isSupActive && (midpoint || location) && (
              <div className="suggestions-container">
                <BarSuggestions
                  location={midpoint || location}
                  selectedBarId={selectedBarId}
                  onSelectBar={handleSelectBar}
                  friendDestinations={friendDestinations}
                />
              </div>
            )}

          </>
        )}

        {!isSupActive && !declined && activeFriends.length === 0 && friends.length > 0 && (
          <p className="sup-cta">Tap Sup to see who wants to hang</p>
        )}

        {!isSupActive && declined && (
          <p className="sup-declined-text">Changed your mind? Tap Sup to join</p>
        )}
      </main>

      <SupButton
        isActive={isSupActive}
        loading={supLoading || locationLoading}
        onClick={handleSupToggle}
        activeCount={activeFriends.length}
      />
    </div>
  )
}

export default Home

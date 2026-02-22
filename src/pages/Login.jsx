import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './Login.css'

function shouldShowInstall() {
  if (typeof navigator === 'undefined') return false
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true
  return isIOS && !isStandalone
}

export function Login() {
  const [isSignUp, setIsSignUp] = useState(() => {
    // Returning users should see Sign In, not Sign Up
    return !localStorage.getItem('sup_has_account')
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  // Check for return URL (e.g. from /add/username invite flow)
  const returnUrl = new URLSearchParams(window.location.search).get('return')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (isSignUp) {
        if (!username.trim()) {
          throw new Error('Username is required')
        }
        if (username.length < 3) {
          throw new Error('Username must be at least 3 characters')
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          throw new Error('Username can only contain letters, numbers, and underscores')
        }

        await signUp(email, password, username)
        localStorage.setItem('sup_has_account', 'true')
        navigate(returnUrl || '/')
      } else {
        await signIn(email, password)
        localStorage.setItem('sup_has_account', 'true')
        navigate(returnUrl || '/')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    setShowInstall(shouldShowInstall())
  }, [])

  return (
    <div className="login-container">
      {showInstall && (
        <div className="install-hero">
          <div className="install-hero-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </div>
          <p className="install-hero-title">Add Sup to your Home Screen</p>
          <div className="install-hero-steps">
            <div className="install-step">
              <span className="install-step-num">1</span>
              <span>Tap the <strong>Share</strong> button <span className="install-share-icon">↑</span> at the bottom of Safari</span>
            </div>
            <div className="install-step">
              <span className="install-step-num">2</span>
              <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
            </div>
            <div className="install-step">
              <span className="install-step-num">3</span>
              <span>Tap <strong>Add</strong> — then open Sup from your home screen</span>
            </div>
          </div>
          <p className="install-hero-why">Required for push notifications and full-screen mode</p>
          <button className="install-hero-dismiss" onClick={() => setShowInstall(false)}>I'll do it later</button>
        </div>
      )}
      <div className="login-card">
        <img src="/logo.png" alt="Sup" className="login-logo" />
        <h1 className="login-title">Sup</h1>
        <p className="login-subtitle">See who's free to hang</p>

        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="yourname"
                autoComplete="username"
                required={isSignUp}
              />
              <span className="input-hint">sup.app/{username || 'yourname'}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={6}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="toggle-mode">
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <button onClick={() => setIsSignUp(false)}>Sign In</button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button onClick={() => setIsSignUp(true)}>Sign Up</button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login

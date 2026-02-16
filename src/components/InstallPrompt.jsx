import { useState, useEffect } from 'react'
import './InstallPrompt.css'

const DISMISS_KEY = 'sup-install-prompt-dismissed'

/**
 * Shows "Add to Home Screen" instructions on iOS Safari
 * when not running in standalone (PWA) mode.
 */
export function InstallPrompt() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || navigator.standalone === true
    const isDismissed = localStorage.getItem(DISMISS_KEY)

    if (isIOS && !isStandalone && !isDismissed) {
      setShow(true)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <p className="install-prompt-text">
          Add Sup to your home screen to get notifications when your squad is free
        </p>
        <p className="install-prompt-instructions">
          Tap <span className="install-prompt-icon">↑</span> Share then <strong>Add to Home Screen</strong>
        </p>
      </div>
      <button onClick={handleDismiss} className="install-prompt-dismiss">&times;</button>
    </div>
  )
}

export default InstallPrompt

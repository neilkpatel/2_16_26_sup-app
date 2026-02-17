import { useSyncExternalStore } from 'react'
import './InstallPrompt.css'

const DISMISS_KEY = 'sup-install-prompt-dismissed'

function shouldShow() {
  if (typeof navigator === 'undefined') return false
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true
  const isDismissed = localStorage.getItem(DISMISS_KEY)
  return isIOS && !isStandalone && !isDismissed
}

let showState = shouldShow()
const listeners = new Set()

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return showState
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, 'true')
  showState = false
  listeners.forEach(cb => cb())
}

export function InstallPrompt() {
  const show = useSyncExternalStore(subscribe, getSnapshot)

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
      <button onClick={dismiss} className="install-prompt-dismiss">&times;</button>
    </div>
  )
}

export default InstallPrompt

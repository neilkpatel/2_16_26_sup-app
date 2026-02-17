import './InstallPrompt.css'

function shouldShow() {
  if (typeof navigator === 'undefined') return false
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true
  return isIOS && !isStandalone
}

export function InstallPrompt() {
  if (!shouldShow()) return null

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <p className="install-prompt-title">Sup works best from your home screen</p>
        <p className="install-prompt-text">
          To get push notifications when your squad is free, you need to install Sup as an app:
        </p>
        <ol className="install-prompt-steps">
          <li>Tap the <strong>Share</strong> button <span className="install-prompt-icon">⬆</span></li>
          <li>Tap <strong>Add to Home Screen</strong></li>
          <li>Open Sup from your home screen</li>
        </ol>
        <p className="install-prompt-note">
          Also make sure to <strong>allow notifications</strong> and <strong>location</strong> when asked — that's how your squad knows you're free and where to meet.
        </p>
      </div>
    </div>
  )
}

export default InstallPrompt

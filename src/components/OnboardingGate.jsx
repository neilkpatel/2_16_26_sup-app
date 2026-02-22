import { useState } from 'react'
import { useOnboardingGate } from '../hooks/useOnboardingGate'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useAuth } from '../hooks/useAuth'
import './OnboardingGate.css'

const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

export function OnboardingGate({ userId, children }) {
  const {
    currentStep,
    isInstalled,
    locationPermission,
    notificationPermission,
    deferredPrompt,
    requestLocation,
    requestNotification,
    triggerInstallPrompt,
    skipStep
  } = useOnboardingGate()

  const { signOut } = useAuth()
  const push = usePushNotifications(userId)
  const [locationLoading, setLocationLoading] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [locationDenied, setLocationDenied] = useState(false)
  const [notifDenied, setNotifDenied] = useState(false)

  // All done — render the app
  if (currentStep === 0) return children

  // Count how many steps are actually remaining
  const pendingSteps = [
    !isInstalled,
    locationPermission !== 'granted',
    notificationPermission !== 'granted'
  ].filter(Boolean).length

  const isOnlyLocationNeeded = pendingSteps === 1 && currentStep === 2

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await triggerInstallPrompt()
    }
  }

  const handleLocationClick = async () => {
    setLocationLoading(true)
    const result = await requestLocation()
    if (result === 'denied') setLocationDenied(true)
    setLocationLoading(false)
  }

  const handleNotificationClick = async () => {
    setNotifLoading(true)
    await push.subscribe()
    const result = await requestNotification()
    if (result === 'denied') setNotifDenied(true)
    setNotifLoading(false)
  }

  // Simple location-only prompt for returning users
  if (isOnlyLocationNeeded) {
    return (
      <div className="onboarding-gate">
        <div className="onboarding-card">
          <div className="onboarding-step-icon">📍</div>
          <h2 className="onboarding-step-title">Allow Location</h2>
          <p className="onboarding-step-desc">
            Sup needs your location to find meetup spots. Your location is only used while the app is open and is never stored permanently.
          </p>

          {locationDenied ? (
            <div className="onboarding-denied">
              <p className="onboarding-denied-text">
                Location access was denied. To fix this:
              </p>
              <div className="onboarding-instructions">
                {isIOS ? (
                  <>
                    <div className="onboarding-instruction-row">
                      <span className="onboarding-instruction-num">1</span>
                      <span>Open <strong>Settings</strong> → <strong>Sup</strong></span>
                    </div>
                    <div className="onboarding-instruction-row">
                      <span className="onboarding-instruction-num">2</span>
                      <span>Tap <strong>Location</strong> → <strong>While Using the App</strong></span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="onboarding-instruction-row">
                      <span className="onboarding-instruction-num">1</span>
                      <span>Tap the <strong>lock icon</strong> in the address bar</span>
                    </div>
                    <div className="onboarding-instruction-row">
                      <span className="onboarding-instruction-num">2</span>
                      <span>Set <strong>Location</strong> to <strong>Allow</strong></span>
                    </div>
                  </>
                )}
              </div>
              <button className="onboarding-btn secondary" onClick={() => window.location.reload()}>
                I've updated settings — reload
              </button>
            </div>
          ) : (
            <button
              className="onboarding-btn"
              onClick={handleLocationClick}
              disabled={locationLoading}
            >
              {locationLoading ? 'Requesting...' : 'Allow Location'}
            </button>
          )}

          <button className="onboarding-skip" onClick={() => skipStep(2)}>
            I'll do this later
          </button>
          <button className="onboarding-logout" onClick={signOut}>
            Log out
          </button>
        </div>
      </div>
    )
  }

  // Full onboarding flow for new users
  return (
    <div className="onboarding-gate">
      <div className="onboarding-card">
        <div className="onboarding-logo">Sup</div>
        <p className="onboarding-subtitle">Let's get you set up</p>

        {/* Progress dots */}
        <div className="onboarding-dots">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`onboarding-dot ${step < currentStep ? 'done' : ''} ${step === currentStep ? 'active' : ''}`}
            />
          ))}
        </div>

        <div className="onboarding-step-label">
          Step {currentStep} of 3
        </div>

        {/* Step 1: Install PWA */}
        {currentStep === 1 && (
          <div className="onboarding-step">
            <div className="onboarding-step-icon">📲</div>
            <h2 className="onboarding-step-title">Install Sup</h2>
            <p className="onboarding-step-desc">
              Sup needs to be installed as an app to send you push notifications when your squad is free.
            </p>

            {isIOS ? (
              <div className="onboarding-instructions">
                <div className="onboarding-instruction-row">
                  <span className="onboarding-instruction-num">1</span>
                  <span>Tap the <strong>Share</strong> button <span className="onboarding-share-icon">⬆</span> at the bottom of Safari</span>
                </div>
                <div className="onboarding-instruction-row">
                  <span className="onboarding-instruction-num">2</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
                </div>
                <div className="onboarding-instruction-row">
                  <span className="onboarding-instruction-num">3</span>
                  <span>Tap <strong>Add</strong>, then open Sup from your home screen</span>
                </div>
              </div>
            ) : deferredPrompt ? (
              <button className="onboarding-btn" onClick={handleInstallClick}>
                Install Sup
              </button>
            ) : (
              <div className="onboarding-instructions">
                <div className="onboarding-instruction-row">
                  <span className="onboarding-instruction-num">1</span>
                  <span>Tap the <strong>menu</strong> (⋮) in your browser</span>
                </div>
                <div className="onboarding-instruction-row">
                  <span className="onboarding-instruction-num">2</span>
                  <span>Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong></span>
                </div>
                <div className="onboarding-instruction-row">
                  <span className="onboarding-instruction-num">3</span>
                  <span>Open Sup from your home screen</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Location */}
        {currentStep === 2 && (
          <div className="onboarding-step">
            <div className="onboarding-step-icon">📍</div>
            <h2 className="onboarding-step-title">Enable Location</h2>
            <p className="onboarding-step-desc">
              Sup uses your location to suggest meetup spots between you and your squad. Your location is only used while the app is open and is never stored permanently.
            </p>

            {locationDenied ? (
              <div className="onboarding-denied">
                <p className="onboarding-denied-text">
                  Location access was denied. To fix this:
                </p>
                <div className="onboarding-instructions">
                  {isIOS ? (
                    <>
                      <div className="onboarding-instruction-row">
                        <span className="onboarding-instruction-num">1</span>
                        <span>Open <strong>Settings</strong> → <strong>Sup</strong></span>
                      </div>
                      <div className="onboarding-instruction-row">
                        <span className="onboarding-instruction-num">2</span>
                        <span>Tap <strong>Location</strong> → <strong>While Using the App</strong></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="onboarding-instruction-row">
                        <span className="onboarding-instruction-num">1</span>
                        <span>Tap the <strong>lock icon</strong> in the address bar</span>
                      </div>
                      <div className="onboarding-instruction-row">
                        <span className="onboarding-instruction-num">2</span>
                        <span>Set <strong>Location</strong> to <strong>Allow</strong></span>
                      </div>
                    </>
                  )}
                </div>
                <button className="onboarding-btn secondary" onClick={() => window.location.reload()}>
                  I've updated settings — reload
                </button>
              </div>
            ) : (
              <button
                className="onboarding-btn"
                onClick={handleLocationClick}
                disabled={locationLoading}
              >
                {locationLoading ? 'Requesting...' : 'Allow Location'}
              </button>
            )}
            <button className="onboarding-skip" onClick={() => skipStep(2)}>
              I'll do this later
            </button>
          </div>
        )}

        {/* Step 3: Notifications */}
        {currentStep === 3 && (
          <div className="onboarding-step">
            <div className="onboarding-step-icon">🔔</div>
            <h2 className="onboarding-step-title">Enable Notifications</h2>
            <p className="onboarding-step-desc">
              Get notified instantly when someone in your squad is free to hang.
            </p>

            {notifDenied ? (
              <div className="onboarding-denied">
                <p className="onboarding-denied-text">
                  Notifications were denied. To fix this:
                </p>
                <div className="onboarding-instructions">
                  {isIOS ? (
                    <>
                      <div className="onboarding-instruction-row">
                        <span className="onboarding-instruction-num">1</span>
                        <span>Open <strong>Settings</strong> → <strong>Sup</strong></span>
                      </div>
                      <div className="onboarding-instruction-row">
                        <span className="onboarding-instruction-num">2</span>
                        <span>Tap <strong>Notifications</strong> → turn on <strong>Allow Notifications</strong></span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="onboarding-instruction-row">
                        <span className="onboarding-instruction-num">1</span>
                        <span>Tap the <strong>lock icon</strong> in the address bar</span>
                      </div>
                      <div className="onboarding-instruction-row">
                        <span className="onboarding-instruction-num">2</span>
                        <span>Set <strong>Notifications</strong> to <strong>Allow</strong></span>
                      </div>
                    </>
                  )}
                </div>
                <button className="onboarding-btn secondary" onClick={() => window.location.reload()}>
                  I've updated settings — reload
                </button>
              </div>
            ) : (
              <button
                className="onboarding-btn"
                onClick={handleNotificationClick}
                disabled={notifLoading || push.loading}
              >
                {notifLoading || push.loading ? 'Requesting...' : 'Allow Notifications'}
              </button>
            )}
            <button className="onboarding-skip" onClick={() => skipStep(3)}>
              I'll do this later
            </button>
          </div>
        )}

        <button className="onboarding-logout" onClick={signOut}>
          Log out
        </button>
      </div>
    </div>
  )
}

export default OnboardingGate

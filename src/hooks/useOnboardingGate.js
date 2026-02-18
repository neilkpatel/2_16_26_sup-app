import { useState, useEffect, useCallback } from 'react'

/**
 * Hook that checks PWA install, location permission, and notification permission.
 * Always checks live browser state — no localStorage caching.
 * Returns current step (1-3) or 0 when all requirements met.
 */
export function useOnboardingGate() {
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
      || navigator.standalone === true
  })

  const [locationPermission, setLocationPermission] = useState('prompt')
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof Notification !== 'undefined') return Notification.permission
    return 'default'
  })

  const [deferredPrompt, setDeferredPrompt] = useState(null)

  // Listen for display-mode changes (user installs PWA while gate is showing)
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const handler = (e) => setIsInstalled(e.matches || navigator.standalone === true)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Check location permission via Permissions API (with iOS fallback)
  useEffect(() => {
    if (!navigator.permissions) {
      // iOS Safari doesn't support Permissions API — default to 'prompt'
      setLocationPermission('prompt')
      return
    }

    let permStatus
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      permStatus = status
      setLocationPermission(status.state)
      status.addEventListener('change', () => {
        setLocationPermission(status.state)
      })
    }).catch(() => {
      setLocationPermission('prompt')
    })

    return () => {
      if (permStatus) {
        permStatus.removeEventListener('change', () => {})
      }
    }
  }, [])

  // Poll notification permission (no change event available)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof Notification !== 'undefined') {
        setNotificationPermission(Notification.permission)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Capture beforeinstallprompt for Android/Chrome
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const requestLocation = useCallback(() => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationPermission('granted')
          resolve('granted')
        },
        (err) => {
          // Permission denied
          if (err.code === 1) {
            setLocationPermission('denied')
            resolve('denied')
          } else {
            // Other error (timeout, position unavailable) — permission may still be granted
            setLocationPermission('granted')
            resolve('granted')
          }
        },
        { timeout: 10000 }
      )
    })
  }, [])

  const requestNotification = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied'
    const result = await Notification.requestPermission()
    setNotificationPermission(result)
    return result
  }, [])

  const triggerInstallPrompt = useCallback(async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') {
      setIsInstalled(true)
      return true
    }
    return false
  }, [deferredPrompt])

  // Determine current step: 1 = install, 2 = location, 3 = notifications, 0 = done
  let currentStep = 0
  if (!isInstalled) {
    currentStep = 1
  } else if (locationPermission !== 'granted') {
    currentStep = 2
  } else if (notificationPermission !== 'granted') {
    currentStep = 3
  }

  return {
    isInstalled,
    locationPermission,
    notificationPermission,
    currentStep,
    deferredPrompt,
    requestLocation,
    requestNotification,
    triggerInstallPrompt
  }
}

export default useOnboardingGate

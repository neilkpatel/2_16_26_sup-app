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

  const [locationPermission, setLocationPermission] = useState(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('location_granted') === 'true') {
      return 'granted'
    }
    return 'prompt'
  })
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

  // Check location permission via Permissions API, with iOS fallback
  useEffect(() => {
    if (navigator.permissions) {
      let permStatus
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        permStatus = status
        setLocationPermission(status.state)
        if (status.state === 'granted') localStorage.setItem('location_granted', 'true')
        status.addEventListener('change', () => {
          setLocationPermission(status.state)
          if (status.state === 'granted') localStorage.setItem('location_granted', 'true')
          if (status.state === 'denied') localStorage.removeItem('location_granted')
        })
      }).catch(() => {
        // Permissions API failed — try silent geolocation probe
        probeLocation()
      })
      return () => {
        if (permStatus) {
          permStatus.removeEventListener('change', () => {})
        }
      }
    } else {
      // iOS Safari: no Permissions API — silently try to get position
      probeLocation()
    }

    function probeLocation() {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationPermission('granted')
          localStorage.setItem('location_granted', 'true')
        },
        (err) => {
          if (err.code === 1) {
            setLocationPermission('denied')
            localStorage.removeItem('location_granted')
          }
          // Timeout/unavailable — don't block, assume prompt
        },
        { timeout: 3000 }
      )
    }
  }, [])

  // Poll notification permission (no change event available)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof Notification !== 'undefined') {
        setNotificationPermission(Notification.permission)
      }
    }, 3000)
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
          localStorage.setItem('location_granted', 'true')
          resolve('granted')
        },
        (err) => {
          if (err.code === 1) {
            setLocationPermission('denied')
            localStorage.removeItem('location_granted')
            resolve('denied')
          } else {
            setLocationPermission('granted')
            localStorage.setItem('location_granted', 'true')
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

  // Track skipped steps
  const [skippedSteps, setSkippedSteps] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sup_skipped_steps') || '[]')
    } catch { return [] }
  })

  const skipStep = useCallback((step) => {
    setSkippedSteps(prev => {
      const next = [...prev, step]
      localStorage.setItem('sup_skipped_steps', JSON.stringify(next))
      return next
    })
  }, [])

  // Determine current step: 1 = install, 2 = location, 3 = notifications, 0 = done
  let currentStep = 0
  if (!isInstalled && !skippedSteps.includes(1)) {
    currentStep = 1
  } else if (locationPermission !== 'granted' && !skippedSteps.includes(2)) {
    currentStep = 2
  } else if (notificationPermission !== 'granted' && !skippedSteps.includes(3)) {
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
    triggerInstallPrompt,
    skipStep
  }
}

export default useOnboardingGate

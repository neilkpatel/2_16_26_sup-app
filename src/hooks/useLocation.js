import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for managing browser geolocation
 * @param {Object} options - Geolocation options
 * @returns {Object} Location state and controls
 */
export function useLocation(options = {}) {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [watching, setWatching] = useState(false)
  const [watchId, setWatchId] = useState(null)

  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000, // Cache for 1 minute
    ...options
  }

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return Promise.reject(new Error('Geolocation not supported'))
    }

    setLoading(true)
    setError(null)

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          }
          setLocation(loc)
          setLoading(false)
          resolve(loc)
        },
        (err) => {
          const errorMessage = getErrorMessage(err)
          setError(errorMessage)
          setLoading(false)
          reject(new Error(errorMessage))
        },
        defaultOptions
      )
    })
  }, [])

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    if (watchId) {
      return // Already watching
    }

    setLoading(true)
    setError(null)

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        })
        setLoading(false)
        setWatching(true)
      },
      (err) => {
        setError(getErrorMessage(err))
        setLoading(false)
      },
      defaultOptions
    )

    setWatchId(id)
  }, [watchId])

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
      setWatching(false)
    }
  }, [watchId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  return {
    location,
    error,
    loading,
    watching,
    getCurrentLocation,
    startWatching,
    stopWatching
  }
}

function getErrorMessage(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Please enable location access.'
    case error.POSITION_UNAVAILABLE:
      return 'Location information unavailable.'
    case error.TIMEOUT:
      return 'Location request timed out.'
    default:
      return 'An unknown error occurred.'
  }
}

export default useLocation

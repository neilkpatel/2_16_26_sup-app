import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/**
 * Convert base64url VAPID key to Uint8Array for PushManager
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Hook for managing web push notification subscription
 * @param {string} userId - Current user's ID
 */
export function usePushNotifications(userId) {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState('default')
  const [loading, setLoading] = useState(false)

  // Check support and existing subscription on mount
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
    setIsSupported(supported)

    if (!supported || !userId) return

    setPermission(Notification.permission)

    // Check if we already have a subscription saved
    async function checkSubscription() {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          // Verify it's saved in our DB
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', userId)
            .limit(1)

          setIsSubscribed(data && data.length > 0)
        }
      } catch {
        // Silent fail — push just won't work
      }
    }

    checkSubscription()
  }, [userId])

  const subscribe = useCallback(async () => {
    if (!isSupported || !userId) return false

    setLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== 'granted') {
        return false
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })

      // Save to Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          subscription: subscription.toJSON()
        }, {
          onConflict: 'user_id,subscription'
        })

      if (error) throw error

      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('Push subscription failed:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [isSupported, userId])

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    loading
  }
}

export default usePushNotifications

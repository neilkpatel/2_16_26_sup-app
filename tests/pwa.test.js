import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf-8')

describe('PWA Setup', () => {
  it('manifest.json is valid', () => {
    const content = JSON.parse(read('public/manifest.json'))
    expect(content.short_name).toBe('Sup')
    expect(content.display).toBe('standalone')
    expect(content.start_url).toBe('/')
    expect(content.icons).toHaveLength(2)
    expect(content.icons[0].sizes).toBe('192x192')
    expect(content.icons[1].sizes).toBe('512x512')
  })

  it('icon-192.png exists', () => {
    expect(existsSync(resolve(process.cwd(), 'public/icon-192.png'))).toBe(true)
  })

  it('icon-512.png exists', () => {
    expect(existsSync(resolve(process.cwd(), 'public/icon-512.png'))).toBe(true)
  })

  it('index.html has PWA meta tags', () => {
    const content = read('index.html')
    expect(content).toContain('rel="manifest"')
    expect(content).toContain('name="theme-color"')
    expect(content).toContain('name="apple-mobile-web-app-capable"')
    expect(content).toContain('rel="apple-touch-icon"')
  })

  it('sw.js has push and notificationclick handlers', () => {
    const content = read('public/sw.js')
    expect(content).toContain("self.addEventListener('push'")
    expect(content).toContain("self.addEventListener('notificationclick'")
    expect(content).toContain('showNotification')
    expect(content).toContain('clients.openWindow')
  })

  it('main.jsx registers service worker', () => {
    const content = read('src/main.jsx')
    expect(content).toContain("navigator.serviceWorker.register('/sw.js')")
  })
})

describe('Push Notifications', () => {
  it('usePushNotifications hook exists with correct exports', () => {
    const content = read('src/hooks/usePushNotifications.js')
    expect(content).toContain('isSupported')
    expect(content).toContain('isSubscribed')
    expect(content).toContain('permission')
    expect(content).toContain('subscribe')
    expect(content).toContain('VITE_VAPID_PUBLIC_KEY')
    expect(content).toContain('push_subscriptions')
  })

  it('Home.jsx integrates push notifications', () => {
    const content = read('src/pages/Home.jsx')
    expect(content).toContain('usePushNotifications')
    expect(content).toContain('send-push')
    expect(content).toContain('notification-banner')
    expect(content).toContain('InstallPrompt')
  })
})

describe('Database Schema', () => {
  it('includes push_subscriptions table with RLS', () => {
    const content = read('supabase/schema.sql')
    expect(content).toContain('push_subscriptions')
    expect(content).toContain('subscription jsonb')
    expect(content).toContain('unique_user_subscription')
    expect(content).toContain('push_sub_select')
    expect(content).toContain('push_sub_insert')
    expect(content).toContain('push_sub_delete')
  })
})

describe('Edge Function', () => {
  it('send-push has correct structure', () => {
    const content = read('supabase/functions/send-push/index.ts')
    expect(content).toContain('Access-Control-Allow-Origin')
    expect(content).toContain('userId')
    expect(content).toContain('.from("users")')
    expect(content).toContain('.from("friendships")')
    expect(content).toContain('.from("push_subscriptions")')
    expect(content).toContain('sendNotification')
    expect(content).toContain('410')
  })
})

# Sup App

## What It Is
A "who's free to hang" app. You tap **Sup**, your entire **squad** gets a push notification instantly. They tap it, open the app, Sup back, and the app shows where to meet — midpoint between everyone + bar suggestions.

## Core Concept
- **One tap to broadcast** — press Sup, all squad members notified automatically
- **One tap to respond** — tap the notification, open the app, tap Sup back
- **Zero friction** — no typing, no picking recipients, no manual sharing

## Key Terminology
- **Squad** (not "friends") — your group of people who get notified when you go Sup
- **Sup** — the act of broadcasting that you're free to hang
- **Sup back** — responding to someone's Sup by also going Sup

## Architecture
- **Frontend:** React 19 + Vite + React Router 7
- **Backend:** Supabase (auth, Postgres with PostGIS, Realtime)
- **Maps:** Leaflet / React-Leaflet
- **Places:** Google Places API (with mock fallback)
- **Notifications:** Web Push via PWA + Supabase Edge Function
- **Platform:** PWA (Progressive Web App) — native iOS app is a future version

## Squad / Adding People
- **Link-only adding** — you can only join someone's squad via their unique link (`sup.app/add/username`)
- **No username search** — the link IS the consent
- **Mutual** — when someone clicks your link, both of you are in each other's squads
- **No approval step** — clicking the link is the approval

## Supabase Tables
- `users` — id, username, phone
- `friendships` — id, user_id, friend_id, created_at (bidirectional)
- `sup_sessions` — id, user_id, location (PostGIS POINT), started_at, expires_at (2hr duration)
- `push_subscriptions` — id, user_id, subscription (jsonb), created_at

## Design System
- Primary gradient: `#667eea` → `#764ba2` (purple-indigo)
- Active/success: `#22c55e` (green)
- Danger: `#ef4444` (red)
- System fonts, border-radius 1rem for cards, mobile breakpoints at 640px and 400px

## Current State (as of Jan 2025)
- MVP frontend is complete — auth, map, friends list, Sup button, bar suggestions
- Single git commit: "Initial commit: Sup app MVP"
- No .env file — Supabase and Google Places API keys not configured yet
- No tests written (vitest is set up)

## In Progress
- Renaming "Friends" → "Squad" throughout the app
- Adding PWA support (manifest.json, service worker)
- Adding web push notifications (usePushNotifications hook, Supabase Edge Function)
- Removing "add by username" — making link-only the sole add mechanism
- Adding iOS "Add to Home Screen" install prompt

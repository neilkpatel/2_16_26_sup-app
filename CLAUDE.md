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
- **Frontend:** React 19 + Vite 7 + React Router 7
- **Backend:** Supabase (auth, Postgres with PostGIS, Realtime)
- **Maps:** Leaflet / React-Leaflet
- **Places:** Google Places API via Supabase Edge Function (CORS proxy)
- **Notifications:** Web Push via PWA + Supabase Edge Function
- **Hosting:** Vercel (auto-deploys from GitHub)
- **Platform:** PWA — native iOS app is a future version

## Squad / Adding People
- **Link-only adding** — you can only join someone's squad via their unique link (`/add/username`)
- **No username search** — the link IS the consent
- **Mutual** — when someone clicks your link, both of you are in each other's squads
- **No approval step** — clicking the link is the approval

## Backend (moved 9/15/26 — read this before touching the database)
Sup runs in the **shared** Supabase project `hufgsqlyaolefwhtvbub` (named "worldcup-picks"),
which also backs SHRED, tab-split, agentpays, concert radar and july4 plans. The original
sup-app project (`zksbfcbezexsqrxwjjgt`) is paused behind the free tier's 2-active-project cap
and is not coming back; treat it as gone.

Sup's tables live in their own **`sup` schema**, so nothing can collide with the other apps:
- The client sets `db: { schema: 'sup' }` (`src/lib/supabase.js`), realtime subscriptions pass
  `schema: 'sup'`, and the one raw REST call (`src/pages/AddFriend.jsx`) sends `Accept-Profile: sup`.
- Edge functions are prefixed: `sup-send-push`, `sup-nearby-places`.
- **Never drop, delete or alter anything outside the `sup` schema**, and never
  `delete from auth.users` — auth is project-wide.
- `scripts/move-to-shared-project.sh` re-applies the whole backend setup and is safe to re-run.
  `node scripts/smoke.mjs` runs 26 live checks (signup → squad → Sup → realtime → push →
  places) using throwaway users; the script deletes them afterwards.
- Credentials live outside this public repo: `~/.config/supabase/access_token`,
  `~/.config/sup-app/vapid.json`, `~/.config/whatagentsbuy/vercel_token`.
- Realtime sleeps while the project is idle and needs a few seconds to start listening after a
  cold start. The hooks poll every 5s as a fallback, so a missed event self-corrects.

## Supabase Tables
All in the `sup` schema:
- `users` — id, username, phone, sup_duration (default 15 min)
- `friendships` — id, user_id, friend_id, created_at (bidirectional)
- `sup_sessions` — id, user_id, location (PostGIS POINT), started_at, expires_at (2hr duration)
- `push_subscriptions` — id, user_id, subscription (jsonb), created_at
- `notifications` — id, user_id (recipient), from_user_id, message, created_at (written by the push function, read by History + RecentActivity)

## Edge Functions
- `sup-send-push` — sends web push to all squad members when someone goes Sup
- `sup-nearby-places` — proxies Google Places API, filters to 4.2+ star bars

**Known issue:** `sup-send-push` runs without JWT verification and trusts the `userId` in the
request body, so anyone who knows the URL can push to any squad. Worth fixing before real
friends use it.

## Design System
- Primary gradient: `#667eea` → `#764ba2` (purple-indigo)
- Active/success: `#22c55e` (green)
- Danger: `#ef4444` (red)
- System fonts, border-radius 1rem for cards, mobile breakpoints at 640px and 400px

## Current State
- All features implemented: auth, squad (link-only), Sup button, map, push notifications, bar suggestions, PWA
- 104 tests passing (vitest); 7 fail and were already failing before 9/15/26 — they assert an
  older reactions UI that commit cf41c54 replaced with the single "Not now" button
- Deployed to Vercel: https://sup-app-jet.vercel.app
- GitHub: https://github.com/neilkpatel/2_16_26_sup-app (public as of 9/15/26)
- **9/15/26: backend moved to the shared project and verified live end to end. Accounts start
  fresh — the old `neilkpatel` / `test` users were in the paused project.**
- Phone testing phase — never finished. Next real step is two iPhones: install to home screen
  (iOS only delivers push to an installed PWA), allow notifications and location, then Sup.

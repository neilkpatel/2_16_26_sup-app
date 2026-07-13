# Sup

A "who's free to hang" progressive web app. Broadcast to your squad in one tap, see everyone on a live map, and get a fair meeting spot plus bar suggestions near the group.

**Live demo:** https://sup-app-jet.vercel.app

## What it does

- One-tap broadcasting to your squad with web push notifications
- Real-time map that updates over WebSockets, with a polling fallback for reliability
- Calculates the geographic midpoint between all active users and suggests bars nearby
- PostGIS-backed location queries for distance and geometry
- Row-level security so users only ever see their own squad's data

## Built with

React, Supabase, PostGIS, Web Push, PWA, Leaflet

---

Built by [Neil Patel](https://neilkpatel.com). More projects at [neilkpatel.com](https://neilkpatel.com).

-- ========================================
-- SUP APP - Complete Database Schema
-- ========================================
-- Since 9/15/26 Sup lives in its own `sup` schema inside the SHARED Supabase
-- project hufgsqlyaolefwhtvbub (named "worldcup-picks"), which also backs
-- SHRED, tab-split, agentpays, concert radar and july4 plans. The original
-- sup-app project (zksbfcbezexsqrxwjjgt) is paused behind the free-tier
-- 2-active-project cap.
--
-- Rules for this file, because the project is shared:
--   * Never drop or delete anything outside the `sup` schema.
--   * Never `delete from auth.users` — auth is project-wide.
--   * The `sup` schema must stay listed in PostgREST's exposed schemas
--     (Management API: PATCH /v1/projects/{ref}/postgrest db_schema).
-- Apply via the Management API database/query endpoint or the SQL Editor.

create extension if not exists postgis with schema extensions;

create schema if not exists sup;
grant usage on schema sup to anon, authenticated, service_role;

-- ========================================
-- CREATE TABLES
-- ========================================

create table sup.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  username text unique not null,
  sup_duration integer not null default 15,
  created_at timestamp with time zone default now() not null,
  constraint username_length check (char_length(username) >= 3),
  constraint username_format check (username ~ '^[a-z0-9_]+$')
);

create table sup.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references sup.users(id) on delete cascade not null,
  friend_id uuid references sup.users(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  constraint no_self_friendship check (user_id != friend_id),
  constraint unique_friendship unique (user_id, friend_id)
);

create table sup.sup_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references sup.users(id) on delete cascade not null,
  location extensions.geography(point, 4326),
  started_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  destination_name text,
  destination_location extensions.geography(point, 4326)
);

create table sup.sup_reactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sup.sup_sessions(id) on delete cascade not null,
  user_id uuid references sup.users(id) on delete cascade not null,
  reaction text not null check (reaction in ('im_in', 'cant_tonight', 'maybe_later')),
  created_at timestamptz default now() not null,
  constraint unique_reaction unique (session_id, user_id)
);

create table sup.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references sup.users(id) on delete cascade not null,
  subscription jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint unique_user_subscription unique (user_id, subscription)
);

-- Written by the sup-send-push edge function (service role), read on History + RecentActivity
create table sup.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references sup.users(id) on delete cascade not null,
  from_user_id uuid references sup.users(id) on delete cascade,
  message text not null,
  created_at timestamp with time zone default now() not null
);

create index friendships_friend_id_idx on sup.friendships (friend_id);
create index sup_sessions_user_expires_idx on sup.sup_sessions (user_id, expires_at);
create index sup_reactions_session_idx on sup.sup_reactions (session_id);
create index notifications_user_created_idx on sup.notifications (user_id, created_at desc);

-- ========================================
-- GRANT PERMISSIONS (required for access)
-- ========================================

-- Logged-out visitors only need to look up a username on /add/:username
grant select on sup.users to anon;
grant select, insert, update, delete on all tables in schema sup to authenticated;
grant all on all tables in schema sup to service_role;

-- ========================================
-- ENABLE RLS
-- ========================================

alter table sup.users enable row level security;
alter table sup.friendships enable row level security;
alter table sup.sup_sessions enable row level security;
alter table sup.sup_reactions enable row level security;
alter table sup.push_subscriptions enable row level security;
alter table sup.notifications enable row level security;

-- ========================================
-- RLS POLICIES
-- ========================================

-- Users: anyone can read, you can only create or edit your own row
create policy "users_select" on sup.users for select using (true);
create policy "users_insert" on sup.users for insert with check (auth.uid() = id);
create policy "users_update" on sup.users for update using (auth.uid() = id);

-- Friendships: only authenticated users, can see/manage own
create policy "friendships_select" on sup.friendships for select using (auth.uid() in (user_id, friend_id));
create policy "friendships_insert" on sup.friendships for insert with check (auth.uid() = user_id);
create policy "friendships_delete" on sup.friendships for delete using (auth.uid() in (user_id, friend_id));

-- Sup sessions: owner can manage, friends can view
create policy "sessions_select_own" on sup.sup_sessions for select using (auth.uid() = user_id);
create policy "sessions_select_friends" on sup.sup_sessions for select using (
  exists (select 1 from sup.friendships f where auth.uid() in (f.user_id, f.friend_id) and sup_sessions.user_id in (f.user_id, f.friend_id))
);
create policy "sessions_insert" on sup.sup_sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update" on sup.sup_sessions for update using (auth.uid() = user_id);
create policy "sessions_delete" on sup.sup_sessions for delete using (auth.uid() = user_id);

-- Sup reactions: squad members can see/manage reactions on sessions they can see
create policy "reactions_select" on sup.sup_reactions for select using (
  exists (
    select 1 from sup.sup_sessions s
    where s.id = sup_reactions.session_id
    and (
      s.user_id = auth.uid()
      or exists (
        select 1 from sup.friendships f
        where auth.uid() in (f.user_id, f.friend_id)
        and s.user_id in (f.user_id, f.friend_id)
      )
    )
  )
);
create policy "reactions_insert" on sup.sup_reactions for insert with check (auth.uid() = user_id);
create policy "reactions_update" on sup.sup_reactions for update using (auth.uid() = user_id);
create policy "reactions_delete" on sup.sup_reactions for delete using (auth.uid() = user_id);

-- Push subscriptions: owner can manage own
create policy "push_sub_select" on sup.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_sub_insert" on sup.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_sub_update" on sup.push_subscriptions for update using (auth.uid() = user_id);
create policy "push_sub_delete" on sup.push_subscriptions for delete using (auth.uid() = user_id);

-- Notifications: you can read your own; only the edge function (service role) writes
create policy "notifications_select_own" on sup.notifications for select using (auth.uid() = user_id);

-- ========================================
-- ENABLE REALTIME
-- ========================================

alter publication supabase_realtime add table sup.friendships;
alter publication supabase_realtime add table sup.sup_sessions;
alter publication supabase_realtime add table sup.sup_reactions;

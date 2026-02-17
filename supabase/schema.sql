-- ========================================
-- SUP APP - Complete Database Schema
-- Run this in Supabase SQL Editor
-- ========================================

-- Drop existing tables (cascade drops policies too)
drop table if exists public.sup_sessions cascade;
drop table if exists public.friendships cascade;
drop table if exists public.users cascade;

-- Delete any orphaned auth users
delete from auth.users;

-- ========================================
-- CREATE TABLES
-- ========================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  username text unique not null,
  created_at timestamp with time zone default now() not null,
  constraint username_length check (char_length(username) >= 3),
  constraint username_format check (username ~ '^[a-z0-9_]+$')
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  friend_id uuid references public.users(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  constraint no_self_friendship check (user_id != friend_id),
  constraint unique_friendship unique (user_id, friend_id)
);

create table public.sup_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  location geography(point, 4326),
  started_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  destination_name text,
  destination_location geography(point, 4326)
);

create table public.sup_reactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sup_sessions(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  reaction text not null check (reaction in ('im_in', 'cant_tonight', 'maybe_later')),
  created_at timestamptz default now() not null,
  constraint unique_reaction unique (session_id, user_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  subscription jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint unique_user_subscription unique (user_id, subscription)
);

-- ========================================
-- GRANT PERMISSIONS (required for access)
-- ========================================

grant usage on schema public to anon, authenticated;
grant all on public.users to anon, authenticated;
grant all on public.friendships to authenticated;
grant all on public.sup_sessions to authenticated;
grant all on public.sup_reactions to authenticated;
grant all on public.push_subscriptions to authenticated;

-- ========================================
-- ENABLE RLS
-- ========================================

alter table public.users enable row level security;
alter table public.friendships enable row level security;
alter table public.sup_sessions enable row level security;
alter table public.sup_reactions enable row level security;
alter table public.push_subscriptions enable row level security;

-- ========================================
-- RLS POLICIES
-- ========================================

-- Users: anyone can read, anyone can insert (for signup), owner can update
create policy "users_select" on public.users for select using (true);
create policy "users_insert" on public.users for insert with check (true);
create policy "users_update" on public.users for update using (auth.uid() = id);

-- Friendships: only authenticated users, can see/manage own
create policy "friendships_select" on public.friendships for select using (auth.uid() in (user_id, friend_id));
create policy "friendships_insert" on public.friendships for insert with check (auth.uid() = user_id);
create policy "friendships_delete" on public.friendships for delete using (auth.uid() in (user_id, friend_id));

-- Sup sessions: owner can manage, friends can view
create policy "sessions_select_own" on public.sup_sessions for select using (auth.uid() = user_id);
create policy "sessions_select_friends" on public.sup_sessions for select using (
  exists (select 1 from public.friendships f where auth.uid() in (f.user_id, f.friend_id) and sup_sessions.user_id in (f.user_id, f.friend_id))
);
create policy "sessions_insert" on public.sup_sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update" on public.sup_sessions for update using (auth.uid() = user_id);
create policy "sessions_delete" on public.sup_sessions for delete using (auth.uid() = user_id);

-- Sup reactions: squad members can see/manage reactions on sessions they can see
create policy "reactions_select" on public.sup_reactions for select using (
  exists (
    select 1 from public.sup_sessions s
    where s.id = sup_reactions.session_id
    and (
      s.user_id = auth.uid()
      or exists (
        select 1 from public.friendships f
        where auth.uid() in (f.user_id, f.friend_id)
        and s.user_id in (f.user_id, f.friend_id)
      )
    )
  )
);
create policy "reactions_insert" on public.sup_reactions for insert with check (auth.uid() = user_id);
create policy "reactions_update" on public.sup_reactions for update using (auth.uid() = user_id);
create policy "reactions_delete" on public.sup_reactions for delete using (auth.uid() = user_id);

-- Push subscriptions: owner can manage own
create policy "push_sub_select" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_sub_insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_sub_delete" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- ========================================
-- ENABLE REALTIME
-- ========================================

alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.sup_sessions;
alter publication supabase_realtime add table public.sup_reactions;

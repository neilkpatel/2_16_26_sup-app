-- Sup App Database Schema
-- Run this in Supabase SQL Editor

-- Enable PostGIS for location support (if not already enabled)
create extension if not exists postgis;

-- Users table
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  username text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint username_length check (char_length(username) >= 3),
  constraint username_format check (username ~ '^[a-z0-9_]+$')
);

-- Friendships table (bidirectional)
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  friend_id uuid references public.users(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Prevent self-friendships
  constraint no_self_friendship check (user_id != friend_id),
  -- Prevent duplicate friendships (in either direction)
  constraint unique_friendship unique (user_id, friend_id)
);

-- Active "Sup" sessions table
create table if not exists public.sup_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  location geography(point, 4326),
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,

  constraint valid_expiry check (expires_at > started_at)
);

-- Indexes for better query performance
create index if not exists idx_friendships_user_id on public.friendships(user_id);
create index if not exists idx_friendships_friend_id on public.friendships(friend_id);
create index if not exists idx_sup_sessions_user_id on public.sup_sessions(user_id);
create index if not exists idx_sup_sessions_expires_at on public.sup_sessions(expires_at);
create index if not exists idx_users_username on public.users(username);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.friendships enable row level security;
alter table public.sup_sessions enable row level security;

-- Users policies
create policy "Users can view their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can view other users by username"
  on public.users for select
  using (true);

create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- Friendships policies
create policy "Users can view their friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can create friendships"
  on public.friendships for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their friendships"
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Sup sessions policies
create policy "Users can view their own sessions"
  on public.sup_sessions for select
  using (auth.uid() = user_id);

create policy "Users can view friends' active sessions"
  on public.sup_sessions for select
  using (
    exists (
      select 1 from public.friendships
      where (user_id = auth.uid() and friend_id = sup_sessions.user_id)
         or (friend_id = auth.uid() and user_id = sup_sessions.user_id)
    )
  );

create policy "Users can create their own sessions"
  on public.sup_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sessions"
  on public.sup_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own sessions"
  on public.sup_sessions for delete
  using (auth.uid() = user_id);

-- Enable realtime for tables
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.sup_sessions;

-- Function to clean up expired sessions (can be called by a cron job)
create or replace function public.cleanup_expired_sessions()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.sup_sessions
  where expires_at < now();
end;
$$;

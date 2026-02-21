-- =============================================
-- ArbiLoop Database Schema & Migrations
-- =============================================
-- This file contains the complete database setup for ArbiLoop.
-- Run this in the Supabase SQL Editor.

-- 1. Create Users Table
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  chat_id bigint not null unique,
  username text,
  wallet_address text not null,
  alert_threshold numeric default 1.1,
  polling_interval integer default 60, -- Minutes: 60, 120, 360, 720, 960, 1440
  last_checked timestamp with time zone default timezone('utc'::text, now()),
  alerts_enabled boolean default true,
  last_alert_sent timestamp with time zone,
  daily_updates_enabled boolean default true,
  last_daily_report_sent timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Constraints
  constraint wallet_address_check check (length(wallet_address) = 42),
  constraint polling_interval_check check (polling_interval in (60, 120, 360, 720, 960, 1440))
);

-- 2. Create Indexes
create index if not exists idx_users_wallet on public.users(wallet_address);
create unique index if not exists idx_users_wallet_unique on public.users(wallet_address);
create index if not exists idx_users_chat_id on public.users(chat_id);
create index if not exists idx_users_alerts_enabled on public.users(alerts_enabled) where alerts_enabled = true;

-- 3. Enable Row Level Security (RLS)
alter table public.users enable row level security;

-- 4. Create Policies
-- Clean up old broad policy if present
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'Service role full access'
  ) then
    drop policy "Service role full access" on public.users;
  end if;
end $$;

-- Frontend can read settings via anon/authenticated roles
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'Read users'
  ) then
    create policy "Read users" on public.users
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- Bot backend writes via service-role key
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'Service role write users'
  ) then
    create policy "Service role write users" on public.users
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- 5. Comments for Documentation
comment on column public.users.daily_updates_enabled is 'User preference for receiving proactive daily portfolio briefings';
comment on column public.users.last_daily_report_sent is 'Timestamp of the last successfully sent daily briefing';
comment on column public.users.last_alert_sent is 'Timestamp of the last sent liquidation risk alert (for cooldown tracking)';

-- =============================================
-- Migration Support (Incremental Updates)
-- =============================================
-- If you already have the users table, run these individually as needed:

-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_alert_sent timestamp with time zone;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_updates_enabled boolean default true;
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_daily_report_sent timestamp with time zone;
-- CREATE INDEX IF NOT EXISTS idx_users_alerts_enabled ON public.users(alerts_enabled) WHERE alerts_enabled = true;

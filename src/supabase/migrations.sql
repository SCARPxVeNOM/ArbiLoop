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

-- =============================================
-- On-chain Historical PnL Indexer Schema
-- =============================================
-- These tables store indexed Aave/Radiant logs for full-chain realized PnL tracking.

create table if not exists public.wallet_activity_events (
  id bigserial primary key,
  chain_id integer not null,
  protocol text not null,
  wallet_address text not null,
  action text not null,
  asset_address text not null,
  asset_symbol text,
  amount_raw numeric not null,
  amount_token numeric,
  amount_usd numeric,
  realized_pnl_usd numeric not null default 0,
  tx_hash text not null,
  log_index integer not null,
  block_number bigint not null,
  block_time timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint wallet_activity_events_action_check check (action in ('deposit', 'withdraw', 'borrow', 'repay')),
  constraint wallet_activity_events_wallet_address_check check (length(wallet_address) = 42),
  constraint wallet_activity_events_asset_address_check check (length(asset_address) = 42),
  constraint wallet_activity_events_unique_log unique (chain_id, tx_hash, log_index)
);

create table if not exists public.wallet_pnl_positions (
  wallet_address text not null,
  chain_id integer not null,
  protocol text not null,
  asset_address text not null,
  asset_symbol text,
  principal_usd numeric not null default 0,
  realized_pnl_usd numeric not null default 0,
  total_deposit_usd numeric not null default 0,
  total_withdraw_usd numeric not null default 0,
  last_event_block bigint,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint wallet_pnl_positions_pk primary key (wallet_address, chain_id, protocol, asset_address),
  constraint wallet_pnl_positions_wallet_address_check check (length(wallet_address) = 42),
  constraint wallet_pnl_positions_asset_address_check check (length(asset_address) = 42)
);

create table if not exists public.wallet_pnl_daily (
  wallet_address text not null,
  chain_id integer not null,
  day date not null,
  realized_pnl_usd numeric not null default 0,
  cumulative_realized_pnl_usd numeric not null default 0,
  event_count integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint wallet_pnl_daily_pk primary key (wallet_address, chain_id, day),
  constraint wallet_pnl_daily_wallet_address_check check (length(wallet_address) = 42)
);

create table if not exists public.pnl_indexer_state (
  chain_id integer not null,
  protocol text not null,
  cursor_block bigint not null default 0,
  last_indexed_block bigint not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,

  constraint pnl_indexer_state_pk primary key (chain_id, protocol)
);

create index if not exists idx_wallet_activity_events_wallet_time
  on public.wallet_activity_events(wallet_address, chain_id, block_time desc);
create index if not exists idx_wallet_activity_events_wallet_block
  on public.wallet_activity_events(wallet_address, chain_id, block_number desc);
create index if not exists idx_wallet_activity_events_protocol
  on public.wallet_activity_events(protocol, chain_id, block_number desc);

create index if not exists idx_wallet_pnl_positions_wallet
  on public.wallet_pnl_positions(wallet_address, chain_id);

create index if not exists idx_wallet_pnl_daily_wallet_day
  on public.wallet_pnl_daily(wallet_address, chain_id, day desc);

alter table public.wallet_activity_events enable row level security;
alter table public.wallet_pnl_positions enable row level security;
alter table public.wallet_pnl_daily enable row level security;
alter table public.pnl_indexer_state enable row level security;

-- Frontend read access
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallet_activity_events' and policyname = 'Read wallet activity events'
  ) then
    create policy "Read wallet activity events" on public.wallet_activity_events
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallet_pnl_positions' and policyname = 'Read wallet pnl positions'
  ) then
    create policy "Read wallet pnl positions" on public.wallet_pnl_positions
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallet_pnl_daily' and policyname = 'Read wallet pnl daily'
  ) then
    create policy "Read wallet pnl daily" on public.wallet_pnl_daily
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pnl_indexer_state' and policyname = 'Read pnl indexer state'
  ) then
    create policy "Read pnl indexer state" on public.pnl_indexer_state
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- Service-role write access for indexer backend
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallet_activity_events' and policyname = 'Service role write wallet activity events'
  ) then
    create policy "Service role write wallet activity events" on public.wallet_activity_events
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallet_pnl_positions' and policyname = 'Service role write wallet pnl positions'
  ) then
    create policy "Service role write wallet pnl positions" on public.wallet_pnl_positions
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'wallet_pnl_daily' and policyname = 'Service role write wallet pnl daily'
  ) then
    create policy "Service role write wallet pnl daily" on public.wallet_pnl_daily
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pnl_indexer_state' and policyname = 'Service role write pnl indexer state'
  ) then
    create policy "Service role write pnl indexer state" on public.pnl_indexer_state
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

# ArbiLoop Telegram Bot

This service powers Telegram linking/settings and runs continuous backend workers for alerts + PnL indexing.

## Features

- `/id` - returns Telegram chat id (used for signature message)
- `/verify <signature>` - verifies wallet ownership and links to Supabase
- `/status` - shows current linked wallet + settings
- `/setalert <1.0-2.0>` - updates liquidation alert threshold
- `/setinterval <60|120|360|720|960|1440>` - updates polling frequency
- `/togglealerts` - enables/disables alerts
- `/disconnect` - removes wallet link

## Always-On Workers

When the bot is running, it also runs:

- `24/7 liquidation monitor`:
  - polls linked wallets on Aave + Radiant by each user's `polling_interval`
  - sends Telegram alerts when HF breaches user threshold
  - sends optional daily briefing (`daily_updates_enabled`)
  - stores live feed rows in `public.liquidation_alerts`

- `historical PnL indexer`:
  - runs periodically and indexes Aave/Radiant events
  - updates `wallet_activity_events`, `wallet_pnl_positions`, `wallet_pnl_daily`
  - removes need for manual `npm run indexer:pnl` runs

## How It Integrates

Frontend `Settings` signs:

`ArbiLoop Auth: <telegram_chat_id>`

The bot recovers wallet address from `/verify <signature>` and writes into `public.users`.

## Setup

1. Create bot token in BotFather.
2. Copy `.env.example` to `.env` and fill values:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ARBITRUM_RPC_URL` (recommended)
   - Optional worker tuning:
     - `MONITOR_TICK_MS`
     - `ALERT_COOLDOWN_MINUTES`
     - `DAILY_REPORT_INTERVAL_MS`
     - `ENABLE_PNL_INDEXER`
     - `PNL_INDEXER_INTERVAL_MS`
     - `NEXT_PUBLIC_TARGET_CHAIN`
     - `NEXT_PUBLIC_AAVE_POOL_ADDRESS`
     - `NEXT_PUBLIC_RADIANT_POOL_ADDRESS`
3. Install and run:

```bash
cd src/bot
npm install
npm start
```

## Notes

- Use `SUPABASE_SERVICE_ROLE_KEY` for bot writes.
- Ensure `src/supabase/migrations.sql` has been applied.
- Keep bot running continuously (PM2, Railway, Render, Fly.io, etc.).

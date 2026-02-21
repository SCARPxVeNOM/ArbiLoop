# ArbiLoop Telegram Bot

This service powers Telegram linking and settings commands used by the frontend.

## Features

- `/id` - returns Telegram chat id (used for signature message)
- `/verify <signature>` - verifies wallet ownership and links to Supabase
- `/status` - shows current linked wallet + settings
- `/setalert <1.0-2.0>` - updates liquidation alert threshold
- `/setinterval <60|120|360|720|960|1440>` - updates polling frequency
- `/togglealerts` - enables/disables alerts
- `/disconnect` - removes wallet link

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

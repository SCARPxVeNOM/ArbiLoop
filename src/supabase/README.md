# Supabase Database Setup

This folder contains SQL migrations for ArbiLoop user settings.

## Setup
1. Open your Supabase project.
2. Go to SQL Editor.
3. Run `migrations.sql`.
4. Start the bot service in `src/bot` with a service-role key.

If you already ran an older migration, run the latest `migrations.sql` again to update RLS policies.

## Stored Data
- Telegram identity (optional)
- Wallet address
- Alert threshold and polling interval
- Daily update preferences

## Security
Row Level Security is enabled and service-role access is configured for backend jobs.

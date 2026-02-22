# Supabase Database Setup

This folder contains SQL migrations for ArbiLoop user settings and historical PnL indexing.

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
- Indexed on-chain lending actions (`wallet_activity_events`)
- Realized PnL basis per asset (`wallet_pnl_positions`)
- Daily realized/cumulative PnL points (`wallet_pnl_daily`)
- Indexer cursors (`pnl_indexer_state`)

## Security
Row Level Security is enabled and service-role access is configured for backend jobs.

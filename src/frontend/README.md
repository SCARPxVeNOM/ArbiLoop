# ArbiLoop Frontend

ArbiLoop is an Arbitrum-focused frontend for monitoring and executing DeFi lending loops on:

- Aave V3
- Radiant

Key live features:
- wallet-aware liquidation alert feed (from Supabase `liquidation_alerts`)
- strategy execution for all surfaced loop cards
- realized PnL charts backed by indexed on-chain data

## Run Locally

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` from `.env.example` and set required keys.

3. Start dev server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Required Environment Variables

- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- `NEXT_PUBLIC_TARGET_CHAIN` (`arbitrum` or `arbitrum-sepolia`)
- `NEXT_PUBLIC_AAVE_POOL_ADDRESS`
- `NEXT_PUBLIC_AAVE_DATA_PROVIDER_ADDRESS`
- `NEXT_PUBLIC_AAVE_GATEWAY_ADDRESS`
- `NEXT_PUBLIC_RADIANT_POOL_ADDRESS`
- `NEXT_PUBLIC_RADIANT_GATEWAY_ADDRESS`
- `NEXT_PUBLIC_DEX_ROUTER_ADDRESS`
- `NEXT_PUBLIC_WRAPPED_NATIVE_ADDRESS`
- `NEXT_PUBLIC_LOOP_VAULT_ADDRESS`
- `NEXT_PUBLIC_TELEGRAM_BOT_URL` (e.g. `https://t.me/YourBotUsername`)
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (required for `npm run indexer:pnl`)
- `ARBITRUM_RPC_URL` (optional RPC override for indexing scripts)

## Historical Realized PnL Indexer

To power full-chain realized PnL charts, run the indexer:

```bash
npm run indexer:pnl
```

The worker:
- Reads Aave/Radiant logs on Arbitrum
- Stores normalized events in Supabase (`wallet_activity_events`)
- Rebuilds realized basis per wallet (`wallet_pnl_positions`, `wallet_pnl_daily`)
- Feeds `GET /api/pnl/history` for dashboard charts

## Notes

- Dev runs on webpack (`next dev --webpack`) to avoid Turbopack config conflicts.
- Contract entrypoints used by the frontend are `leverageAave` and `leverageRadiant`.

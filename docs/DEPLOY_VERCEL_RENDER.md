# Deploy ArbiLoop on Vercel + Render

This guide deploys:

- Frontend (`src/frontend`) to Vercel
- Telegram backend worker (`src/bot`) to Render

## 1. Prerequisites

- Code pushed to GitHub/GitLab/Bitbucket
- Supabase migration applied (`src/supabase/migrations.sql`)
- Telegram bot token from BotFather
- Deployed ArbiLoop vault address (`NEXT_PUBLIC_LOOP_VAULT_ADDRESS`)

## 2. Deploy Frontend on Vercel

1. In Vercel, click `Add New Project`.
2. Import this repo.
3. Set `Root Directory` to `src/frontend`.
4. Framework: `Next.js` (auto-detected).
5. Build command: `npm run build` (default is fine).
6. Install command: `npm install` (default is fine).
7. Add environment variables:

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
NEXT_PUBLIC_TARGET_CHAIN=arbitrum
NEXT_PUBLIC_LOOP_VAULT_ADDRESS=0x...
NEXT_PUBLIC_TELEGRAM_BOT_URL=https://t.me/YourBotUsername

NEXT_PUBLIC_AAVE_POOL_ADDRESS=0x794a61358D6845594F94dc1DB02A252b5b4814aD
NEXT_PUBLIC_AAVE_DATA_PROVIDER_ADDRESS=0x6b4E260b765B3cA1514e618C0215A6B7839fF93e
NEXT_PUBLIC_AAVE_GATEWAY_ADDRESS=0xB5Ee21786D28c5Ba61661550879475976B707099

NEXT_PUBLIC_RADIANT_POOL_ADDRESS=0xE23B4AE3624fB6f7cDEF29bC8EAD912f1Ede6886
NEXT_PUBLIC_RADIANT_GATEWAY_ADDRESS=0x8a8f65cabb82a857fa22289ad0a5785a5e7dbd22

NEXT_PUBLIC_DEX_ROUTER_ADDRESS=0xc873fEcbd354f5A56E00E710B90EF4201db2448d
NEXT_PUBLIC_WRAPPED_NATIVE_ADDRESS=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

GEMINI_API_KEY=...
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
```

8. Deploy.

## 3. Deploy Backend Worker on Render

You can deploy from `render.yaml` (recommended) or manually.

### Option A: Blueprint (Recommended)

1. In Render, click `New +` -> `Blueprint`.
2. Select this repo.
3. Render reads `render.yaml` and creates worker `arbiloop-telegram-worker`.
4. Fill secret env values:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy.

### Option B: Manual Worker Service

1. Create `Background Worker`.
2. Repo: this repo.
3. Root Directory: `src/bot`
4. Build Command: `npm ci`
5. Start Command: `npm start`
6. Runtime: Node 20+
7. Add env vars:

```env
TELEGRAM_BOT_TOKEN=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
NEXT_PUBLIC_TARGET_CHAIN=arbitrum
NEXT_PUBLIC_AAVE_POOL_ADDRESS=0x794a61358D6845594F94dc1DB02A252b5b4814aD
NEXT_PUBLIC_RADIANT_POOL_ADDRESS=0xE23B4AE3624fB6f7cDEF29bC8EAD912f1Ede6886

MONITOR_TICK_MS=60000
ALERT_COOLDOWN_MINUTES=60
DAILY_REPORT_INTERVAL_MS=86400000
ENABLE_PNL_INDEXER=true
PNL_INDEXER_INTERVAL_MS=600000
```

## 4. Post-Deploy Validation

1. Open Vercel site and connect wallet.
2. Open Settings and complete Telegram link flow (`/id`, sign, `/verify <signature>`).
3. Confirm Render logs show:
   - `ArbiLoop Telegram bot started.`
   - `Monitor worker started: ...`
   - `PnL indexer worker started: ...`
4. Check Supabase:
   - `users` rows created/updated
   - `liquidation_alerts` rows being inserted
   - `wallet_activity_events` and PnL tables updating over time

## 5. Important Notes

- Keep Render worker running 24/7; alerts and periodic indexing depend on it.
- If you change env vars in Vercel/Render, trigger a redeploy/restart.
- `NEXT_PUBLIC_LOOP_VAULT_ADDRESS` must be your deployed vault on the same chain.

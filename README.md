# ArbiLoop

ArbiLoop is an Arbitrum-native DeFi risk and yield platform that combines strategy execution, live liquidation monitoring, historical PnL analytics, and Telegram alerts.

## What Judges Should Know
- Chain: Arbitrum (mainnet-ready)
- Protocols: Aave V3, Radiant
- Core value: detect risk early, act quickly, and track outcomes over time
- Non-custodial: users execute from their own wallet

## Project Structure
- `src/frontend`: Next.js app (dashboard, strategy UI, risk monitor, analytics, settings)
- `src/contracts/ArbiLoopVaultArbitrum.sol`: execution vault contract for loop/lending flows
- `src/bot`: Telegram bot + background workers (risk monitoring + periodic PnL indexing)
- `src/supabase/migrations.sql`: DB schema for users, alerts, activity events, and PnL tables
- `docs`: deployment and hackathon notes

## Architecture (ASCII)
```text
                    +-----------------------+
                    |     User Wallet       |
                    +-----------+-----------+
                                |
                                v
                    +-----------------------+
                    | Frontend (Next.js)    |
                    | src/frontend          |
                    +----+-------------+----+
                         |             |
              execute tx |             | read/write app data
                         v             v
        +-------------------------+  +--------------------------+
        | ArbiLoopVaultArbitrum   |  | Supabase                 |
        | src/contracts           |  | users, alerts, pnl tables|
        +-------------------------+  +------------+-------------+
                                                  ^
                                                  |
                          writes alerts + indexed pnl data
                                                  |
                          +-----------------------+---------------------+
                          | Telegram Bot Worker (src/bot)              |
                          | - monitors Aave/Radiant health factors      |
                          | - sends Telegram alerts                      |
                          | - runs periodic PnL indexing                 |
                          +-----------------------+---------------------+
                                                  |
                                                  v
                                         +-----------------+
                                         | Telegram User   |
                                         +-----------------+
```

## End-to-End Flow
1. User connects wallet in frontend and links Telegram in Settings.
2. Frontend reads market/position data and shows health factor, opportunities, and risk status.
3. User executes strategy via `ArbiLoopVaultArbitrum` on Arbitrum.
4. Bot worker monitors linked wallets, checks protocol health, and sends Telegram alerts on threshold breaches.
5. Bot also writes alert rows to Supabase (`liquidation_alerts`) for live UI feed.
6. PnL indexer ingests Aave/Radiant events into Supabase and rebuilds wallet realized PnL history.
7. Frontend visualizes historical PnL, health trends, and transaction timeline for user decisions.

## Deployed Contract (Arbitrum One)
- Vault: `0xEEcC6bAD9d400E1E4391C68bA9385E8AA9Face6B`
- Arbiscan: `https://arbiscan.io/address/0xEEcC6bAD9d400E1E4391C68bA9385E8AA9Face6B`
- Deploy Tx: `https://arbiscan.io/tx/0x37085c6f6d5b85633978b72a9399652df172d60c9a6cd1924e06911069abb6ff`

## Quick Local Run
```bash
cd src/frontend
npm install
npm run dev
```

Run Telegram worker locally from repo root:

```bash
.\run-bot-keepalive.cmd
```

## Judge Verification Checklist
1. Connect wallet and open dashboard/lend/portfolio pages.
2. Verify strategy cards are actionable and open execution modal.
3. Link Telegram and confirm bot commands (`/id`, `/verify`, `/status`).
4. Check live alert feed updates from Supabase-backed rows.
5. Check historical PnL/health charts are populated from indexed data.

## Additional Docs
- `docs/DEPLOY_VERCEL_RENDER.md`
- `docs/ARBITRUM_HACKATHON.md`
- `src/contracts/README.md`
- `src/bot/README.md`

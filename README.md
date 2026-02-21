# ArbiLoop

ArbiLoop is an Arbitrum-native DeFi automation app for lending, borrowing, and loop strategy execution.

## Scope
- Frontend dashboard (`src/frontend`)
- Arbitrum execution vault (`src/contracts/ArbiLoopVaultArbitrum.sol`)
- Supabase user settings storage (`src/supabase`)
- Telegram bot backend (`src/bot`)

## Arbitrum Setup
1. Configure `src/frontend/.env.local`.
2. Set `NEXT_PUBLIC_TARGET_CHAIN=arbitrum` or `arbitrum-sepolia`.
3. Deploy `ArbiLoopVaultArbitrum.sol` and set `NEXT_PUBLIC_LOOP_VAULT_ADDRESS`.
4. Run frontend:

```bash
cd src/frontend
npm install
npm run dev
```

## Deployment Docs
- `docs/ARBITRUM_HACKATHON.md`
- `src/contracts/README.md`
- `src/bot/README.md`

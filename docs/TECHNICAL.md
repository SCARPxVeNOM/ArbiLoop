# Technical Architecture

This guide documents the ArbiLoop stack.

## Stack
1. Frontend: Next.js + Wagmi + RainbowKit.
2. Contracts: Solidity vault on Arbitrum.
3. Data: Supabase for user settings.
4. AI: Gemini endpoint for portfolio insights.

## Chain Configuration
`NEXT_PUBLIC_TARGET_CHAIN` supports:
- `arbitrum`
- `arbitrum-sepolia`

## Contracts
Use `src/contracts/ArbiLoopVaultArbitrum.sol` for deployment.

## Frontend Runtime
1. Configure `.env.local`.
2. Start with `npm run dev`.
3. Connect an Arbitrum wallet.

## API Route
`src/frontend/app/api/ai-insight/route.ts` builds risk guidance using portfolio metrics from frontend state.

# Arbitrum Hackathon Migration Guide

This runbook moves ArbiLoop to an Arbitrum-only setup.

## 1. Target Chain

Supported chain modes:
- `arbitrum`
- `arbitrum-sepolia`

Recommended:
- `arbitrum` for production liquidity.
- `arbitrum-sepolia` for free testing.

## 2. RPC Endpoints

Arbitrum One:
- `https://arb1.arbitrum.io/rpc`
- `https://rpc.ankr.com/arbitrum`
- `https://arbitrum.llamarpc.com`

Arbitrum Sepolia:
- `https://sepolia-rollup.arbitrum.io/rpc`

## 3. Frontend Environment

Set `src/frontend/.env.local`:

```env
NEXT_PUBLIC_TARGET_CHAIN=arbitrum
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=YOUR_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_LOOP_VAULT_ADDRESS=0x...
NEXT_PUBLIC_AAVE_POOL_ADDRESS=0x...
NEXT_PUBLIC_AAVE_DATA_PROVIDER_ADDRESS=0x...
NEXT_PUBLIC_RADIANT_POOL_ADDRESS=0x...
NEXT_PUBLIC_WRAPPED_NATIVE_ADDRESS=0x...
NEXT_PUBLIC_AAVE_GATEWAY_ADDRESS=0x...
NEXT_PUBLIC_RADIANT_GATEWAY_ADDRESS=0x...
NEXT_PUBLIC_DEX_ROUTER_ADDRESS=0x...
```

Start frontend:

```bash
cd src/frontend
npm install
npm run dev
```

## 4. Deploy Vault

Contract: `src/contracts/ArbiLoopVaultArbitrum.sol`

Constructor:
- `poolAddress`: Aave-compatible pool for your target chain.

Recommended constructor on Arbitrum One:
- `0x794a61358D6845594F94dc1DB02A252b5b4814aD`

## 5. Smoke Test

1. Set `NEXT_PUBLIC_LOOP_VAULT_ADDRESS`.
2. Restart frontend.
3. Connect wallet on Arbitrum.
4. Test small `supply`, `borrow`, and `repay` actions.

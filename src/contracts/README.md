# ArbiLoop Contracts

This folder contains the Arbitrum execution contract.

- `ArbiLoopVaultArbitrum.sol`: Arbitrum-ready Aave-style execution vault.

## Deploy Target

Use Arbitrum One or Arbitrum Sepolia.

## Constructor

```solidity
constructor(address poolAddress)
```

- `poolAddress`: Aave-compatible pool on target network.

Recommended `poolAddress` (Arbitrum One):
- `0x794a61358D6845594F94dc1DB02A252b5b4814aD`

## Deploy Steps

1. Open Remix (`https://remix.ethereum.org`).
2. Paste `ArbiLoopVaultArbitrum.sol`.
3. Compile with `0.8.20`.
4. Deploy with `Injected Provider - MetaMask` on Arbitrum.
5. Put deployed address in `NEXT_PUBLIC_LOOP_VAULT_ADDRESS`.

## Notes

- Vault accepts ERC20 input; native ETH is not accepted directly.
- Frontend-compatible wrappers are included: `leverageKinza`, `leverageRadiant`.
- Wrapper params `legacy extra amount and legacy route hint` are accepted for compatibility and ignored in Arbitrum execution path.

# Project Overview

## Problem

Managing leveraged lending positions on Arbitrum is fragmented and stressful:

- Users monitor APY, health factor, and LTV across multiple protocols.
- Liquidation risk changes quickly in volatile conditions.
- Loop execution requires multi-step actions that are error-prone manually.

## Solution: ArbiLoop

ArbiLoop provides an Arbitrum-native dashboard and execution flow for:

- Aave V3
- Radiant

### Unified Portfolio View

The dashboard aggregates net worth and risk metrics across integrated protocols in one place.

### AI Risk Insights

Gemini-generated risk summaries turn raw metrics into actionable guidance.

### Strategy Execution

Users can execute loop strategies through `ArbiLoopVaultArbitrum` via explicit wallet signatures.

## Roadmap

1. Improve strategy safety checks and simulation accuracy.
2. Add constrained automation with session-key style permissions.
3. Expand protocol coverage within the Arbitrum ecosystem.

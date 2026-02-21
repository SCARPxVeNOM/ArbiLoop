# ArbiLoop Frontend Interface

The "Concierge" interface is built for speed, clarity, and "Good Vibes".

## ✨ Feature Gallery

### 1. Unified Portfolio
Aggregates your Net Worth and Health Factor across all integrated protocols (Aave, Kinza, Radiant).

![Portfolio](./screenshots/portfolio.png)

### 2. High-Yield Lending
Simplified Supply and Borrow interfaces for maximum usability.

![Lend Earn](./screenshots/lend-earn.png)
![Lend Borrow](./screenshots/lend-borrow.png)

### 3. Strategy Executor (Smart Loops)
Our "Smart Loop" builder doesn't just simulate; it **executes**. Architect complex loop strategies, project APY, and optimize for the best possible yields on-chain.

![Strategy Builder](./screenshots/strategy-builder.png)

---

## 🛠️ Reproduction Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env.local` based on `.env.example`:
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`: Get from [WalletConnect Cloud](https://cloud.walletconnect.com/).
- `GEMINI_API_KEY`: Required for frontend AI-insight synthesis.

### 3. Development Server
```bash
npm run dev
```

## 🏗️ Technical Stack

-   **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)
-   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
-   **Blockchain**: [Wagmi](https://wagmi.sh/) & [Viem](https://viem.sh/)
-   **AI Integration**: [Google Gemini 1.5 Flash](https://deepmind.google/technologies/gemini/flash/)
-   **Data**: [Supabase](https://supabase.com/)

## 📂 Project Structure

```text
src/
├── app/                  # Next.js App Router pages
│   ├── dashboard/        # Main user dashboard
│   ├── lend/             # Lending & Strategy interfaces
│   ├── portfolio/        # Detailed asset breakdown
│   └── settings/         # User preferences & Telegram linking
├── components/           # Reusable UI components
│   ├── ui/               # shadcn/ui primitives
│   └── ...               # Feature-specific components
├── lib/                  # Utilities & Configuration
│   ├── pool-config.ts    # Central DeFi protocol config (Aave/Kinza/Radiant)
│   └── gemini.ts         # AI Client setup
└── hooks/                # Custom React hooks (blockchain/data)
```

## 🔑 Environment Variables

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | Required for RainbowKit/WalletConnect. Get one from [WalletConnect Cloud](https://cloud.walletconnect.com/). |
| `NEXT_PUBLIC_TARGET_CHAIN` | Chain mode: `arbitrum` or `arbitrum-sepolia`. |
| `NEXT_PUBLIC_AAVE_POOL_ADDRESS` | Aave-compatible pool address (used in Arbitrum mode). |
| `NEXT_PUBLIC_AAVE_DATA_PROVIDER_ADDRESS` | Aave data provider address (used for per-asset account reads). |
| `NEXT_PUBLIC_RADIANT_POOL_ADDRESS` | Radiant pool address (optional, Arbitrum mode). |
| `NEXT_PUBLIC_DEX_ROUTER_ADDRESS` | DEX router for swap-assisted flows (Arbitrum mode). |
| `NEXT_PUBLIC_AAVE_GATEWAY_ADDRESS` | Wrapped native gateway for Aave (Arbitrum mode). |
| `NEXT_PUBLIC_RADIANT_GATEWAY_ADDRESS` | Wrapped native gateway for Radiant (Arbitrum mode). |
| `NEXT_PUBLIC_WRAPPED_NATIVE_ADDRESS` | Wrapped native token address (`WETH`). |
| `GEMINI_API_KEY` | Google Gemini API Key for generating risk insights. Get one from [Google AI Studio](https://aistudio.google.com/). |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key. |

---

## ✅ Complete the Setup

To fully deploy the ArbiLoop ecosystem, ensure you have completed all 4 pillars:

1.  **[Current] Frontend Dashboard**: (You are here) The user interface.
2.  **[Smart Contracts](../contracts/README.md)**: The execution layer.
3.  **[Database Schema](../supabase/README.md)**: SQL migrations for user storage.


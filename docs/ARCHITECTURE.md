# SniperAI — Architecture Document

## Overview

**SniperAI** is a mobile-first AI trading copilot for Solana memecoin traders, built on Solana Mobile (Seeker). It wraps proven sniper bot logic into a consumer-friendly mobile experience with real-time alerts, 1-tap trading, and AI-powered token scoring.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT (Seeker)                        │
│                                                                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │
│  │  Home /   │  │  Token    │  │ Portfolio │  │   AI Chat     │   │
│  │  Feed     │  │  Detail   │  │ Tracker   │  │   Interface   │   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └───────┬───────┘   │
│        │               │               │               │           │
│  ┌─────┴───────────────┴───────────────┴───────────────┴─────┐     │
│  │              Solana Mobile Stack (SMS)                      │     │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐  │     │
│  │  │ Mobile   │  │  Seed Vault  │  │  Push Notification  │  │     │
│  │  │ Wallet   │  │  (Secure     │  │  Handler            │  │     │
│  │  │ Adapter  │  │   Signing)   │  │                     │  │     │
│  │  └──────────┘  └──────────────┘  └─────────────────────┘  │     │
│  └────────────────────────────┬───────────────────────────────┘     │
│                               │                                     │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                     WebSocket + REST API
                                │
┌───────────────────────────────┼─────────────────────────────────────┐
│                        BACKEND SERVER                                │
│                                                                     │
│  ┌────────────────────────────┴────────────────────────────────┐    │
│  │                    API Gateway (Express/Fastify)             │    │
│  │         /api/v1/*  (REST)  +  /ws  (WebSocket)              │    │
│  └──────┬──────────┬──────────┬──────────┬──────────┬──────────┘    │
│         │          │          │          │          │               │
│  ┌──────┴───┐ ┌────┴────┐ ┌──┴───┐ ┌────┴────┐ ┌──┴──────────┐   │
│  │ Screening│ │  Risk   │ │Trade │ │ Monitor │ │  AI Engine  │   │
│  │ Service  │ │ Manager │ │Executor│ │ Service │ │  (LLM/NLP) │   │
│  └──────┬───┘ └────┬────┘ └──┬───┘ └────┬────┘ └──┬──────────┘   │
│         │          │         │          │          │               │
│  ┌──────┴──────────┴─────────┴──────────┴──────────┴──────────┐    │
│  │                    Core Bot Engine                           │    │
│  │         (detector.js + screening.js + risk.js)              │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                       │
│  ┌──────────────────────────┴──────────────────────────────────┐    │
│  │                    Data Layer                                │    │
│  │  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐   │    │
│  │  │ Redis    │  │  PostgreSQL  │  │  State Manager      │   │    │
│  │  │ (Cache + │  │  (History +  │  │  (Positions +       │   │    │
│  │  │  PubSub) │  │   Analytics) │  │   Blacklists)       │   │    │
│  │  └──────────┘  └──────────────┘  └─────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                     Solana RPC + External APIs
                                │
┌───────────────────────────────┼─────────────────────────────────────┐
│                    BLOCKCHAIN & DATA SOURCES                         │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │PumpPortal│  │ Jupiter  │  │ Helius   │  │  Solana RPC       │  │
│  │WebSocket │  │  API     │  │  API     │  │  (Mainnet)        │  │
│  │(New Tokens│  │(Swap/Quote│  │(Tx History│  │                   │  │
│  │ + Trades)│  │ + Price) │  │ + Holders)│  │                   │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### Mobile Client (React Native + Solana Mobile SDK)

| Module | Responsibility |
|--------|---------------|
| `screens/Home` | Real-time feed token baru + scores |
| `screens/TokenDetail` | Chart, holder data, buy/sell buttons |
| `screens/Portfolio` | Open positions, PnL, history |
| `screens/AIChat` | Natural language query ("find tokens >80 score") |
| `screens/Settings` | Risk params, notifications, wallet config |
| `hooks/useWebSocket` | Real-time data subscription |
| `hooks/useWallet` | Mobile Wallet Adapter + Seed Vault integration |
| `services/api` | REST client for backend |
| `services/notifications` | FCM/APNs push notification handler |

### Backend Server (Node.js)

| Module | Responsibility |
|--------|---------------|
| `api/routes/tokens.js` | Token feed, search, detail |
| `api/routes/trade.js` | Buy/sell execution endpoints |
| `api/routes/portfolio.js` | Positions, history, stats |
| `api/routes/alerts.js` | Notification preferences |
| `api/routes/ai.js` | AI chat/query endpoint |
| `ws/handler.js` | WebSocket server (real-time feed) |
| `services/screening.js` | Token scoring engine (from Carter) |
| `services/detector.js` | PumpPortal listener (from Carter) |
| `services/risk.js` | Risk management (from Carter) |
| `services/executor.js` | Trade execution (PumpPortal + Jupiter) |
| `services/monitor.js` | Position monitoring + exit logic |
| `services/ai-engine.js` | LLM integration for chat queries |
| `services/push.js` | Push notification sender (FCM) |
| `db/models/` | User, Position, TradeHistory, Alert |
| `db/redis.js` | Cache + real-time pub/sub |

---

## Data Flow

### 1. Token Detection → User Alert (< 3 seconds)

```
PumpPortal WS → detector.js → screening.js (score) → Redis PubSub
    → WebSocket broadcast to connected clients
    → Push notification to subscribed users (if score ≥ threshold)
```

### 2. User Buys Token (1-tap)

```
Mobile App → POST /api/v1/trade/buy { mint, amount }
    → Backend validates (risk check)
    → Constructs transaction (PumpPortal/Jupiter)
    → Returns serialized tx to mobile
    → Mobile signs with Seed Vault
    → Backend submits signed tx to Solana
    → Confirm → Save position → Notify
```

### 3. Auto-Exit (Monitor detects TP/SL)

```
Monitor loop → price check → exit condition met
    → Constructs sell tx → Push to user for approval (semi-auto)
    OR → Auto-execute (full-auto, pre-authorized)
    → Close position → Update stats → Notify user
```

### 4. AI Chat Query

```
User: "find tokens with >80 score launched in last 10min"
    → POST /api/v1/ai/query { message }
    → AI Engine parses intent
    → Queries screening cache / DB
    → Returns structured results + explanation
```

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Mobile** | React Native + Expo | Cross-platform, Solana Mobile SDK support |
| **Mobile SDK** | `@solana-mobile/mobile-wallet-adapter-protocol` | Seed Vault + wallet signing |
| **Backend** | Node.js + Fastify | Fast, lightweight, matches existing bot code |
| **WebSocket** | ws / Socket.io | Real-time token feed |
| **Database** | PostgreSQL | Trade history, analytics, user data |
| **Cache** | Redis | Token cache, real-time pub/sub, rate limiting |
| **Push** | Firebase Cloud Messaging (FCM) | Android push notifications |
| **AI** | OpenRouter / GPT-4o-mini | Chat interface, intent parsing |
| **Blockchain** | Solana Web3.js, PumpPortal, Jupiter, Helius | On-chain data + execution |
| **Auth** | Wallet-based (sign message) | No passwords, crypto-native |
| **Hosting** | Railway / Render / VPS | Backend deployment |

---

## Security Model

```
┌─────────────────────────────────────┐
│          SECURITY LAYERS            │
├─────────────────────────────────────┤
│ 1. Seed Vault (device hardware)    │ ← Private key NEVER leaves device
│ 2. Transaction signing on-device   │ ← Backend never sees private key
│ 3. JWT + wallet signature auth     │ ← Verify wallet ownership
│ 4. Rate limiting (Redis)           │ ← Prevent abuse
│ 5. Amount limits (risk.js)         │ ← Max per trade / per day
│ 6. Backend-only reads, no writes   │ ← Backend cannot steal funds
└─────────────────────────────────────┘
```

**Key Principle**: Backend NEVER holds private keys. All transactions are signed on the mobile device via Seed Vault. Backend only constructs unsigned transactions.

---

## SKR Token Integration

| Feature | SKR Usage |
|---------|-----------|
| App usage rewards | Earn SKR for daily active use |
| Premium features unlock | Stake SKR to access AI chat / advanced filters |
| Referral program | Earn SKR for inviting traders |
| Governance | SKR holders vote on new features |
| Fee discounts | Pay swap fees in SKR for 50% discount |

---

## Revenue Model

| Stream | Mechanism | Projected |
|--------|-----------|-----------|
| Swap fees | 0.5% on each trade executed through app | Primary |
| Premium subscription | $9.99/mo for AI chat + advanced alerts | Recurring |
| Copy trading fee | 10% of profits from copy trades | Performance |
| SKR token appreciation | Protocol-owned liquidity | Long-term |

---

## Folder Structure

```
sniperai/
├── mobile/                          # React Native app
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── TokenDetailScreen.tsx
│   │   │   ├── PortfolioScreen.tsx
│   │   │   ├── AIChatScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   ├── components/
│   │   │   ├── TokenCard.tsx
│   │   │   ├── ScoreBadge.tsx
│   │   │   ├── TradeButton.tsx
│   │   │   ├── PnLChart.tsx
│   │   │   └── AlertBanner.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useWallet.ts
│   │   │   ├── useTokenFeed.ts
│   │   │   └── usePortfolio.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── notifications.ts
│   │   │   └── storage.ts
│   │   ├── utils/
│   │   │   ├── format.ts
│   │   │   └── constants.ts
│   │   └── App.tsx
│   ├── android/
│   ├── package.json
│   └── app.json
│
├── backend/                         # Node.js API server
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── tokens.js
│   │   │   │   ├── trade.js
│   │   │   │   ├── portfolio.js
│   │   │   │   ├── alerts.js
│   │   │   │   └── ai.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.js
│   │   │   │   └── rateLimit.js
│   │   │   └── index.js
│   │   ├── ws/
│   │   │   └── handler.js
│   │   ├── services/
│   │   │   ├── detector.js         # ← from Carter bot
│   │   │   ├── screening.js        # ← from Carter bot
│   │   │   ├── risk.js             # ← from Carter bot
│   │   │   ├── executor.js         # ← from Carter bot
│   │   │   ├── monitor.js          # ← from Carter bot
│   │   │   ├── ai-engine.js
│   │   │   └── push.js
│   │   ├── db/
│   │   │   ├── models/
│   │   │   │   ├── User.js
│   │   │   │   ├── Position.js
│   │   │   │   ├── Trade.js
│   │   │   │   └── Alert.js
│   │   │   ├── migrations/
│   │   │   ├── redis.js
│   │   │   └── postgres.js
│   │   ├── config.js
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
│
├── shared/                          # Shared types & constants
│   ├── types.ts
│   └── constants.ts
│
├── docs/
│   ├── ARCHITECTURE.md              # This file
│   ├── API.md                       # API documentation
│   └── GRANT_PROPOSAL.md            # Solana Mobile grant proposal
│
├── .env.example
├── docker-compose.yml
└── README.md
```

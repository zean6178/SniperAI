# SniperAI

**AI-Powered Memecoin Trading Copilot for Solana Mobile (Seeker)**

A mobile-first AI trading assistant that scores new Pump.fun tokens in real-time, sends push alerts, and enables 1-tap secure trading via Seed Vault.

---

## Architecture

```
[PumpPortal WebSocket] → Real-time token detection
         │
         ▼
[Screening Engine] → Multi-factor scoring (0-100)
         │
         ▼
[Risk Manager] → Portfolio-level protection
         │
         ▼
[Trade Executor] → PumpPortal + Jupiter swap
         │
         ▼
[Position Monitor] → Auto TP/SL/Trailing/Rug detection
         │
         ▼
[Mobile App] → Push alerts, 1-tap trade, AI chat
```

## Features

- **Real-time detection** via PumpPortal WebSocket
- **AI scoring** (0-100) — holders, volume, bundles, deployer, bonding curve
- **Bundle detection** — skip insider/coordinated launches
- **Tiered take-profit** — 50% @2x, 30% @3x, 15% @5x, 5% moonbag
- **Trailing stop** + stop loss + rug detection
- **Risk management** — max positions, daily loss limit, cooldown
- **Telegram bot** — /status, /pause, /resume, /positions
- **Dry run mode** — safe testing without real trades

## Quick Start (Bot Engine)

```bash
npm install
cp .env.example .env    # Fill in your keys
npm run dev             # Dry run mode
npm start               # Live trading
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, data flow, tech stack
- [API Design](docs/API.md) — REST + WebSocket endpoints for mobile app
- [Grant Proposal](docs/GRANT_PROPOSAL.md) — Solana Mobile Builder Grant application

## Roadmap

| Phase | Timeline | Status |
|-------|----------|--------|
| Bot Engine (core logic) | Week 0 | ✅ Done |
| Architecture + API Design | Week 0 | ✅ Done |
| Backend API Layer | Week 1-2 | 🔜 Next |
| Mobile App (React Native) | Week 3-4 | Planned |
| Seed Vault Integration | Week 5 | Planned |
| Push Notifications | Week 6 | Planned |
| AI Chat Engine | Week 7 | Planned |
| SKR Token + dApp Store | Week 8-9 | Planned |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo + Solana Mobile SDK |
| Backend | Node.js + Fastify + WebSocket |
| Database | PostgreSQL + Redis |
| AI | OpenRouter (GPT-4o-mini) |
| Blockchain | Solana Web3.js, PumpPortal, Jupiter, Helius |
| Security | Seed Vault (on-device signing) |

## Requirements

- Node.js >= 18
- Solana wallet (private key)
- RPC endpoint (Helius/Quicknode recommended)
- Telegram bot token (optional)

## Disclaimer

This software is for educational purposes. Trading memecoins is extremely high-risk. Only use funds you can afford to lose entirely.

## License

MIT

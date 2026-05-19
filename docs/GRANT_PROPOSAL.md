# SniperAI — Solana Mobile Builder Grant Proposal

---

## Project Name
**SniperAI** — AI-Powered Memecoin Trading Copilot for Solana Mobile

---

## One-Liner
A mobile-first AI trading assistant that scores new Pump.fun tokens in real-time, sends push alerts, and enables 1-tap secure trading via Seed Vault — turning complex on-chain analysis into a consumer-friendly Seeker experience.

---

## Problem Statement

### The Problem:
Solana memecoin trading is dominated by desktop-based tools and bots that are:
- **Complex** — requires terminal/CLI knowledge, multiple browser tabs
- **Slow for mobile users** — existing tools have poor mobile UX
- **Dangerous** — most traders lose money due to scams, rugs, and FOMO
- **Not leveraging Seeker hardware** — no app uses Seed Vault + sensors for trading

### Market Size:
- Pump.fun alone generates **$193M+ monthly revenue** across its ecosystem
- **15,000+ tokens** launched daily on Pump.fun
- Only **1.4% of tokens** reach Raydium (profitable exits)
- **98%+ scam rate** — traders desperately need better screening tools
- **150K+ Seeker users** without a dedicated trading copilot

### The Opportunity:
Transform the proven bot logic (token screening, risk management, auto-exit) into a beautiful mobile app that makes sophisticated trading strategies accessible to everyday Seeker users.

---

## Solution: SniperAI

### What We're Building:
A native Android app for Solana Seeker that acts as an AI trading copilot:

1. **Real-time Token Feed** — Every new Pump.fun token, scored 0-100
2. **AI Screening** — Multi-factor analysis (holders, bundles, dev wallet, volume, bonding curve)
3. **Push Alerts** — Instant notification when high-score tokens appear
4. **1-Tap Trading** — Buy/sell with Seed Vault signing (never expose private keys)
5. **Auto Protection** — Rug detection, trailing stops, take-profit automation
6. **AI Chat** — Natural language queries ("show me tokens >80 score, no bundles")
7. **Portfolio Tracking** — Real-time PnL, win rate, performance analytics

### Key Differentiators:
| Feature | SniperAI | Existing Tools |
|---------|----------|---------------|
| Platform | Native Seeker app | Desktop/browser only |
| Security | Seed Vault signing | Browser wallet (vulnerable) |
| UX | 1-tap buy/sell | Complex multi-step |
| Intelligence | AI scoring + chat | Manual research |
| Protection | Auto rug detection | None or delayed |
| Alerts | Push notifications | None on mobile |

---

## Solana Mobile Stack Integration

### Hardware Utilization:

| Seeker Feature | How We Use It |
|----------------|--------------|
| **Seed Vault** | All transaction signing — private key never leaves device |
| **Mobile Wallet Adapter** | Seamless wallet connection, no external wallets needed |
| **Push Notifications** | Real-time alerts for high-score tokens & exit signals |
| **dApp Store** | Primary distribution channel (0% platform fee) |
| **Genesis Token** | Verify Seeker ownership for exclusive features |

### SKR Token Integration:

| Mechanism | Details |
|-----------|---------|
| **Earn** | Users earn SKR for daily app usage, successful trades, referrals |
| **Spend** | Stake SKR to unlock premium features (AI chat, advanced filters) |
| **Fee discount** | Pay platform fees in SKR for 50% discount |
| **Governance** | SKR holders vote on screening parameters, new features |

---

## Technical Architecture

### Already Built (Carter Bot Engine):
- ✅ PumpPortal WebSocket listener (real-time token detection)
- ✅ Multi-factor screening pipeline (scoring 0-100)
- ✅ Bundle detection (insider sniping prevention)
- ✅ Deployer history analysis (serial rugger detection)
- ✅ Risk management (max positions, daily limits, cooldown)
- ✅ Tiered take-profit / trailing stop / rug detection
- ✅ PumpPortal + Jupiter execution (buy/sell)
- ✅ Position monitoring with auto-exit logic

### To Be Built:
- [ ] REST/WebSocket API layer (expose bot logic to mobile)
- [ ] React Native mobile app (Seeker-optimized)
- [ ] Solana Mobile SDK integration (Seed Vault + MWA)
- [ ] Push notification service (FCM)
- [ ] AI chat engine (intent parsing + token search)
- [ ] PostgreSQL + Redis data layer (multi-user support)
- [ ] SKR token integration

### Stack:
```
Mobile:   React Native + Expo + Solana Mobile SDK
Backend:  Node.js + Fastify + WebSocket
Database: PostgreSQL + Redis
AI:       OpenRouter (GPT-4o-mini)
Infra:    Railway/Render + Cloudflare
```

---

## Team

| Role | Experience |
|------|-----------|
| Lead Developer | Solana bot development (DLMM LP bot, Pump.fun sniper), full-stack JS/TS, on-chain trading systems |
| Domain Expertise | Active memecoin trader with proven screening methodology |

---

## Roadmap

| Phase | Timeline | Deliverables |
|-------|----------|-------------|
| **Phase 1** — Backend API | Week 1-2 | REST/WS API, multi-user auth, Redis pub/sub |
| **Phase 2** — Mobile MVP | Week 3-4 | Token feed, detail view, basic buy/sell |
| **Phase 3** — Seed Vault | Week 5 | MWA integration, secure signing flow |
| **Phase 4** — Push + Alerts | Week 6 | FCM notifications, alert preferences |
| **Phase 5** — AI Chat | Week 7 | Natural language queries, token explanation |
| **Phase 6** — SKR + Polish | Week 8 | SKR integration, analytics, dApp Store submit |
| **Phase 7** — Launch | Week 9 | dApp Store listing, marketing, community |

---

## Metrics & KPIs

| Metric | Target (3 months post-launch) |
|--------|-------------------------------|
| Monthly Active Users | 5,000+ |
| Daily Active Users | 1,500+ |
| Trades executed | 10,000+/month |
| User win rate improvement | +15% vs. manual trading |
| Retention (D7) | 40%+ |
| Retention (D30) | 20%+ |
| Revenue (MRR) | $15,000+ |

---

## Grant Request

### Amount: $25,000 - $50,000

### Allocation:
| Category | Amount | Purpose |
|----------|--------|---------|
| Development | 60% | Mobile app development, SDK integration |
| Infrastructure | 15% | Servers, RPC endpoints, databases |
| AI/LLM costs | 10% | OpenRouter API credits for chat feature |
| Marketing | 10% | Launch campaign, content, community |
| Contingency | 5% | Unexpected costs |

### Why This Grant:
1. **Already have working core** — Bot engine is built and tested (open source on GitHub)
2. **Clear path to launch** — 9-week roadmap with specific deliverables
3. **Revenue-generating** — Self-sustaining after launch via swap fees + premium
4. **Grows Seeker ecosystem** — Brings active traders to dApp Store daily
5. **SKR utility** — Direct integration that drives SKR demand

---

## Competitive Landscape

| App | Platform | Weakness vs. SniperAI |
|-----|----------|----------------------|
| GMGN.ai | Web | No mobile app, no Seed Vault, no push alerts |
| BullX | Web | Desktop-focused, complex UI, no AI |
| Photon | Web | No mobile-native experience |
| BananaGun | Telegram | Text-only, no visual UI, no portfolio tracking |
| Axiom | Web | DeFi-focused, not memecoin-specific |

**SniperAI's moat**: Only native Seeker app combining AI scoring + 1-tap trading + Seed Vault security for Pump.fun tokens.

---

## Links

- **Full Project (Open Source)**: https://github.com/zean6178/SniperAI
- **Architecture Doc**: See ARCHITECTURE.md
- **API Design**: See API.md

---

## Contact

- GitHub: @zean6178
- App: SniperAI (upcoming on Solana dApp Store)

---

*We believe mobile is the future of crypto trading. SniperAI brings institutional-grade screening to every Seeker user's pocket.*

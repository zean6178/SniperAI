# SniperAI — API Design Document

## Base URL
```
Production: https://api.sniperai.app/v1
WebSocket:  wss://api.sniperai.app/ws
```

## Authentication

All endpoints require wallet-based auth:
```
Authorization: Bearer <jwt_token>
```

### Get JWT Token:
```
POST /auth/login
Body: { walletAddress, signedMessage, message }
Response: { token, expiresAt }
```

The user signs a message with their Seed Vault. Backend verifies the signature matches the wallet address.

---

## REST API Endpoints

### Tokens

#### GET /tokens/feed
Real-time scored token feed (latest detected tokens).

```json
// Query params
?minScore=60&limit=20&offset=0&sortBy=score|time|volume

// Response
{
  "tokens": [
    {
      "mint": "AbC123...",
      "symbol": "DOGE2",
      "name": "Doge 2.0",
      "score": 82,
      "decision": "SNIPE",
      "deployer": "XyZ789...",
      "bondingCurvePct": 23.5,
      "marketCapSol": 12.4,
      "volume5mSol": 8.2,
      "buyCount5m": 34,
      "uniqueBuyers": 18,
      "holderCount": 45,
      "topHolderPct": 8.2,
      "devHoldingPct": 2.1,
      "isBundled": false,
      "hasSocial": true,
      "reasons": [
        "✅ Buy count: 34 (min: 10)",
        "✅ Strong buy pressure: 78%",
        "✅ Diverse buyers: 18 unique wallets",
        "✅ Bonding curve: 23.5% (sweet spot)"
      ],
      "detectedAt": "2025-08-15T14:32:01.000Z",
      "age": "2m 30s"
    }
  ],
  "total": 156,
  "hasMore": true
}
```

#### GET /tokens/:mint
Detailed token info + live data.

```json
// Response
{
  "mint": "AbC123...",
  "symbol": "DOGE2",
  "name": "Doge 2.0",
  "score": 82,
  "currentPriceSol": 0.000042,
  "marketCapSol": 42.5,
  "bondingCurvePct": 35.2,
  "volume": {
    "5m": 12.5,
    "1h": 85.3,
    "24h": null
  },
  "holders": {
    "total": 67,
    "topHolderPct": 7.8,
    "top10Pct": 32.1,
    "devPct": 1.9
  },
  "trades": {
    "buyCount5m": 42,
    "sellCount5m": 8,
    "buyPressure": 0.84,
    "uniqueBuyers": 28,
    "isBundled": false
  },
  "deployer": {
    "address": "XyZ789...",
    "isBlacklisted": false,
    "tokenCount24h": 1,
    "isSerialDeployer": false
  },
  "social": {
    "hasTwitter": true,
    "hasTelegram": true,
    "hasWebsite": false
  },
  "risks": [
    "⚠️ Bonding curve advancing (35%)"
  ],
  "metadata": {
    "uri": "https://...",
    "image": "https://..."
  }
}
```

#### GET /tokens/trending
Top trending tokens right now.

```json
// Query params
?timeframe=5m|1h&limit=10

// Response
{
  "tokens": [...],  // Same structure as feed
  "updatedAt": "2025-08-15T14:32:01.000Z"
}
```

#### GET /tokens/history
Historical token detections with outcomes.

```json
// Query params
?date=2025-08-15&minScore=70&outcome=profit|loss|all

// Response
{
  "tokens": [
    {
      "mint": "...",
      "symbol": "...",
      "score": 85,
      "detectedAt": "...",
      "peakMultiple": 4.2,
      "outcome": "profit",
      "bestExitTime": "12m after detection"
    }
  ]
}
```

---

### Trading

#### POST /trade/prepare-buy
Construct unsigned buy transaction for mobile signing.

```json
// Request
{
  "mint": "AbC123...",
  "amountSol": 0.5,
  "slippageBps": 1500
}

// Response
{
  "transaction": "base64_encoded_unsigned_tx",
  "estimatedTokens": 1250000,
  "estimatedPriceImpact": 2.3,
  "fee": {
    "networkFee": 0.000005,
    "priorityFee": 0.00005,
    "platformFee": 0.0025
  },
  "expiresAt": "2025-08-15T14:32:31.000Z"
}
```

#### POST /trade/submit
Submit signed transaction to blockchain.

```json
// Request
{
  "signedTransaction": "base64_encoded_signed_tx",
  "mint": "AbC123...",
  "amountSol": 0.5
}

// Response
{
  "success": true,
  "txHash": "5xY...",
  "position": {
    "mint": "AbC123...",
    "symbol": "DOGE2",
    "entryAmountSol": 0.5,
    "entryPriceSol": 0.000042,
    "tokenAmount": 1190476,
    "openedAt": "2025-08-15T14:32:05.000Z"
  }
}
```

#### POST /trade/prepare-sell
Construct unsigned sell transaction.

```json
// Request
{
  "mint": "AbC123...",
  "sellPct": 50,        // Sell 50% of holdings
  "slippageBps": 1500
}

// Response
{
  "transaction": "base64_encoded_unsigned_tx",
  "estimatedSolReceived": 0.82,
  "estimatedPnl": {
    "sol": 0.32,
    "pct": 64.0,
    "multiple": "1.64x"
  },
  "expiresAt": "2025-08-15T14:32:31.000Z"
}
```

#### POST /trade/submit-sell
Submit signed sell transaction.

```json
// Request
{
  "signedTransaction": "base64_encoded_signed_tx",
  "mint": "AbC123...",
  "sellPct": 50
}

// Response
{
  "success": true,
  "txHash": "7zW...",
  "solReceived": 0.81,
  "pnlSol": 0.31,
  "remainingPct": 50
}
```

---

### Portfolio

#### GET /portfolio/positions
All open positions with live PnL.

```json
// Response
{
  "positions": [
    {
      "mint": "AbC123...",
      "symbol": "DOGE2",
      "entryAmountSol": 0.5,
      "entryPriceSol": 0.000042,
      "currentPriceSol": 0.000068,
      "currentMultiple": 1.62,
      "pnlPct": 61.9,
      "pnlSol": 0.31,
      "peakMultiple": 1.85,
      "soldPct": 0,
      "holdTime": "14m",
      "screenScore": 82,
      "openedAt": "2025-08-15T14:32:05.000Z",
      "exitStrategy": {
        "nextTp": { "at": "2.0x", "sellPct": 50 },
        "stopLoss": "-40%",
        "trailingStop": "25% from peak"
      }
    }
  ],
  "summary": {
    "totalPositions": 2,
    "totalInvestedSol": 1.2,
    "totalCurrentValueSol": 1.85,
    "totalPnlSol": 0.65,
    "totalPnlPct": 54.2
  }
}
```

#### GET /portfolio/history
Closed trades with performance data.

```json
// Query params
?limit=50&offset=0&startDate=2025-08-01

// Response
{
  "trades": [
    {
      "mint": "...",
      "symbol": "MOON",
      "entryAmountSol": 0.5,
      "exitAmountSol": 1.45,
      "pnlSol": 0.95,
      "pnlPct": 190,
      "peakMultiple": 3.2,
      "holdTime": "8m",
      "exitReason": "take_profit",
      "screenScore": 78,
      "openedAt": "...",
      "closedAt": "..."
    }
  ],
  "stats": {
    "totalTrades": 42,
    "winRate": 68.5,
    "avgPnlPct": 23.4,
    "totalProfitSol": 12.8,
    "bestTrade": { "symbol": "MOON", "pnlPct": 420 },
    "worstTrade": { "symbol": "RUG", "pnlPct": -38 }
  }
}
```

#### GET /portfolio/stats
Performance analytics.

```json
// Query params
?period=7d|30d|all

// Response
{
  "period": "7d",
  "winRate": 68.5,
  "totalTrades": 42,
  "profitSol": 12.8,
  "lossSol": -3.2,
  "netPnlSol": 9.6,
  "avgHoldTime": "11m",
  "avgScore": 74,
  "bestDay": { "date": "2025-08-12", "pnlSol": 4.2 },
  "worstDay": { "date": "2025-08-14", "pnlSol": -1.8 },
  "dailyBreakdown": [
    { "date": "2025-08-15", "trades": 6, "pnlSol": 1.2, "winRate": 83 }
  ]
}
```

---

### Alerts & Notifications

#### GET /alerts/config
Get user's alert preferences.

```json
{
  "enabled": true,
  "minScoreForAlert": 75,
  "alertOnRug": true,
  "alertOnTakeProfit": true,
  "alertOnStopLoss": true,
  "quietHours": { "start": "23:00", "end": "07:00" },
  "maxAlertsPerHour": 10
}
```

#### PUT /alerts/config
Update alert preferences.

#### GET /alerts/history
Recent alert history.

---

### AI Chat

#### POST /ai/query
Natural language query for token discovery.

```json
// Request
{
  "message": "Find tokens with score >80, launched in last 10 minutes, no bundles"
}

// Response
{
  "reply": "I found 3 tokens matching your criteria:",
  "tokens": [
    { "mint": "...", "symbol": "PEPE2", "score": 85, "age": "7m" },
    { "mint": "...", "symbol": "CHAD", "score": 82, "age": "4m" },
    { "mint": "...", "symbol": "MOON3", "score": 81, "age": "9m" }
  ],
  "intent": "search",
  "filters": {
    "minScore": 80,
    "maxAgeMinutes": 10,
    "excludeBundled": true
  }
}
```

#### POST /ai/explain
Explain a token's score breakdown.

```json
// Request
{ "mint": "AbC123..." }

// Response
{
  "reply": "DOGE2 scored 82/100. Here's why:\n\n✅ Strong momentum (34 buys in 5min)\n✅ Organic buyers (18 unique wallets)\n✅ Dev holding safe (2.1%)\n⚠️ Bonding curve advancing (35%)\n\nRisk level: MEDIUM. Good entry if bonding curve doesn't exceed 40%.",
  "score": 82,
  "breakdown": {
    "momentum": 25,
    "holders": 20,
    "devSafety": 20,
    "bondingCurve": 12,
    "social": 5
  }
}
```

---

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('wss://api.sniperai.app/ws', {
  headers: { Authorization: 'Bearer <jwt>' }
});
```

### Subscribe to Token Feed
```json
// Client → Server
{ "type": "subscribe", "channel": "token_feed", "minScore": 60 }

// Server → Client (real-time, every new token)
{
  "type": "new_token",
  "data": {
    "mint": "AbC123...",
    "symbol": "DOGE2",
    "score": 82,
    "decision": "SNIPE",
    "marketCapSol": 12.4,
    "buyCount5m": 34,
    "detectedAt": "2025-08-15T14:32:01.000Z"
  }
}
```

### Subscribe to Position Updates
```json
// Client → Server
{ "type": "subscribe", "channel": "positions" }

// Server → Client (every price check cycle)
{
  "type": "position_update",
  "data": {
    "mint": "AbC123...",
    "currentPriceSol": 0.000068,
    "currentMultiple": 1.62,
    "pnlPct": 61.9,
    "peakMultiple": 1.85
  }
}
```

### Subscribe to Alerts
```json
// Client → Server
{ "type": "subscribe", "channel": "alerts" }

// Server → Client
{
  "type": "alert",
  "severity": "high",
  "data": {
    "alertType": "rug_detected",
    "mint": "...",
    "symbol": "SCAM",
    "message": "Dev dumped 60% of holdings — emergency exit recommended",
    "action": "sell_now"
  }
}
```

### Score Update (when token's score changes significantly)
```json
{
  "type": "score_update",
  "data": {
    "mint": "AbC123...",
    "oldScore": 72,
    "newScore": 85,
    "reason": "Buy pressure increased to 85%"
  }
}
```

---

## Error Handling

All errors follow this format:
```json
{
  "error": true,
  "code": "INSUFFICIENT_BALANCE",
  "message": "Not enough SOL. Need 0.6, have 0.3",
  "details": { "required": 0.6, "available": 0.3 }
}
```

### Error Codes:
| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_REQUIRED` | 401 | Missing or invalid JWT |
| `AUTH_EXPIRED` | 401 | JWT expired, re-authenticate |
| `RATE_LIMITED` | 429 | Too many requests |
| `INSUFFICIENT_BALANCE` | 400 | Not enough SOL |
| `RISK_BLOCKED` | 403 | Risk check failed (daily limit, max positions) |
| `TOKEN_NOT_FOUND` | 404 | Token mint not in our database |
| `TX_FAILED` | 500 | Transaction execution failed |
| `TX_EXPIRED` | 400 | Prepared transaction expired |
| `POSITION_NOT_FOUND` | 404 | No open position for this mint |

---

## Rate Limits

| Tier | Requests/min | WebSocket connections |
|------|-------------|---------------------|
| Free | 30 | 1 |
| Premium | 120 | 3 |
| API Key | 300 | 10 |

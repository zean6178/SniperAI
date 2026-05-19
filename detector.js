/**
 * detector.js — Token Detection Engine with Hybrid Merger
 * 
 * Real-time listener untuk token baru di Pump.fun via PumpPortal WebSocket.
 * Dilengkapi hybrid merger: Signal Server (api.thecharon.xyz) + Jupiter Trending.
 * 
 * Fixes:
 *   - TOKEN_DEDUP_WINDOW_MS broken (was `***`)
 *   - Added WebSocket ping/pong untuk menjaga koneksi
 *   - Added exponential backoff reconnect
 *   - Integrated merger.js untuk multi-source scoring
 */

import WebSocket from 'ws';
import chalk from 'chalk';
import { getConfig } from './config.js';
import { onWsToken, onServerSignal, onTrendingData } from './merger.js';
import { isDeployerBlacklisted, isTokenBlacklisted } from './state.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PUMP.FUN WEBSOCKET LISTENER
// ═══════════════════════════════════════════════════════════════════════════════

const PUMPPORTAL_WSS = 'wss://pumpportal.fun/api/data';

let ws = null;
let reconnectAttempts = 0;
let pingInterval = null;
const MAX_RECONNECT = 10;
const RECONNECT_DELAY_MS = 3000;
const PING_INTERVAL_MS = 15_000; // Ping setiap 15 detik biar koneksi stay alive

// Dedup — cegah token sama masuk 2x
const recentTokens = new Map();
const TOKEN_DEDUP_WINDOW_MS = 60_000; // ✅ FIXED: was `***`

// Trade tracker buat momentum / bundle detection
const tradeTracker = new Map();

// ─── Event callbacks ──────────────────────────────────────────────────────────
let onNewToken = null;

export function setOnNewToken(callback) {
  onNewToken = callback;
}

// ─── Start / Stop ─────────────────────────────────────────────────────────────
export function startDetector() {
  console.log(chalk.cyan('[detector] 🔌 Connecting to PumpPortal WebSocket...'));
  connect();

  // Start hybrid polling (Signal Server + Trending)
  if (getConfig().hybrid?.enabled) {
    startHybridPolling();
  }
}

export function stopDetector() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  console.log(chalk.yellow('[detector] 🔌 Disconnected'));
}

// ─── WebSocket Connection ─────────────────────────────────────────────────────
function connect() {
  ws = new WebSocket(PUMPPORTAL_WSS);

  ws.on('open', () => {
    reconnectAttempts = 0;
    console.log(chalk.green('[detector] ✅ Connected to PumpPortal'));

    // Subscribe
    ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
    ws.send(JSON.stringify({ method: 'subscribeTokenTrade' }));
    console.log(chalk.green('[detector] 📡 Subscribed to new tokens & trades'));

    // Start ping/pong
    pingInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, PING_INTERVAL_MS);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(msg);
    } catch (e) {
      // Parse errors — skip
    }
  });

  ws.on('ping', () => {
    // PumpPortal might send ping — respond
    if (ws?.readyState === WebSocket.OPEN) {
      ws.pong();
    }
  });

  ws.on('pong', () => {
    // Connection confirmed alive
  });

  ws.on('error', (err) => {
    console.error(chalk.red(`[detector] WebSocket error: ${err.message}`));
  });

  ws.on('close', () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    console.warn(chalk.yellow('[detector] WebSocket closed'));
    attemptReconnect();
  });
}

function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT) {
    console.error(chalk.red('[detector] ❌ Max reconnect attempts reached. Stopping.'));
    return;
  }
  reconnectAttempts++;
  const delay = RECONNECT_DELAY_MS * reconnectAttempts;
  console.log(chalk.yellow(`[detector] Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttempts})`));
  setTimeout(connect, delay);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

function handleMessage(msg) {
  if (msg.txType === 'create' || msg.type === 'newToken') {
    handleNewToken(msg);
    return;
  }
  if (msg.txType === 'buy' || msg.txType === 'sell') {
    handleTrade(msg);
    return;
  }
}

// ─── Handle new token ─────────────────────────────────────────────────────────
async function handleNewToken(msg) {
  const config = getConfig();

  const tokenData = {
    mint:             msg.mint || msg.tokenMint || msg.token,
    name:             msg.name || msg.tokenName || 'Unknown',
    symbol:           msg.symbol || msg.tokenSymbol || '???',
    deployer:         msg.traderPublicKey || msg.deployer || msg.creator,
    bondingCurve:     msg.bondingCurveKey || msg.bondingCurve,
    uri:              msg.uri || msg.metadataUri || '',
    initialBuySol:    parseFloat(msg.initialBuy || msg.solAmount || 0) / 1e9,
    marketCapSol:     parseFloat(msg.marketCapSol || msg.vSolInBondingCurve || 0),
    timestamp:        msg.timestamp || Date.now(),
    signature:        msg.signature || msg.txSignature || '',
    createdAt:        new Date().toISOString(),
  };

  // Pre-filters — sebelum masuk merger
  if (recentTokens.has(tokenData.mint)) return;
  recentTokens.set(tokenData.mint, Date.now());
  cleanupDedup();

  if (config.screening?.useDeployerBlacklist && isDeployerBlacklisted(tokenData.deployer)) {
    console.log(chalk.gray(`[detector] ⛔ Skipped (deployer blacklisted): ${tokenData.symbol}`));
    return;
  }
  if (config.screening?.useTokenBlacklist && isTokenBlacklisted(tokenData.mint)) {
    console.log(chalk.gray(`[detector] ⛔ Skipped (token blacklisted): ${tokenData.symbol}`));
    return;
  }
  if (tokenData.initialBuySol > 10) {
    console.log(chalk.gray(`[detector] ⚠️ Skipped (dev bought ${tokenData.initialBuySol.toFixed(2)} SOL = insider): ${tokenData.symbol}`));
    return;
  }

  console.log(chalk.magenta(
    `[detector] 🆕 NEW TOKEN: ${tokenData.symbol} (${tokenData.name}) | ` +
    `Dev: ${tokenData.deployer?.slice(0, 8)}… | ` +
    `InitBuy: ${tokenData.initialBuySol.toFixed(3)} SOL`
  ));

  // Hybrid mode → masuk ke merger
  if (config.hybrid?.enabled) {
    onWsToken(tokenData);
    return;
  }

  // Fallback mode → langsung screening
  if (onNewToken) {
    onNewToken(tokenData);
  }
}

// ─── Handle trade ─────────────────────────────────────────────────────────────
function handleTrade(msg) {
  const mint = msg.mint || msg.tokenMint;
  if (!mint) return;

  const trade = {
    type:      msg.txType,
    solAmount: parseFloat(msg.solAmount || 0) / 1e9,
    tokenAmt:  parseFloat(msg.tokenAmount || 0),
    wallet:    msg.traderPublicKey || '',
    timestamp: Date.now(),
    mcapSol:   parseFloat(msg.marketCapSol || 0),
  };

  if (!tradeTracker.has(mint)) {
    tradeTracker.set(mint, { buys: [], sells: [], firstSeen: Date.now() });
  }

  const tracker = tradeTracker.get(mint);
  if (trade.type === 'buy') tracker.buys.push(trade);
  else tracker.sells.push(trade);
  tracker.lastUpdate = Date.now();

  // Cleanup
  if (tradeTracker.size > 500) {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [key, val] of tradeTracker) {
      if (val.lastUpdate < cutoff) tradeTracker.delete(key);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HYBRID POLLING — Signal Server + Jupiter Trending
// ═══════════════════════════════════════════════════════════════════════════════

function startHybridPolling() {
  const hy = getConfig().hybrid;

  if (hy.signalServerUrl) {
    console.log(chalk.cyan(`[hybrid] 🔄 Signal server: ${hy.signalServerUrl} (every ${hy.signalPollMs / 1000}s)`));
    fetchSignalServer();
    setInterval(fetchSignalServer, hy.signalPollMs);
  }

  if (hy.trendingEnabled) {
    console.log(chalk.cyan(`[hybrid] 📈 Jupiter Trending (every ${hy.trendingPollMs / 1000}s)`));
    fetchTrending();
    setInterval(fetchTrending, hy.trendingPollMs);
  }
}

// ─── Signal Server — api.thecharon.xyz ────────────────────────────────────────
async function fetchSignalServer() {
  const hy = getConfig().hybrid;
  try {
    const url = new URL('/api/signals', hy.signalServerUrl);
    url.searchParams.set('limit', '100');
    url.searchParams.set('minSources', '1');

    const res = await fetch(url.toString(), {
      headers: hy.signalServerKey ? { 'x-api-key': hy.signalServerKey } : {},
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;

    const data = await res.json();
    const signals = data?.signals || [];

    for (const sig of signals) {
      if (!sig.mint) continue;
      onServerSignal(sig);
    }

    if (signals.length > 0) {
      console.log(chalk.gray(`[hybrid:server] ${signals.length} signals processed`));
    }
  } catch (e) {
    // Silent — network errors are normal
  }
}

// ─── Jupiter Trending API ────────────────────────────────────────────────────
async function fetchTrending() {
  const hy = getConfig().hybrid;
  try {
    const url = new URL(`https://api.jup.ag/tokens/v2/toptrending/${hy.trendingInterval}`);
    url.searchParams.set('limit', String(hy.trendingLimit));

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;

    const rows = await res.json();
    if (!Array.isArray(rows)) return;

    for (const [index, row] of rows.slice(0, 50).entries()) {
      const mint = row?.address || row?.mint;
      if (!mint || !String(mint).endsWith('pump')) continue;

      onTrendingData({
        ...row,
        address: mint,
        rank: index + 1,
        source: hy.trendingSource,
      });
    }
  } catch (e) {
    // Silent
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

function cleanupDedup() {
  const cutoff = Date.now() - TOKEN_DEDUP_WINDOW_MS;
  for (const [mint, ts] of recentTokens) {
    if (ts < cutoff) recentTokens.delete(mint);
  }
}

export function getTradeStats(mint, windowMs = 5 * 60 * 1000) {
  const tracker = tradeTracker.get(mint);
  if (!tracker) return null;

  const cutoff = Date.now() - windowMs;
  const recentBuys = tracker.buys.filter(t => t.timestamp > cutoff);
  const recentSells = tracker.sells.filter(t => t.timestamp > cutoff);

  const totalBuySol = recentBuys.reduce((s, t) => s + t.solAmount, 0);
  const totalSellSol = recentSells.reduce((s, t) => s + t.solAmount, 0);
  const uniqueBuyers = new Set(recentBuys.map(t => t.wallet)).size;

  // Bundle detection
  const bundleWindow = 2000;
  const firstBuyTime = recentBuys.length > 0 ? recentBuys[0].timestamp : 0;
  const bundleBuys = recentBuys.filter(t => t.timestamp - firstBuyTime < bundleWindow);
  const isBundled = bundleBuys.length > 3;

  const latestMcap = recentBuys.length > 0
    ? recentBuys[recentBuys.length - 1].mcapSol
    : recentSells.length > 0
      ? recentSells[recentSells.length - 1].mcapSol
      : 0;

  return {
    buyCount:     recentBuys.length,
    sellCount:    recentSells.length,
    totalBuySol,
    totalSellSol,
    uniqueBuyers,
    buyPressure:  totalBuySol > 0 ? totalBuySol / (totalBuySol + totalSellSol) : 0,
    isBundled,
    bundleCount:  bundleBuys.length,
    latestMcapSol: latestMcap,
    timeSinceFirstBuyMs: Date.now() - (tracker.firstSeen || Date.now()),
  };
}

export function getDetectorStatus() {
  return {
    connected:       ws?.readyState === WebSocket.OPEN,
    trackedTokens:   tradeTracker.size,
    recentTokens:    recentTokens.size,
    reconnectAttempts,
  };
}

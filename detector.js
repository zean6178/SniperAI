/**
 * detector.js
 * Token Detection Engine — Real-time listener untuk token baru di Pump.fun
 * 
 * Menggunakan PumpPortal WebSocket untuk detect token baru secara instan.
 * Setiap token baru akan di-pass ke screening pipeline.
 */

import WebSocket from 'ws';
import chalk from 'chalk';
import { getConfig } from './config.js';
import { isDeployerBlacklisted, isTokenBlacklisted } from './state.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PUMP.FUN WEBSOCKET LISTENER
// ═══════════════════════════════════════════════════════════════════════════════

const PUMPPORTAL_WSS = 'wss://pumpportal.fun/api/data';
const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;
const RECONNECT_DELAY_MS = 3000;

// Track recently seen tokens (dedup)
const recentTokens = new Map(); // mint → timestamp
const TOKEN_DEDUP_WINDOW_MS = 60_000; // 1 menit

// ─── Event callbacks ──────────────────────────────────────────────────────────
let onNewToken = null;

export function setOnNewToken(callback) {
  onNewToken = callback;
}

// ─── Start WebSocket listener ─────────────────────────────────────────────────
export function startDetector() {
  console.log(chalk.cyan('[detector] 🔌 Connecting to PumpPortal WebSocket...'));
  connect();
}

export function stopDetector() {
  if (ws) {
    ws.close();
    ws = null;
  }
  console.log(chalk.yellow('[detector] 🔌 Disconnected'));
}

function connect() {
  ws = new WebSocket(PUMPPORTAL_WSS);

  ws.on('open', () => {
    reconnectAttempts = 0;
    console.log(chalk.green('[detector] ✅ Connected to PumpPortal'));

    // Subscribe ke new token creations
    ws.send(JSON.stringify({
      method: 'subscribeNewToken',
    }));

    // Subscribe ke trades (untuk volume tracking)
    ws.send(JSON.stringify({
      method: 'subscribeTokenTrade',
    }));

    console.log(chalk.green('[detector] 📡 Subscribed to new tokens & trades'));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(msg);
    } catch (e) {
      // Ignore parse errors
    }
  });

  ws.on('error', (err) => {
    console.error(chalk.red(`[detector] WebSocket error: ${err.message}`));
  });

  ws.on('close', () => {
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
  // ── New Token Created ──────────────────────────────────────────────────────
  if (msg.txType === 'create' || msg.type === 'newToken') {
    handleNewToken(msg);
    return;
  }

  // ── Trade event (buy/sell) ─────────────────────────────────────────────────
  if (msg.txType === 'buy' || msg.txType === 'sell') {
    handleTrade(msg);
    return;
  }
}

// ─── Handle new token creation ────────────────────────────────────────────────
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

  // ── Quick pre-filters (sebelum screening berat) ────────────────────────────

  // 1. Dedup check
  if (recentTokens.has(tokenData.mint)) return;
  recentTokens.set(tokenData.mint, Date.now());
  cleanupDedup();

  // 2. Blacklist check
  if (config.screening.useDeployerBlacklist && isDeployerBlacklisted(tokenData.deployer)) {
    console.log(chalk.gray(`[detector] ⛔ Skipped (deployer blacklisted): ${tokenData.symbol}`));
    return;
  }

  if (config.screening.useTokenBlacklist && isTokenBlacklisted(tokenData.mint)) {
    console.log(chalk.gray(`[detector] ⛔ Skipped (token blacklisted): ${tokenData.symbol}`));
    return;
  }

  // 3. Dev initial buy terlalu besar? (potential insider)
  if (tokenData.initialBuySol > 10) {
    console.log(chalk.gray(`[detector] ⚠️ Skipped (dev bought ${tokenData.initialBuySol.toFixed(2)} SOL = potential insider): ${tokenData.symbol}`));
    return;
  }

  // ── Log detection ──────────────────────────────────────────────────────────
  console.log(chalk.magenta(
    `[detector] 🆕 NEW TOKEN: ${tokenData.symbol} (${tokenData.name}) | ` +
    `Dev: ${tokenData.deployer?.slice(0, 8)}… | ` +
    `InitBuy: ${tokenData.initialBuySol.toFixed(3)} SOL`
  ));

  // ── Forward ke screening pipeline ─────────────────────────────────────────
  if (onNewToken) {
    onNewToken(tokenData);
  }
}

// ─── Handle trade events (untuk tracking volume & momentum) ───────────────────
const tradeTracker = new Map(); // mint → { buys: [], sells: [], lastUpdate }

function handleTrade(msg) {
  const mint = msg.mint || msg.tokenMint;
  if (!mint) return;

  const trade = {
    type:      msg.txType,           // 'buy' | 'sell'
    solAmount: parseFloat(msg.solAmount || 0) / 1e9,
    tokenAmt:  parseFloat(msg.tokenAmount || 0),
    wallet:    msg.traderPublicKey || '',
    timestamp: Date.now(),
    mcapSol:   parseFloat(msg.marketCapSol || 0),
    newTokenBalance: parseFloat(msg.newTokenBalance || 0),
  };

  if (!tradeTracker.has(mint)) {
    tradeTracker.set(mint, { buys: [], sells: [], firstSeen: Date.now() });
  }

  const tracker = tradeTracker.get(mint);
  if (trade.type === 'buy') {
    tracker.buys.push(trade);
  } else {
    tracker.sells.push(trade);
  }
  tracker.lastUpdate = Date.now();

  // Cleanup old trackers (>5 min)
  if (tradeTracker.size > 500) {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [key, val] of tradeTracker) {
      if (val.lastUpdate < cutoff) tradeTracker.delete(key);
    }
  }
}

// ─── Get trade stats untuk token tertentu ─────────────────────────────────────
export function getTradeStats(mint, windowMs = 5 * 60 * 1000) {
  const tracker = tradeTracker.get(mint);
  if (!tracker) return null;

  const cutoff = Date.now() - windowMs;

  const recentBuys = tracker.buys.filter(t => t.timestamp > cutoff);
  const recentSells = tracker.sells.filter(t => t.timestamp > cutoff);

  const totalBuySol = recentBuys.reduce((sum, t) => sum + t.solAmount, 0);
  const totalSellSol = recentSells.reduce((sum, t) => sum + t.solAmount, 0);
  const uniqueBuyers = new Set(recentBuys.map(t => t.wallet)).size;
  const uniqueSellers = new Set(recentSells.map(t => t.wallet)).size;

  // Detect bundle (banyak wallet beli di waktu sangat dekat)
  const bundleWindow = 2000; // 2 detik
  const firstBuyTime = recentBuys.length > 0 ? recentBuys[0].timestamp : 0;
  const bundleBuys = recentBuys.filter(t => t.timestamp - firstBuyTime < bundleWindow);
  const isBundled = bundleBuys.length > 3; // >3 wallet beli dalam 2 detik

  // Latest market cap
  const latestMcap = recentBuys.length > 0
    ? recentBuys[recentBuys.length - 1].mcapSol
    : recentSells.length > 0
      ? recentSells[recentSells.length - 1].mcapSol
      : 0;

  return {
    buyCount:      recentBuys.length,
    sellCount:     recentSells.length,
    totalBuySol,
    totalSellSol,
    uniqueBuyers,
    uniqueSellers,
    buyPressure:   totalBuySol > 0 ? totalBuySol / (totalBuySol + totalSellSol) : 0,
    isBundled,
    bundleCount:   bundleBuys.length,
    latestMcapSol: latestMcap,
    timeSinceFirstBuyMs: Date.now() - (tracker.firstSeen || Date.now()),
  };
}

// ─── Cleanup dedup map ────────────────────────────────────────────────────────
function cleanupDedup() {
  const cutoff = Date.now() - TOKEN_DEDUP_WINDOW_MS;
  for (const [mint, ts] of recentTokens) {
    if (ts < cutoff) recentTokens.delete(mint);
  }
}

// ─── Get detector status ──────────────────────────────────────────────────────
export function getDetectorStatus() {
  return {
    connected:     ws?.readyState === WebSocket.OPEN,
    trackedTokens: tradeTracker.size,
    recentTokens:  recentTokens.size,
    reconnectAttempts,
  };
}

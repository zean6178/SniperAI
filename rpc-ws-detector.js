/**
 * rpc-ws-detector.js
 * RPC WebSocket logsSubscribe — Real-time token detection via raw RPC
 * 
 * Subscribe ke logs dari Pump program melalui RPC WebSocket.
 * Setiap ada "Instruction: Create" → ekstrak signature → parse transaction
 * → ambil dev buy SOL, creator wallet, block time → feed ke merger.
 * 
 * Signal source ke-4 — independen dari PumpPortal API.
 * 
 * Approach:
 *   1. Connect RPC WS → send logsSubscribe(mentions: [PUMP_PROGRAM_ID])
 *   2. Filter logsNotification dengan "Instruction: Create"
 *   3. getTransaction(sig) → extract mint, creator, dev buy SOL
 *   4. Emit ke merger pipeline via onWsToken (format kompatibel)
 */

import WebSocket from 'ws';
import chalk from 'chalk';
import { getConfig } from './config.js';
import { onWsToken } from './merger.js';
import { isDeployerBlacklisted, isTokenBlacklisted } from './state.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

let ws = null;
let pingInterval = null;
let reconnectAttempts = 0;
// ⭐ Gak ada max — reconnect forever biar RPC WS tetep eventual fallback
const MAX_RECONNECT = Infinity;
// ⭐ Backoff lebih agresif: 5s → 60s dengan jitter biar gak flood QuickNode
const BASE_RECONNECT_MS = 5000;

// Dedup — cegah signature/token sama masuk 2x
const _seenSignatures = new Set();
const _recentTokens = new Map(); // mint → timestamp
const TOKEN_DEDUP_MS = 60_000;
const SIG_DEDUP_MS = 30_000; // Signature dedup lebih pendek

// Subscription ID tracker
let _subId = null;

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

export function startRpcDetector() {
  const config = getConfig();
  if (!config.hybrid?.enabled || !config.hybrid.rpcWs?.enabled) return;

  const wsUrl = _resolveWsUrl();
  if (!wsUrl) {
    console.warn(chalk.yellow('[rpc-ws] ⚠️ No WS URL available — RPC WS detector disabled'));
    return;
  }

  console.log(chalk.cyan(`[rpc-ws] 🔌 Connecting to RPC WebSocket for logsSubscribe...`));
  _connect(wsUrl);
}

export function stopRpcDetector() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (ws) {
    try { ws.close(); } catch (_) {}
    ws = null;
  }
  _subId = null;
  console.log(chalk.yellow('[rpc-ws] 🔌 Disconnected'));
}

export function getRpcWsStatus() {
  return {
    connected: ws?.readyState === WebSocket.OPEN,
    subscribed: _subId !== null,
    reconnectAttempts,
    sigCacheSize: _seenSignatures.size,
    dedupSize: _recentTokens.size,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL
// ═══════════════════════════════════════════════════════════════════════════════

function _resolveWsUrl() {
  // Priority 1: explicit RPC_WS_URL from env
  if (process.env.RPC_WS_URL) return process.env.RPC_WS_URL;
  // Priority 2: RPC_WSS_URL (triple-ws variant, like QuickNode uses)
  if (process.env.RPC_WSS_URL) return process.env.RPC_WSS_URL;

  // Priority 2: derive from RPC_URL (https → wss)
  const rpcUrl = process.env.RPC_URL;
  if (rpcUrl) {
    // Support Helius/Alchemy/QuickNode format
    let wsUrl = rpcUrl.replace(/^https:\/\//i, 'wss://');
    wsUrl = wsUrl.replace(/^http:\/\//i, 'ws://');
    return wsUrl;
  }

  return null;
}

function _connect(url) {
  try {
    ws = new WebSocket(url);

    ws.on('open', () => {
      reconnectAttempts = 0;
      console.log(chalk.green('[rpc-ws] ✅ Connected to RPC WebSocket'));

      // Kirim logsSubscribe
      _sendSubscribe();

      // ⭐ Ping every 15s biar koneksi stay alive (QuickNode/Helius gak suka idle)
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 15_000);
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        _handleMessage(msg);
      } catch (e) {
        // Parse error — skip
      }
    });

    ws.on('ping', () => {
      if (ws?.readyState === WebSocket.OPEN) ws.pong();
    });

    ws.on('pong', () => {
      // Connection alive
    });

    ws.on('error', (err) => {
      console.warn(chalk.yellow(`[rpc-ws] WebSocket error: ${err.message}`));
    });

    ws.on('close', (code, reason) => {
      console.warn(chalk.yellow(`[rpc-ws] WebSocket closed (code: ${code}, reason: ${reason?.toString() || 'none'})`));
      _attemptReconnect(url);
    });

  } catch (e) {
    console.warn(chalk.yellow(`[rpc-ws] Connection error: ${e.message}`));
    _attemptReconnect(url);
  }
}

function _sendSubscribe() {
  if (ws?.readyState !== WebSocket.OPEN) return;

  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'logsSubscribe',
    params: [
      { mentions: [PUMP_PROGRAM_ID] },
      { commitment: 'processed' },
    ],
  };

  ws.send(JSON.stringify(payload));
}

function _attemptReconnect(url) {
  if (reconnectAttempts >= MAX_RECONNECT) {
    console.error(chalk.red('[rpc-ws] ❌ Max reconnect attempts reached. Stopping.'));
    return;
  }
  reconnectAttempts++;
  const baseDelay = Math.min(BASE_RECONNECT_MS * reconnectAttempts, 60_000);
  // ⭐ Jitter: +0-30% acak biar gak flood RPC pas reconnect massal
  const jitter = 1 + (Math.random() * 0.3);
  const delay = Math.floor(baseDelay * jitter);
  console.log(chalk.yellow(`[rpc-ws] Reconnecting in ${(delay / 1000).toFixed(0)}s... (attempt ${reconnectAttempts})`));
  setTimeout(() => _connect(url), delay);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

function _handleMessage(msg) {
  // Handle subscription response
  if (msg.id === 1 && msg.result !== undefined) {
    _subId = msg.result;
    console.log(chalk.green(`[rpc-ws] ✅ logsSubscribe active (sub_id: ${msg.result})`));
    return;
  }

  // Handle logs notification
  if (msg.method !== 'logsNotification') return;

  const params = msg.params;
  if (!params) return;

  const result = params.result || params;
  const value = result.value || result;

  // Skip error transactions
  if (value.err) return;

  // Check logs untuk "Instruction: Create"
  const logs = value.logs || [];
  const hasCreate = logs.some(log => typeof log === 'string' && log.includes('Instruction: Create'));
  if (!hasCreate) return;

  // Extract signature
  const signature = value.signature;
  if (!signature) return;

  // Dedup signature
  if (_seenSignatures.has(signature)) return;
  _seenSignatures.add(signature);

  // Process — fetch transaction data
  _processCreateTransaction(signature);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION PARSER — Ambil mint, creator, dev buy SOL dari create tx
// ═══════════════════════════════════════════════════════════════════════════════

async function _processCreateTransaction(signature) {
  try {
    // Pake HTTP RPC buat getTransaction (WS gak support getTransaction)
    const txData = await _fetchTransaction(signature);
    if (!txData) return;

    // Parse dari transaction data
    const parsed = _parseCreateTx(txData, signature);
    if (!parsed) return;

    const { mint, creator, devBuySol, blockTime } = parsed;

    // Dedup — cek apakah mint ini udah masuk (dari PumpPortal atau source lain)
    if (_recentTokens.has(mint)) return;
    _recentTokens.set(mint, Date.now());
    _pruneDedup();

    // Pre-filter
    const config = getConfig();
    if (config.screening?.useDeployerBlacklist && isDeployerBlacklisted(creator)) {
      console.log(chalk.gray(`[rpc-ws] ⛔ Skipped (deployer blacklisted): ${mint.slice(0, 8)}…`));
      return;
    }
    if (config.screening?.useTokenBlacklist && isTokenBlacklisted(mint)) {
      console.log(chalk.gray(`[rpc-ws] ⛔ Skipped (token blacklisted): ${mint.slice(0, 8)}…`));
      return;
    }

    // Filter insider: dev buy > 10 SOL = kemungkinan insider/sniping sendiri
    if (devBuySol > 10) {
      console.log(chalk.gray(`[rpc-ws] ⚠️ Skipped (dev bought ${devBuySol.toFixed(2)} SOL = insider): ${mint.slice(0, 8)}…`));
      return;
    }

    console.log(chalk.magenta(
      `[rpc-ws] 🆕 NEW TOKEN via RPC: ${mint.slice(0, 8)}… | ` +
      `Dev: ${creator?.slice(0, 8)}… | ` +
      `DevBuy: ${devBuySol?.toFixed(4) || '?'} SOL | ` +
      `Age: ${blockTime ? ((Date.now() / 1000) - blockTime).toFixed(0) : '?'}s`
    ));

    // Format untuk merger — format kompatibel dengan onWsToken
    const tokenData = {
      mint,
      name: '',
      symbol: mint.slice(0, 8),
      deployer: creator || '',
      bondingCurve: '',
      uri: '',
      initialBuySol: devBuySol || 0,
      marketCapSol: 0,
      timestamp: blockTime ? blockTime * 1000 : Date.now(),
      signature,
      createdAt: new Date().toISOString(),
      // Flag asal dari RPC WS
      _source: 'rpc-ws',
    };

    // Feed ke merger pipeline
    if (config.hybrid?.enabled) {
      onWsToken(tokenData);
    }
    // Non-hybrid: silent — merger disabled berarti gak ada pipeline yang handle

    // Prune signature cache
    _pruneSigCache();

  } catch (e) {
    console.warn(chalk.yellow(`[rpc-ws] Error processing ${signature.slice(0, 8)}…: ${e.message}`));
  }
}

/**
 * Fetch transaction via RPC HTTP — parse sendiri untuk extract detail create
 */
async function _fetchTransaction(signature) {
  const rpcUrl = process.env.RPC_URL || getConfig().rpcUrl;
  if (!rpcUrl) return null;

  try {
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'getTransaction',
      params: [
        signature,
        {
          encoding: 'jsonParsed',
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        },
      ],
    };

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.result || null;
  } catch (e) {
    console.warn(chalk.gray(`[rpc-ws] fetchTransaction error: ${e.message}`));
    return null;
  }
}

/**
 * Parse create transaction → extract mint, creator, dev buy SOL
 * 
 * Pump.fun create instruction account mapping (dari reverse engineering):
 *   accounts[0] = mint (token address, .pump)
 *   accounts[5] = user (creator wallet)
 *   accounts[4] = bonding curve
 * 
 * Dev buy SOL = selisih SOL balance creator sebelum & sesudah tx
 * (termasuk biaya create + buy pertama)
 */
function _parseCreateTx(txData, signature) {
  if (!txData) return null;

  const tx = txData.transaction || {};
  const message = tx.message || {};
  const meta = txData.meta || {};

  // Normalize account keys
  const accountKeys = message.accountKeys || [];
  const keys = accountKeys.map(k => {
    if (typeof k === 'string') return k;
    if (typeof k === 'object' && k) return k.pubkey || '';
    return '';
  }).filter(Boolean);

  // Cari instruction ke Pump program
  const instructions = message.instructions || [];
  let pumpIx = null;
  for (const ix of instructions) {
    const progId = typeof ix.programId === 'string' ? ix.programId
                 : keys[ix.programIdIndex] || '';
    if (progId === PUMP_PROGRAM_ID || progId.includes('6EF8')) {
      pumpIx = ix;
      break;
    }
  }

  if (!pumpIx) return null;

  // Resolve accounts dari instruction
  const ixAccounts = pumpIx.accounts || [];
  const resolvedAccounts = ixAccounts.map(idx => keys[idx]).filter(Boolean);

  const mint = resolvedAccounts[0] || null;
  const user = resolvedAccounts[5] || null;
  const blockTime = txData.blockTime || null;

  if (!mint) return null;

  // Estimate dev buy SOL dari balance change
  let devBuySol = null;
  if (user) {
    const userIdx = keys.indexOf(user);
    if (userIdx >= 0) {
      const preBal = meta.preBalances || [];
      const postBal = meta.postBalances || [];
      if (userIdx < preBal.length && userIdx < postBal.length) {
        const spentLamports = Math.max(0, Number(preBal[userIdx]) - Number(postBal[userIdx]));
        devBuySol = spentLamports / 1_000_000_000;
      }
    }
  }

  return { mint, creator: user, devBuySol, blockTime };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE MAINTENANCE
// ═══════════════════════════════════════════════════════════════════════════════

function _pruneSigCache() {
  if (_seenSignatures.size < 10_000) return;
  _seenSignatures.clear();
  console.log(chalk.gray('[rpc-ws] Pruned signature cache'));
}

function _pruneDedup() {
  const cutoff = Date.now() - TOKEN_DEDUP_MS;
  for (const [mint, ts] of _recentTokens) {
    if (ts < cutoff) _recentTokens.delete(mint);
  }
}

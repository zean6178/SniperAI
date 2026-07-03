/**
 * state.js
 * State management — tracks open positions, daily stats, trade history
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_PATH = resolve(__dirname, 'state.json');

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY CACHE — Hindari baca disk tiap function call
// ═══════════════════════════════════════════════════════════════════════════════
let _cachedState = null;
let _lastSave = 0;
const SAVE_DEBOUNCE_MS = 2000; // Nulis ke disk max tiap 2 detik
const CACHE_TTL_MS = 2000;     // Baca dari cache selama 2 detik

let _lastLoad = 0;

// ─── Default State ────────────────────────────────────────────────────────────
const DEFAULT_STATE = {
  positions: {},          // tokenMint → position data
  closedToday: [],        // closed positions hari ini
  tradeHistory: [],       // all-time trade log (last 500)
  totalTradesCount: 0,    // all-time trade counter (never trimmed)
  dailyStats: {
    date: null,
    tradesCount: 0,
    wins: 0,
    losses: 0,
    totalPnlSol: 0,
    totalBuySol: 0,
    totalSellSol: 0,
  },
  blacklistedDeployers: [],
  blacklistedTokens: [],
};

// ─── Load / Save ──────────────────────────────────────────────────────────────
function deepCloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function loadState() {
  const now = Date.now();

  // Return cached state kalo masih fresh
  if (_cachedState && (now - _lastLoad) < CACHE_TTL_MS) {
    return _cachedState;
  }

  if (!existsSync(STATE_PATH)) {
    _cachedState = deepCloneDefault();
    _lastLoad = now;
    return _cachedState;
  }

  try {
    const raw = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    // Reset daily stats if new day
    const today = dayjs().format('YYYY-MM-DD');
    if (raw.dailyStats?.date !== today) {
      raw.dailyStats = { ...DEFAULT_STATE.dailyStats, date: today };
      raw.closedToday = [];
    }
    const defaults = deepCloneDefault();
    _cachedState = { ...defaults, ...raw };
    // Migrasi: kalau totalTradesCount belum ada, init dari tradeHistory.length
    if (_cachedState.totalTradesCount === undefined || _cachedState.totalTradesCount === 0) {
      _cachedState.totalTradesCount = raw.tradeHistory?.length || 0;
    }
    _lastLoad = now;
    return _cachedState;
  } catch {
    _cachedState = deepCloneDefault();
    _lastLoad = now;
    return _cachedState;
  }
}

function saveState(state, force = false) {
  _cachedState = state;
  const now = Date.now();

  // Debounce: jangan nulis ke disk kalo baru aja nulis (kecuali force)
  if (!force && now - _lastSave < SAVE_DEBOUNCE_MS) return;

  try {
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    _lastSave = now;
  } catch (e) {
    console.warn(`[state] Write failed: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Positions ────────────────────────────────────────────────────────────────
export function getOpenPositions() {
  return loadState().positions;
}

export function getOpenPositionCount() {
  return Object.keys(loadState().positions).length;
}

export function getPosition(tokenMint) {
  return loadState().positions[tokenMint] || null;
}

export function savePosition(tokenMint, positionData) {
  const state = loadState();
  state.positions[tokenMint] = {
    ...positionData,
    tokenMint,
    openedAt: positionData.openedAt || new Date().toISOString(),
    peakPriceSol: positionData.entryPriceSol || 0,
    peakMcapSol: positionData.entryMcapSol || 0,
    peakMultiple: 1.0,
    soldPct: 0,
    sellHistory: [],
    useBondingCurve: false,   // hybrid bonding curve — auto-ON jika terdeteksi aktivitas
  };
  saveState(state, true); // ⭐ force = langsung nulis
}

export function updatePosition(tokenMint, updates) {
  const state = loadState();
  if (!state.positions[tokenMint]) return null;
  Object.assign(state.positions[tokenMint], updates);
  saveState(state);
  return state.positions[tokenMint];
}

export function closePosition(tokenMint, closeData = {}) {
  const state = loadState();
  const position = state.positions[tokenMint];
  if (!position) return null;

  const closed = {
    ...position,
    ...closeData,
    closedAt: new Date().toISOString(),
  };

  // Move to closed
  state.closedToday.push(closed);
  state.tradeHistory.push(closed);
  // Keep last 500
  if (state.tradeHistory.length > 500) {
    state.tradeHistory = state.tradeHistory.slice(-500);
  }

  // Increment all-time counter (never trimmed)
  state.totalTradesCount = (state.totalTradesCount || 0) + 1;

  // Remove from open
  delete state.positions[tokenMint];

  // Update daily stats
  state.dailyStats.tradesCount++;
  const pnl = parseFloat(closeData.pnlSol || 0);
  state.dailyStats.totalPnlSol += pnl;
  if (pnl > 0) state.dailyStats.wins++;
  else state.dailyStats.losses++;

  saveState(state, true); // ⭐ force = langsung nulis
  return closed;
}

// ─── Daily Stats ──────────────────────────────────────────────────────────────
export function getDailyStats() {
  const state = loadState();
  const today = dayjs().format('YYYY-MM-DD');
  if (state.dailyStats.date !== today) {
    state.dailyStats = { ...DEFAULT_STATE.dailyStats, date: today };
    state.closedToday = [];
    saveState(state);
  }
  return state.dailyStats;
}

export function recordBuy(amountSol) {
  const state = loadState();
  state.dailyStats.totalBuySol += amountSol;
  saveState(state);
}

export function getWinRate() {
  const stats = getDailyStats();
  const total = stats.wins + stats.losses;
  if (total === 0) return 0;
  return ((stats.wins / total) * 100).toFixed(1);
}

// ─── Trade History ────────────────────────────────────────────────────────────
export function getTradeHistory(limit = 50) {
  return loadState().tradeHistory.slice(-limit);
}

export function getClosedToday() {
  return loadState().closedToday;
}

// ─── Blacklists ───────────────────────────────────────────────────────────────
export function addDeployerToBlacklist(address, reason = '') {
  const state = loadState();
  if (!state.blacklistedDeployers.find(d => d.address === address)) {
    state.blacklistedDeployers.push({ address, reason, addedAt: new Date().toISOString() });
    saveState(state);
  }
}

export function addTokenToBlacklist(mint, reason = '') {
  const state = loadState();
  if (!state.blacklistedTokens.find(t => t.mint === mint)) {
    state.blacklistedTokens.push({ mint, reason, addedAt: new Date().toISOString() });
    saveState(state);
  }
}

export function isDeployerBlacklisted(address) {
  return loadState().blacklistedDeployers.some(d => d.address === address);
}

export function isTokenBlacklisted(mint) {
  return loadState().blacklistedTokens.some(t => t.mint === mint);
}

export function getFullState() {
  return loadState();
}

export function getClosedCount() {
  return loadState().totalTradesCount || 0;
}

/**
 * Reset daily trades count to 0 — called when maxDailyTrades terpenuhi
 * biar bisa lanjut snipe tanpa restart bot.
 */
export function resetDailyTradesCount() {
  const state = loadState();
  state.dailyStats.tradesCount = 0;
  state.dailyStats.wins = 0;
  state.dailyStats.losses = 0;
  state.dailyStats.totalPnlSol = 0;
  state.closedToday = [];
  saveState(state, true);
  console.log('[state] 🔄 Daily trades count reset to 0 — snipe lanjut!');
}

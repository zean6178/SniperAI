/**
 * market-conditions.js
 * Dynamic market condition tracking for auto mode switching.
 * Tracks volatility (trade velocity), time-of-day patterns, and mode effectiveness.
 */

import chalk from 'chalk';
import { getConfig } from './config.js';
import { getTradeHistory } from './state.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE VELOCITY TRACKER — tracks token scan rate across last 50 tokens
// ═══════════════════════════════════════════════════════════════════════════════

const VELOCITY_WINDOW_MS = 5 * 60 * 1000; // 5 menit
const VELOCITY_MAX_ENTRIES = 50;

/** @type {number[]} timestamps of recent token scans */
const scanTimestamps = [];

/**
 * Record a token scan event (called each time a token flows through screening)
 */
export function recordTokenScan() {
  const now = Date.now();
  scanTimestamps.push(now);

  // Keep only entries within window + max count
  while (scanTimestamps.length > VELOCITY_MAX_ENTRIES) {
    scanTimestamps.shift();
  }

  // Purge entries older than window
  const cutoff = now - VELOCITY_WINDOW_MS;
  while (scanTimestamps.length > 0 && scanTimestamps[0] < cutoff) {
    scanTimestamps.shift();
  }
}

/**
 * Calculate tokens-per-minute velocity over current window
 * @returns {number}
 */
function calcVelocity() {
  if (scanTimestamps.length < 2) return 0;
  const now = Date.now();
  const oldest = scanTimestamps[0];
  const elapsedMin = (now - oldest) / 1000 / 60;
  if (elapsedMin < 0.01) return 0;
  return scanTimestamps.length / elapsedMin;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODE EFFECTIVENESS SCORE — tracks win/loss per mode
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * In-memory mode performance tracker (reset on bot restart, fine for short sessions)
 * Structure: { modeName: { wins: number, losses: number, streak: number } }
 */
const modePerformance = {
  early_snipe:   { wins: 0, losses: 0, streak: 0 },
  momentum_ride: { wins: 0, losses: 0, streak: 0 },
  curve_play:    { wins: 0, losses: 0, streak: 0 },
};

/**
 * Record a trade result for a given mode
 * @param {string} mode - 'early_snipe' | 'momentum_ride' | 'curve_play'
 * @param {'win'|'loss'} result
 */
export function recordModeResult(mode, result) {
  if (!modePerformance[mode]) return;
  if (result === 'win') {
    modePerformance[mode].wins++;
    modePerformance[mode].streak = Math.max(0, modePerformance[mode].streak + 1);
  } else {
    modePerformance[mode].losses++;
    modePerformance[mode].streak = Math.min(-1, modePerformance[mode].streak - 1);
  }
}

/**
 * Get win rate for a specific mode
 * @param {string} mode
 * @returns {number} 0-100
 */
function getModeWinRate(mode) {
  const perf = modePerformance[mode];
  if (!perf) return 50;
  const total = perf.wins + perf.losses;
  if (total === 0) return 50; // Neutral if no data
  return (perf.wins / total) * 100;
}

/**
 * Get the current loss streak for a specific mode
 * @param {string} mode
 * @returns {number} negative = loss streak, positive = win streak
 */
function getModeStreak(mode) {
  const perf = modePerformance[mode];
  return perf ? perf.streak : 0;
}

/**
 * Bootstrap mode performance from trade history on startup
 */
function bootstrapFromHistory() {
  try {
    const history = getTradeHistory(100);
    for (const trade of history) {
      if (trade.mode && modePerformance[trade.mode]) {
        const pnl = parseFloat(trade.pnlSol || 0);
        const result = pnl > 0 ? 'win' : 'loss';
        if (result === 'win') {
          modePerformance[trade.mode].wins++;
        } else {
          modePerformance[trade.mode].losses++;
        }
      }
    }
  } catch (e) {
    // Non-critical — modes start fresh
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME-OF-DAY ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current UTC hour bucket
 * @returns {string} 'low_activity' | 'medium_activity' | 'high_activity'
 */
function getTimeBucket() {
  const hour = new Date().getUTCHours();

  // 0-6 UTC — low activity (Asia/EU night)
  if (hour >= 0 && hour < 6) return 'low_activity';

  // 12-18 UTC — US hours (high activity)
  if (hour >= 12 && hour < 18) return 'high_activity';

  // 6-12 UTC (Asia/EU morning) and 18-24 (US evening) — medium
  return 'medium_activity';
}

/**
 * Get time-based preferred mode
 * @returns {string|null} mode name or null (no override)
 */
function getTimeBasedMode() {
  const bucket = getTimeBucket();
  const cfg = getConfig().screening.autoModeSwitch;
  if (!cfg?.enabled) return null;

  switch (bucket) {
    case 'low_activity':
      return 'curve_play'; // Hold longer when fewer tokens flowing
    case 'high_activity':
      return 'early_snipe'; // Fast snipes during high volume US hours
    case 'medium_activity':
    default:
      return null; // Let volatility decide
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current market conditions and recommended trade mode
 * @returns {{ volatility: 'high'|'medium'|'low', velocity: number, recommendedMode: string, reasons: string[] }}
 */
export function getMarketCondition() {
  const cfg = getConfig().screening.autoModeSwitch;
  if (!cfg?.enabled) {
    return { volatility: 'medium', velocity: 0, recommendedMode: null, reasons: ['Auto mode switch disabled'] };
  }

  const velocity = calcVelocity();
  const reasons = [];

  // ── 1. Volatility-based recommendation ──
  let volatility;
  let volMode = null;

  if (velocity > 10) {
    volatility = 'high';
    volMode = 'early_snipe';
    reasons.push(`⚡ High volatility (${velocity.toFixed(1)} t/min) → early_snipe`);
  } else if (velocity >= 3) {
    volatility = 'medium';
    volMode = 'momentum_ride';
    reasons.push(`📊 Medium volatility (${velocity.toFixed(1)} t/min) → momentum_ride`);
  } else {
    volatility = 'low';
    volMode = 'curve_play';
    reasons.push(`🐢 Low volatility (${velocity.toFixed(1)} t/min) → curve_play`);
  }

  // ── 2. Time-of-day override ──
  const timeMode = getTimeBasedMode();
  if (timeMode) {
    const bucket = getTimeBucket();
    reasons.push(`🕐 Time-of-day: ${bucket} → ${timeMode}`);
  }

  // ── 3. Mode effectiveness (win rate) — adapt if loss streak detected ──
  let recommendedMode = timeMode || volMode;

  if (cfg.adaptOnLoss && recommendedMode) {
    const streak = getModeStreak(recommendedMode);

    // If current recommended mode has a bad loss streak, switch away
    if (Math.abs(streak) >= cfg.lossStreakThreshold) {
      const winRate = getModeWinRate(recommendedMode);
      reasons.push(`⚠️ ${recommendedMode} on ${Math.abs(streak)}-loss streak (${winRate.toFixed(0)}% WR) — switching`);

      // Pick alternative with best win rate
      const alternatives = Object.keys(modePerformance).filter(m => m !== recommendedMode);
      let bestAlt = alternatives[0];
      let bestWr = -1;
      for (const alt of alternatives) {
        const wr = getModeWinRate(alt);
        if (wr > bestWr) {
          bestWr = wr;
          bestAlt = alt;
        }
      }
      recommendedMode = bestAlt;
      reasons.push(`🔄 Switched to ${bestAlt} (${bestWr.toFixed(0)}% WR)`);
    }

    // Also check if an alternative mode has significantly better win rate
    if (recommendedMode) {
      const currentWr = getModeWinRate(recommendedMode);
      for (const [mode, perf] of Object.entries(modePerformance)) {
        if (mode === recommendedMode) continue;
        const total = perf.wins + perf.losses;
        if (total >= 3) {
          const altWr = (perf.wins / total) * 100;
          // If alternative has >20% better win rate with at least 3 trades, consider switching
          if (altWr > currentWr + 20 && altWr >= 50) {
            reasons.push(`📈 ${mode} outperforming (${altWr.toFixed(0)}% vs ${currentWr.toFixed(0)}%) — switching`);
            recommendedMode = mode;
            break;
          }
        }
      }
    }
  }

  return {
    volatility,
    velocity: Math.round(velocity * 10) / 10,
    recommendedMode,
    reasons,
  };
}

// ─── Initialize from trade history on module load ─────────────────────────
bootstrapFromHistory();

console.log(chalk.cyan('[market-conditions] 📊 Module loaded — auto mode switching ready'));
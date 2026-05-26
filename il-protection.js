/**
 * il-protection.js
 * Impermanent Loss / Downside Protection — 3-Tier
 * 
 * Tier 1 (ALERT):    Drawdown melewati warning threshold → log + notify
 * Tier 2 (HEDGE):    Drawdown melewati action threshold → partial reduce (50%)
 * Tier 3 (EXIT):     Drawdown melewati critical threshold → full exit
 * 
 * Dynamic threshold adjustment based on volatility:
 * Higher volatility = wider thresholds (avoid false triggers)
 * Lower volatility = tighter thresholds (protect gains)
 */

import chalk from 'chalk';
import { getConfig } from './config.js';
import { getOpenPositions, getPosition, updatePosition, closePosition } from './state.js';
import { sellToken } from './executor.js';

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULTS = {
  // ── Tier Thresholds (%) ────────────────────────────────────────────────────
  alertThreshold:    10,    // alert @ drop 10% from entry
  hedgeThreshold:    20,    // partial sell @ drop 20%
  exitThreshold:     35,    // full exit @ drop 35%

  // ── Action Sizes ───────────────────────────────────────────────────────────
  hedgeSellPct:      50,    // Sell 50% of position on hedge
  exitSellPct:       100,   // Sell 100% on exit

  // ── Dynamic Adjustment ─────────────────────────────────────────────────────
  volatilityWindow:  20,    // Last N price checks for volatility calc
  volatilityBump:    5,     // +5% threshold per 50% vol increase
  baseVolatility:    30,    // Baseline volatility (std dev %)

  // ── Protection State ──────────────────────────────────────────────────────
  cooldownMs:        60_000, // Min time between hedge/exit per position
  enabled:           true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// IN-MEMORY STATE
// ═══════════════════════════════════════════════════════════════════════════════

// Track price history per position for volatility calculation
const _priceHistory = new Map(); // mint → [price, price, ...]

// Track last action time per position (cooldown)
const _lastAction = new Map(); // mint → timestamp

// Current IL tier per position
const _currentTiers = new Map(); // mint → { tier, triggeredAt, reason }

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE TRACKING & VOLATILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record a price tick for a position
 * @param {string} mint
 * @param {number} price
 */
export function recordPrice(mint, price) {
  if (!price || price <= 0) return;

  if (!_priceHistory.has(mint)) {
    _priceHistory.set(mint, []);
  }

  const history = _priceHistory.get(mint);
  history.push(price);

  // Trim to max window
  const maxLen = getConfig().ilProtection?.volatilityWindow || DEFAULTS.volatilityWindow;
  if (history.length > maxLen) {
    history.shift();
  }
}

/**
 * Calculate volatility (coefficient of variation) from price history
 * Higher = more volatile
 * @param {string} mint
 * @returns {number} volatility score in % (0-100+)
 */
export function calcVolatility(mint) {
  const history = _priceHistory.get(mint);
  if (!history || history.length < 5) {
    return DEFAULTS.baseVolatility;
  }

  const mean = history.reduce((s, p) => s + p, 0) / history.length;
  const variance = history.reduce((s, p) => s + (p - mean) ** 2, 0) / history.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? (stdDev / mean) * 100 : DEFAULTS.baseVolatility;

  return Math.round(cv * 10) / 10;
}

/**
 * Get dynamic thresholds adjusted for volatility
 * @param {number} volatility — current vol %
 * @param {object} config — ilProtection config
 * @returns {{ alertThreshold: number, hedgeThreshold: number, exitThreshold: number }}
 */
export function getDynamicThresholds(volatility, ilConfig) {
  const cfg = ilConfig || DEFAULTS;
  const baseVol = cfg.baseVolatility || DEFAULTS.baseVolatility;
  const bump = cfg.volatilityBump || DEFAULTS.volatilityBump;

  if (volatility <= baseVol) {
    return {
      alertThreshold: cfg.alertThreshold,
      hedgeThreshold: cfg.hedgeThreshold,
      exitThreshold: cfg.exitThreshold,
    };
  }

  // Scale: every 50% vol increase = +bump% to thresholds
  const extra = Math.floor((volatility - baseVol) / 50) * bump;

  return {
    alertThreshold: cfg.alertThreshold + extra,
    hedgeThreshold: cfg.hedgeThreshold + extra,
    exitThreshold: cfg.exitThreshold + extra,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER EVALUATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluate current IL tier for a position
 * @param {string} mint
 * @param {number} currentPriceSol
 * @param {object} [position] — optional, fetched from state if not provided
 * @returns {{ tier: number, name: string, drawdownPct: number, thresholds: object, shouldAct: boolean }}
 */
export function evaluateTier(mint, currentPriceSol, position) {
  const config = getConfig();
  const ilConfig = { ...DEFAULTS, ...config.ilProtection };

  if (!ilConfig.enabled) {
    return { tier: 0, name: 'DISABLED', drawdownPct: 0, thresholds: {}, shouldAct: false };
  }

  const pos = position || getPosition(mint);
  if (!pos) {
    return { tier: 0, name: 'NO_POSITION', drawdownPct: 0, thresholds: {}, shouldAct: false };
  }

  const entryPrice = pos.entryPriceSol || 0;
  if (!entryPrice || entryPrice <= 0) {
    return { tier: 0, name: 'NO_ENTRY_PRICE', drawdownPct: 0, thresholds: {}, shouldAct: false };
  }

  // Record price
  recordPrice(mint, currentPriceSol);

  // Calculate drawdown from entry
  const drawdownPct = ((entryPrice - currentPriceSol) / entryPrice) * 100;

  // Get dynamic thresholds
  const volatility = calcVolatility(mint);
  const thresholds = getDynamicThresholds(volatility, ilConfig);

  // Determine tier
  let tier = 0;
  let name = 'SAFE';
  let shouldAct = false;

  if (drawdownPct >= thresholds.exitThreshold) {
    tier = 3;
    name = 'EXIT';
    shouldAct = true;
  } else if (drawdownPct >= thresholds.hedgeThreshold) {
    tier = 2;
    name = 'HEDGE';
    shouldAct = true;
  } else if (drawdownPct >= thresholds.alertThreshold) {
    tier = 1;
    name = 'ALERT';
    shouldAct = false; // Alert is informational only
  }

  return {
    tier,
    name,
    drawdownPct: Math.round(drawdownPct * 100) / 100,
    volatility,
    thresholds,
    shouldAct,
    entryPrice,
    currentPrice: currentPriceSol,
    mint,
    symbol: pos.symbol || mint.slice(0, 8),
  };
}

/**
 * Check if cooldown is active for a position
 * @param {string} mint
 * @param {number} cooldownMs
 * @returns {boolean}
 */
export function isCooldown(mint, cooldownMs = DEFAULTS.cooldownMs) {
  const last = _lastAction.get(mint);
  if (!last) return false;
  return (Date.now() - last) < cooldownMs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute IL protection action based on tier evaluation
 * @param {object} evalResult — from evaluateTier()
 * @returns {Promise<{acted: boolean, action: string, result: object}>}
 */
export async function actOnIL(evalResult) {
  const config = getConfig();
  const ilConfig = { ...DEFAULTS, ...config.ilProtection };

  if (!evalResult.shouldAct) {
    // Still log Tier 1 alerts
    if (evalResult.tier === 1) {
      console.log(
        chalk.yellow(`[il-protection] ⚠️ ALERT (Tier 1) ${evalResult.symbol}: ${evalResult.drawdownPct}% drawdown`)
      );
      _currentTiers.set(evalResult.mint, {
        tier: 1,
        triggeredAt: Date.now(),
        reason: `${evalResult.drawdownPct.toFixed(1)}% drawdown`,
      });
    }
    return { acted: false, action: 'NONE', result: null };
  }

  // Check cooldown
  if (isCooldown(evalResult.mint, ilConfig.cooldownMs)) {
    const remaining = Math.round((ilConfig.cooldownMs - (Date.now() - (_lastAction.get(evalResult.mint) || 0))) / 1000);
    console.log(chalk.gray(`[il-protection] ⏳ Cooldown ${evalResult.symbol}: ${remaining}s remaining`));
    return { acted: false, action: 'COOLDOWN', result: null };
  }

  const sellPct = evalResult.tier >= 3 ? ilConfig.exitSellPct : ilConfig.hedgeSellPct;
  const actionName = evalResult.tier >= 3 ? 'EXIT' : 'HEDGE';

  console.log(
    chalk.red(`[il-protection] 🛡️ ${actionName} (Tier ${evalResult.tier}) ${evalResult.symbol}: selling ${sellPct}% at ${evalResult.drawdownPct}% drawdown`)
  );

  try {
    const result = await sellToken({
      mint: evalResult.mint,
      sellPct,
      slippageBps: config.entry.slippageBps || 1000,
      tradeValueSol: evalResult.drawdownPct * -1 * 0.01, // Fee split based on loss
    });

    if (result.success) {
      _lastAction.set(evalResult.mint, Date.now());
      _currentTiers.set(evalResult.mint, {
        tier: evalResult.tier,
        triggeredAt: Date.now(),
        reason: `${actionName} at ${evalResult.drawdownPct.toFixed(1)}% drawdown`,
      });

      // Update position in state
      updatePosition(evalResult.mint, {
        ilProtection: {
          lastAction: actionName,
          tier: evalResult.tier,
          triggeredAt: new Date().toISOString(),
          drawdownPct: evalResult.drawdownPct,
          sellPct,
        },
      });

      console.log(chalk.green(`[il-protection] ✅ ${actionName} ${evalResult.symbol}: sold ${sellPct}%`));
    }

    return { acted: result.success, action: actionName, result };
  } catch (e) {
    console.error(chalk.red(`[il-protection] ❌ ${actionName} ${evalResult.symbol} error: ${e.message}`));
    return { acted: false, action: actionName, result: { error: e.message } };
  }
}

/**
 * Check all positions for IL protection
 * @returns {Promise<Array>} results
 */
export async function checkAllPositions() {
  const positions = getOpenPositions();
  const posList = Object.entries(positions);
  const results = [];

  if (posList.length === 0) {
    console.log(chalk.gray('[il-protection] ℹ️ No open positions to check'));
    return results;
  }

  console.log(chalk.cyan(`[il-protection] 🔍 Checking ${posList.length} position(s)...`));

  for (const [mint, pos] of posList) {
    const currentPrice = pos.currentPriceSol || pos.entryPriceSol;
    if (!currentPrice) {
      results.push({ mint, acted: false, reason: 'No price data' });
      continue;
    }

    const evalResult = evaluateTier(mint, currentPrice, pos);
    const actionResult = await actOnIL(evalResult);

    results.push({
      mint,
      symbol: evalResult.symbol,
      tier: evalResult.tier,
      drawdownPct: evalResult.drawdownPct,
      volatility: evalResult.volatility,
      thresholds: evalResult.thresholds,
      ...actionResult,
    });
  }

  return results;
}

/**
 * Get current IL status summary
 * @returns {Array}
 */
export function getILStatus() {
  const positions = getOpenPositions();
  return Object.entries(positions).map(([mint, pos]) => {
    const currentPrice = pos.currentPriceSol || pos.entryPriceSol;
    if (!currentPrice) return { mint, symbol: pos.symbol, tier: 0, name: 'NO_PRICE' };

    const evalResult = evaluateTier(mint, currentPrice, pos);
    const lastAction = _lastAction.get(mint);
    const tierInfo = _currentTiers.get(mint);

    return {
      mint,
      symbol: evalResult.symbol,
      tier: evalResult.tier,
      name: evalResult.name,
      drawdownPct: evalResult.drawdownPct,
      volatility: evalResult.volatility,
      thresholds: evalResult.thresholds,
      lastActionTime: lastAction ? new Date(lastAction).toISOString() : null,
      lastTier: tierInfo?.tier || 0,
      lastReason: tierInfo?.reason || '',
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { DEFAULTS };

/**
 * rebalance-engine.js
 * Portfolio Rebalancing Engine
 * 
 * Evaluates open positions and recommends/executes rebalancing actions:
 * - Concentration risk: single position exceeding max allocation
 * - Performance divergence: trim losers, let winners run (within limits)
 * - Capital efficiency: free up capital from underperforming positions
 * - Opportunity cost: make room for higher-confidence signals
 * 
 * Integrates with: state.js (positions), executor.js (sell), config.js
 */

import chalk from 'chalk';
import { getConfig } from './config.js';
import { getOpenPositions, updatePosition, closePosition, getFullState } from './state.js';
import { sellToken } from './executor.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG — defaults, overridable via config.js → rebalance
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULTS = {
  maxSingleExposure:      0.5,   // Max 50% portfolio in 1 posisi
  minProfitToTrim:       50,    // Trim winner kalo >50% gain
  trimPct:               30,    // Trim 30% dari posisi
  maxDrawdownToCut:      20,    // Cut kalo drawdown >20% dari entry
  cutPct:                50,    // Cut 50% posisi
  staleHoursToReview:    2,     // Di-review kalo >2 jam gak gerak
  rebalanceIntervalMs:   60_000, // Cek tiap 60 detik
  enabled:               true,
  minPortfolioValueSol:  0.1,   // Minimal portfolio value untuk rebalance
};

// ═══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO EVALUATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate total portfolio value (SOL) from open positions
 * @param {object} positions — from state.getOpenPositions()
 * @returns {{ totalValueSol: number, positions: Array }}
 */
export function calcPortfolioValue(positions) {
  const posList = Object.values(positions);
  let totalValueSol = 0;
  const valued = [];

  for (const pos of posList) {
    const entryAmount = pos.entryAmountSol || 0;
    const currentPrice = pos.currentPriceSol || pos.entryPriceSol || 0;
    const entryPrice = pos.entryPriceSol || 0;
    const multiplier = entryPrice > 0 ? currentPrice / entryPrice : 1;
    const currentValue = entryAmount * multiplier;

    totalValueSol += currentValue;
    valued.push({
      mint: pos.tokenMint || pos.mint,
      symbol: pos.symbol || '???',
      entryAmount,
      currentValue,
      multiplier,
      entryPrice,
      currentPrice,
      pnlPct: entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0,
      openedAt: pos.openedAt,
      peakPriceSol: pos.peakPriceSol || entryPrice,
      isStale: false,
    });
  }

  return { totalValueSol, positions: valued };
}

/**
 * Score a position for rebalance priority (higher = more urgent to act on)
 */
export function scorePosition(pos, totalValue) {
  let score = 0;
  const reasons = [];

  // Drawdown dari peak
  const peak = pos.peakPriceSol || pos.entryPrice;
  const dropFromPeak = peak > 0 ? ((peak - pos.currentPrice) / peak) * 100 : 0;
  if (dropFromPeak > 15) {
    score += 30;
    reasons.push(`drawdown ${dropFromPeak.toFixed(1)}% from peak`);
  }

  // Negative PnL
  if (pos.pnlPct < -10) {
    score += 25;
    reasons.push(`PnL ${pos.pnlPct.toFixed(1)}%`);
  }

  // Concentration
  const exposure = totalValue > 0 ? (pos.currentValue / totalValue) : 0;
  if (exposure > 0.4) {
    score += 20;
    reasons.push(`concentration ${(exposure * 100).toFixed(0)}%`);
  }

  // Age — stale positions
  const ageHours = (Date.now() - new Date(pos.openedAt).getTime()) / 3600000;
  if (ageHours > 2 && Math.abs(pos.pnlPct) < 5) {
    score += 15;
    reasons.push(`stale ${ageHours.toFixed(1)}h`);
    pos.isStale = true;
  }

  // Big winner trimming (profitable but exposed)
  if (pos.pnlPct > 50 && exposure > 0.3) {
    score += 15;
    reasons.push(`trim winner ${pos.pnlPct.toFixed(1)}%`);
  }

  return { score, reasons };
}

/**
 * Get rebalance actions based on current portfolio state
 * @returns {Promise<{needsRebalance: boolean, actions: Array}>}
 */
export async function getRebalanceActions() {
  const config = getConfig();
  const rb = { ...DEFAULTS, ...config.rebalance };

  if (!rb.enabled) {
    return { needsRebalance: false, actions: [], reason: 'Rebalance disabled' };
  }

  const positions = getOpenPositions();
  const posCount = Object.keys(positions).length;
  if (posCount === 0) {
    return { needsRebalance: false, actions: [], reason: 'No open positions' };
  }

  const { totalValueSol, positions: valued } = calcPortfolioValue(positions);

  if (totalValueSol < rb.minPortfolioValueSol) {
    return { needsRebalance: false, actions: [], reason: `Portfolio too small: ${totalValueSol.toFixed(4)} SOL` };
  }

  const actions = [];

  for (const pos of valued) {
    const { score, reasons } = scorePosition(pos, totalValueSol);
    if (score < 20) continue; // Skip low-urgency

    if (pos.pnlPct > rb.minProfitToTrim && pos.currentValue / totalValue > 0.3) {
      // Trim winner
      actions.push({
        type: 'TRIM',
        mint: pos.mint,
        symbol: pos.symbol,
        sellPct: rb.trimPct,
        reason: `Trim winner: ${pos.pnlPct.toFixed(1)}% | ${reasons[0] || ''}`,
        priority: score,
      });
    } else if (pos.pnlPct < -rb.maxDrawdownToCut) {
      // Cut loser
      actions.push({
        type: 'CUT',
        mint: pos.mint,
        symbol: pos.symbol,
        sellPct: rb.cutPct,
        reason: `Cut loser: ${pos.pnlPct.toFixed(1)}% | ${reasons[0] || ''}`,
        priority: score,
      });
    } else if (pos.isStale) {
      // Exit stale
      actions.push({
        type: 'EXIT_STALE',
        mint: pos.mint,
        symbol: pos.symbol,
        sellPct: 100,
        reason: `Stale ${reasons[0] || ''}`,
        priority: score,
      });
    } else {
      // Reduce concentrated
      actions.push({
        type: 'REDUCE',
        mint: pos.mint,
        symbol: pos.symbol,
        sellPct: 30,
        reason: `Reduce concentration | ${reasons[0] || ''}`,
        priority: score,
      });
    }
  }

  // Sort by priority (highest first)
  actions.sort((a, b) => b.priority - a.priority);

  console.log(
    chalk.cyan(`[rebalance] 📊 ${actions.length} action(s) needed | Portfolio: ${totalValueSol.toFixed(4)} SOL | ${posCount} position(s)`)
  );
  for (const a of actions) {
    console.log(chalk.yellow(`  → ${a.type} ${a.symbol}: ${a.reason}`));
  }

  return {
    needsRebalance: actions.length > 0,
    actions,
    totalValueSol,
    positionCount: posCount,
  };
}

/**
 * Execute rebalance actions via executor
 * @param {Array} actions — from getRebalanceActions()
 * @returns {Promise<Array<{action, success, result}>>}
 */
export async function executeRebalance(actions) {
  const config = getConfig();
  const results = [];

  if (!actions || actions.length === 0) {
    console.log(chalk.gray('[rebalance] ℹ️ No actions to execute'));
    return results;
  }

  console.log(chalk.cyan(`[rebalance] 🚀 Executing ${actions.length} rebalance action(s)...`));

  for (const action of actions) {
    try {
      const result = await sellToken({
        mint: action.mint,
        sellPct: action.sellPct,
        slippageBps: config.entry.slippageBps || 1000,
        tradeValueSol: 0, // No fee split for rebalance
      });

      results.push({
        action: action.type,
        mint: action.mint,
        symbol: action.symbol,
        sellPct: action.sellPct,
        success: result.success,
        txHash: result.txHash,
        reason: action.reason,
      });

      if (result.success) {
        console.log(chalk.green(`[rebalance] ✅ ${action.type} ${action.symbol}: sold ${action.sellPct}%`));
      } else {
        console.log(chalk.red(`[rebalance] ❌ ${action.type} ${action.symbol} failed: ${result.error}`));
      }
    } catch (e) {
      results.push({
        action: action.type,
        mint: action.mint,
        symbol: action.symbol,
        success: false,
        error: e.message,
      });
      console.error(chalk.red(`[rebalance] ❌ ${action.type} ${action.symbol} error: ${e.message}`));
    }
  }

  // Update state after rebalance
  const successCount = results.filter(r => r.success).length;
  console.log(chalk.cyan(`[rebalance] 📊 Done: ${successCount}/${results.length} succeeded`));

  return results;
}

/**
 * One-shot: evaluate + execute if needed
 * @returns {Promise<{evaluated: boolean, actions: number, results: Array|null}>}
 */
export async function runRebalance() {
  const { needsRebalance, actions } = await getRebalanceActions();

  if (!needsRebalance) {
    return { evaluated: true, actions: 0, results: [] };
  }

  const results = await executeRebalance(actions);
  return { evaluated: true, actions: actions.length, results };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS — for testing
// ═══════════════════════════════════════════════════════════════════════════════
export { DEFAULTS };

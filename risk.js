/**
 * risk.js
 * Risk Management Engine — Portfolio-level protection
 * 
 * Checks:
 * - Max open positions
 * - Daily loss limit
 * - Max daily trades
 * - Gas reserve
 * - Cooldown after loss
 * - Portfolio exposure limits
 */

import chalk from 'chalk';
import { getConfig } from './config.js';
import { getDailyStats, getOpenPositionCount } from './state.js';
import { getBalance } from './executor.js';

// Track last loss time (for cooldown)
let lastLossTime = 0;

export function recordLoss() {
  lastLossTime = Date.now();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RISK CHECK — Call before every buy
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run all risk checks before opening a position
 * @returns {Promise<{canTrade: boolean, reasons: string[]}>}
 */
export async function preTradeRiskCheck() {
  const config = getConfig();
  const risk = config.risk;
  const reasons = [];
  let canTrade = true;

  // 1. Max open positions
  const openCount = getOpenPositionCount();
  if (openCount >= risk.maxOpenPositions) {
    canTrade = false;
    reasons.push(`❌ Max open positions reached: ${openCount}/${risk.maxOpenPositions}`);
  }

  // 2. Daily loss limit
  const stats = getDailyStats();
  if (stats.totalPnlSol <= -risk.maxDailyLossSol) {
    canTrade = false;
    reasons.push(`❌ Daily loss limit hit: ${stats.totalPnlSol.toFixed(4)} SOL (max: -${risk.maxDailyLossSol})`);
  }

  // 3. Max daily trades
  if (stats.tradesCount >= risk.maxDailyTrades) {
    canTrade = false;
    reasons.push(`❌ Max daily trades reached: ${stats.tradesCount}/${risk.maxDailyTrades}`);
  }

  // 4. Gas reserve check
  try {
    const { solBalance } = await getBalance();
    const minRequired = config.entry.buyAmountSol + risk.gasReserveSol;
    if (solBalance < minRequired) {
      canTrade = false;
      reasons.push(`❌ Insufficient balance: ${solBalance.toFixed(4)} SOL < ${minRequired.toFixed(4)} (buy + gas)`);
    }
  } catch (e) {
    canTrade = false;
    reasons.push(`❌ Balance check failed: ${e.message}`);
  }

  // 5. Cooldown after loss
  const cooldownMs = risk.cooldownAfterLossSec * 1000;
  const timeSinceLoss = Date.now() - lastLossTime;
  if (lastLossTime > 0 && timeSinceLoss < cooldownMs) {
    const remainSec = Math.ceil((cooldownMs - timeSinceLoss) / 1000);
    canTrade = false;
    reasons.push(`⏳ Cooldown active: ${remainSec}s remaining after last loss`);
  }

  // Log result
  if (!canTrade) {
    console.log(chalk.red('[risk] ⛔ Trade blocked:'));
    reasons.forEach(r => console.log(chalk.red(`  ${r}`)));
  }

  return { canTrade, reasons };
}

// ═══════════════════════════════════════════════════════════════════════════════
// POSITION-LEVEL RISK CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate buy amount berdasarkan confidence score & balance
 * @param {number} confidenceScore - 0-100 dari screening
 * @returns {number} amount in SOL
 */
export function calculateBuyAmount(confidenceScore) {
  const config = getConfig();
  const entry = config.entry;
  const risk = config.risk;

  let amount = entry.buyAmountSol;

  // Scaling berdasarkan confidence
  if (entry.enableScaling) {
    for (const tier of entry.scalingTiers) {
      if (confidenceScore >= tier.minScore) {
        amount = entry.buyAmountSol * tier.multiplier;
        break;
      }
    }
  }

  // Clamp to max
  amount = Math.min(amount, entry.maxBuyAmountSol);

  return amount;
}

/**
 * Check apakah harus exit (stop loss / trailing stop / time exit)
 * @param {object} position - position data dari state
 * @param {number} currentPriceSol - current token price in SOL
 * @returns {{shouldExit: boolean, reason: string, sellPct: number}}
 */
export function checkExitConditions(position, currentPriceSol) {
  const config = getConfig();
  const exit = config.exit;

  const entryPrice = position.entryPriceSol || 0;
  if (!entryPrice || !currentPriceSol) {
    return { shouldExit: false, reason: '', sellPct: 0 };
  }

  const priceChange = ((currentPriceSol - entryPrice) / entryPrice) * 100;
  const currentMultiple = currentPriceSol / entryPrice;

  // ── Update peak price (trailing stop reference) ────────────────────────────
  const peakPrice = Math.max(position.peakPriceSol || entryPrice, currentPriceSol);
  const dropFromPeak = peakPrice > 0 ? ((peakPrice - currentPriceSol) / peakPrice) * 100 : 0;

  // ── 1. Stop Loss ──────────────────────────────────────────────────────────
  if (priceChange <= exit.stopLossPct) {
    return {
      shouldExit: true,
      reason: `🛑 STOP LOSS: ${priceChange.toFixed(1)}% (threshold: ${exit.stopLossPct}%)`,
      sellPct: 100,
      type: 'stop_loss',
    };
  }

  // ── 2. Trailing Stop ──────────────────────────────────────────────────────
  if (dropFromPeak >= exit.trailingStopPct && currentMultiple > 1.5) {
    return {
      shouldExit: true,
      reason: `📉 TRAILING STOP: dropped ${dropFromPeak.toFixed(1)}% from peak (threshold: ${exit.trailingStopPct}%)`,
      sellPct: 100,
      type: 'trailing_stop',
    };
  }

  // ── 3. Take Profit Levels (check from highest to lowest) ────────────────
  const soldPct = position.soldPct || 0;
  const sortedLevels = [...exit.takeProfitLevels].sort((a, b) => b.triggerMultiple - a.triggerMultiple);
  for (const level of sortedLevels) {
    if (currentMultiple >= level.triggerMultiple) {
      // Check apakah level ini sudah dijual
      const alreadySold = position.sellHistory?.some(
        s => s.triggerMultiple === level.triggerMultiple
      );
      if (!alreadySold && soldPct < (100 - 5)) { // Keep 5% moonbag
        return {
          shouldExit: true,
          reason: `🎯 TAKE PROFIT: ${currentMultiple.toFixed(1)}x (trigger: ${level.triggerMultiple}x) → sell ${level.sellPct}%`,
          sellPct: level.sellPct,
          type: 'take_profit',
          triggerMultiple: level.triggerMultiple,
        };
      }
    }
  }

  // ── 4. Time-based Exit ────────────────────────────────────────────────────
  const holdTimeMin = (Date.now() - new Date(position.openedAt).getTime()) / 60000;
  if (holdTimeMin >= exit.maxHoldTimeMinutes && currentMultiple < 1.5) {
    return {
      shouldExit: true,
      reason: `⏰ TIME EXIT: held ${holdTimeMin.toFixed(0)}min (max: ${exit.maxHoldTimeMinutes}min) without significant profit`,
      sellPct: 100,
      type: 'time_exit',
    };
  }

  // ── 5. Stale Price Exit ───────────────────────────────────────────────────
  // (Handled di monitor.js via price tracking)

  return { shouldExit: false, reason: '', sellPct: 0 };
}

/**
 * Rug detection — emergency exit
 * @param {object} params
 * @returns {{isRug: boolean, reason: string}}
 */
export function detectRug({ priceDropPct, liquidityDropPct, devSoldPct }) {
  const config = getConfig();
  const rug = config.exit.rugDetection;

  if (priceDropPct >= rug.priceDropPct) {
    return { isRug: true, reason: `Price crashed ${priceDropPct.toFixed(1)}% (threshold: ${rug.priceDropPct}%)` };
  }

  if (liquidityDropPct >= rug.liquidityDropPct) {
    return { isRug: true, reason: `Liquidity removed ${liquidityDropPct.toFixed(1)}% (threshold: ${rug.liquidityDropPct}%)` };
  }

  if (devSoldPct >= rug.devSellThreshold) {
    return { isRug: true, reason: `Dev dumped ${devSoldPct.toFixed(1)}% of holdings (threshold: ${rug.devSellThreshold}%)` };
  }

  return { isRug: false, reason: '' };
}

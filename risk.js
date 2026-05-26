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

// ─── Insufficient Balance Cooldown ────────────────────────────────────────────
const INSUFFICIENT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 jam
const BALANCE_POLL_MS = 600_000; // Auto-check balance tiap 10 menit
let insufficientBalanceSince = 0; // Timestamp when insufficient balance was first detected
let balancePollInterval = null;

function startBalanceWatcher() {
  if (balancePollInterval) return;
  balancePollInterval = setInterval(async () => {
    if (insufficientBalanceSince === 0) return;
    const config = getConfig();
    if (config.isDryRun) return;
    try {
      const { solBalance } = await getBalance();
      const minRequired = config.entry.buyAmountSol + config.risk.gasReserveSol;
      if (solBalance >= minRequired) {
        console.log(chalk.green(`[risk] 💰 Balance restored: ${solBalance.toFixed(4)} SOL — clearing insufficient balance cooldown`));
        insufficientBalanceSince = 0;
      }
    } catch (e) {
      // Silent — network errors are normal
    }
  }, BALANCE_POLL_MS);
  console.log(chalk.gray(`[risk] 👁️ Balance watcher started (every 10m)`));
}

export function isBalanceCooldownActive() {
  if (insufficientBalanceSince === 0) return false;
  const elapsed = Date.now() - insufficientBalanceSince;
  if (elapsed >= INSUFFICIENT_COOLDOWN_MS) {
    console.log(chalk.green('[risk] ⏰ Insufficient balance cooldown expired (4h)'));
    insufficientBalanceSince = 0;
    return false;
  }
  return true;
}

function recordInsufficientBalance() {
  if (insufficientBalanceSince === 0) {
    insufficientBalanceSince = Date.now();
    startBalanceWatcher();
  }
}

// ─── Cached Balance ──────────────────────────────────────────────────────────
let _cachedBalance = null;
let _lastBalanceCheck = 0;
const BALANCE_CACHE_MS = 30_000; // Refresh balance tiap 30 detik

async function getCachedBalance() {
  const config = getConfig();
  // Di dry-run, gak perlu balance check sama sekali
  if (config.isDryRun) {
    return { solBalance: 999, address: 'DRY_RUN', lamports: 999e9 };
  }
  if (_cachedBalance && Date.now() - _lastBalanceCheck < BALANCE_CACHE_MS) {
    return _cachedBalance;
  }
  try {
    _cachedBalance = await getBalance();
    _lastBalanceCheck = Date.now();
    return _cachedBalance;
  } catch (e) {
    throw e;
  }
}

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

  // 0. Insufficient balance cooldown — skip fast jika masih cooldown
  if (isBalanceCooldownActive()) {
    const elapsed = Date.now() - insufficientBalanceSince;
    const remainMs = INSUFFICIENT_COOLDOWN_MS - elapsed;
    const remainHours = Math.ceil(remainMs / (60 * 60 * 1000) * 10) / 10;
    const reason = `⏳ Insufficient balance cooldown: ${remainHours}h remaining (balance watcher active — will auto-resume when funds arrive)`;
    console.log(chalk.yellow(`[risk] ${reason}`));
    reasons.push(reason);
    return { canTrade: false, reasons };
  }

  // 0b. Daily loss hard stop — -30% modal → stop all
  const stats = getDailyStats();
  const totalCapital = 2.0; // Asumsi modal 2 SOL (bisa diganti)
  const dailyLossPct = totalCapital > 0 ? Math.abs(stats.totalPnlSol) / totalCapital * 100 : 0;
  if (risk.dailyLossHardStopPct && dailyLossPct >= risk.dailyLossHardStopPct) {
    canTrade = false;
    reasons.push(`❌ DAILY HARD STOP: -${dailyLossPct.toFixed(0)}% today (limit: ${risk.dailyLossHardStopPct}%) — no more trades`);
  }

  // 1. Max open positions
  const openCount = getOpenPositionCount();
  if (openCount >= risk.maxOpenPositions) {
    canTrade = false;
    reasons.push(`❌ Max open positions reached: ${openCount}/${risk.maxOpenPositions}`);
  }

  // 2. Daily loss limit
  if (stats.totalPnlSol <= -risk.maxDailyLossSol) {
    canTrade = false;
    reasons.push(`❌ Daily loss limit hit: ${stats.totalPnlSol.toFixed(4)} SOL (max: -${risk.maxDailyLossSol})`);
  }

  // 3. Max daily trades
  if (stats.tradesCount >= risk.maxDailyTrades) {
    canTrade = false;
    reasons.push(`❌ Max daily trades reached: ${stats.tradesCount}/${risk.maxDailyTrades}`);
  }

  // 4. Gas reserve check (skip in dry-run mode)
  if (!config.isDryRun) {
    try {
      const { solBalance } = await getCachedBalance();
      const minRequired = config.entry.buyAmountSol + risk.gasReserveSol;
      if (solBalance < minRequired) {
        canTrade = false;
        reasons.push(`❌ Insufficient balance: ${solBalance.toFixed(4)} SOL < ${minRequired.toFixed(4)} (buy + gas)`);
        recordInsufficientBalance();
      }
    } catch (e) {
      canTrade = false;
      reasons.push(`❌ Balance check failed: ${e.message}`);
    }
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
 * Calculate buy amount berdasarkan mode & confidence score
 * @param {number} confidenceScore - 0-100 dari screening
 * @param {object} [screenResult] - screening result dengan mode info
 * @returns {number} amount in SOL
 */
export function calculateBuyAmount(confidenceScore, screenResult = null) {
  const config = getConfig();
  const entry = config.entry;
  const risk = config.risk;

  let amount = entry.buyAmountSol;

  // Prioritaskan mode-specific size
  if (screenResult?.mode && config.screening?.tradeModes?.[screenResult.mode]) {
    const modeCfg = config.screening.tradeModes[screenResult.mode];
    amount = modeCfg.sizeSol || entry.buyAmountSol;
  }

  // Scaling berdasarkan confidence
  if (entry.enableScaling && !screenResult?.mode) {
    for (const tier of entry.scalingTiers) {
      if (confidenceScore >= tier.minScore) {
        amount = entry.buyAmountSol * tier.multiplier;
        break;
      }
    }
  }

  // Mayhem mode — kurangi size 50%
  if (risk.mayhemSizeMultiplier && screenResult?.data?.mayhemActive) {
    amount *= risk.mayhemSizeMultiplier;
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
  const soldPct = position.soldPct || 0;

  // ── Stop Loss (selalu aktif) ──────────────────────────────────────────
  if (priceChange <= exit.stopLossPct) {
    return {
      shouldExit: true,
      reason: `🛑 STOP LOSS: ${priceChange.toFixed(1)}% (threshold: ${exit.stopLossPct}%)`,
      sellPct: 100,
      type: 'stop_loss',
    };
  }

  // ── Take Profit Levels ────────────────────────────────────────────────
  const sortedLevels = [...exit.takeProfitLevels].sort((a, b) => b.triggerMultiple - a.triggerMultiple);
  for (const level of sortedLevels) {
    if (currentMultiple >= level.triggerMultiple) {
      const alreadySold = position.sellHistory?.some(
        s => s.triggerMultiple === level.triggerMultiple
      );
      if (!alreadySold && soldPct < (100 - 5)) {
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

  // ── 4. Time-based Exit ──────────────────────────────────────────────────
  const holdTimeMin = (Date.now() - new Date(position.openedAt).getTime()) / 60000;
  if (holdTimeMin >= exit.maxHoldTimeMinutes && currentMultiple < 1.5) {
    return {
      shouldExit: true,
      reason: `⏰ TIME EXIT: held ${holdTimeMin.toFixed(0)}min (max: ${exit.maxHoldTimeMinutes}min) without significant profit`,
      sellPct: 100,
      type: 'time_exit',
    };
  }

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

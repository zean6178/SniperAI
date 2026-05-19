/**
 * monitor.js
 * Position Monitor — Track open positions, check exit conditions, auto-sell
 * 
 * Responsibilities:
 * - Poll token prices secara berkala
 * - Check exit conditions (TP/SL/trailing/time/rug)
 * - Execute sell ketika exit terpenuhi
 * - Update position metadata (peak price, PnL)
 */

import chalk from 'chalk';
import { getConfig } from './config.js';
import {
  getOpenPositions, updatePosition, closePosition as closePositionState,
} from './state.js';
import { sellToken, getTokenPrice, getTokenBalance } from './executor.js';
import { checkExitConditions, detectRug, recordLoss } from './risk.js';
import { sendTelegram } from './telegram.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MONITOR LOOP
// ═══════════════════════════════════════════════════════════════════════════════

let monitorInterval = null;
let isMonitoring = false;

export function startMonitor() {
  const config = getConfig();
  const intervalMs = config.monitoring.priceCheckIntervalMs;

  if (monitorInterval) return;

  console.log(chalk.cyan(`[monitor] 👁️ Starting position monitor (every ${intervalMs / 1000}s)`));
  monitorInterval = setInterval(monitorCycle, intervalMs);
  isMonitoring = true;
}

export function stopMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    isMonitoring = false;
    console.log(chalk.yellow('[monitor] Stopped'));
  }
}

export function getMonitorStatus() {
  return { isMonitoring, positions: Object.keys(getOpenPositions()).length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONITOR CYCLE — Runs every X seconds
// ═══════════════════════════════════════════════════════════════════════════════

async function monitorCycle() {
  const positions = getOpenPositions();
  const mints = Object.keys(positions);

  if (mints.length === 0) return;

  for (const mint of mints) {
    try {
      await evaluatePosition(mint, positions[mint]);
    } catch (e) {
      console.error(chalk.red(`[monitor] Error evaluating ${mint.slice(0, 8)}: ${e.message}`));
    }
  }
}

// ─── Evaluate single position ─────────────────────────────────────────────────
async function evaluatePosition(mint, position) {
  const config = getConfig();

  // 1. Get current price
  const currentPriceSol = await getTokenPrice(mint);
  if (currentPriceSol === null) {
    // Price unavailable — could be pre-migration token (not on Jupiter yet)
    // DON'T emergency sell just because price is unavailable!
    // Only trigger stale exit if we previously HAD a price and now lost it.
    const hadPriceBefore = position.currentPriceSol && position.currentPriceSol > 0;
    const lastPriceCheck = position.lastPriceCheck || position.openedAt;
    const staleDurationMs = Date.now() - new Date(lastPriceCheck).getTime();
    const staleThresholdMs = config.exit.stalePriceMinutes * 60 * 1000;

    if (hadPriceBefore && staleDurationMs > staleThresholdMs) {
      // Token previously had price but now lost it — likely rug/delist
      console.log(chalk.yellow(`[monitor] ⚠️ ${position.symbol} price lost for ${(staleDurationMs / 60000).toFixed(0)}min (had price before) — emergency sell`));
      await executeSell(mint, position, 100, '⚠️ STALE PRICE: previously priced token lost price data');
    } else if (!hadPriceBefore) {
      // Token never had a Jupiter price — it's pre-migration, this is NORMAL
      // Skip — don't sell just because Jupiter can't quote a Pump.fun bonding curve token
      console.log(chalk.gray(`[monitor] ℹ️ ${position.symbol} no Jupiter price (pre-migration) — skipping`));
    }
    return;
  }

  // 2. Update position metadata
  const peakPrice = Math.max(position.peakPriceSol || 0, currentPriceSol);
  const currentMultiple = position.entryPriceSol > 0
    ? currentPriceSol / position.entryPriceSol
    : 1;
  const pnlPct = ((currentPriceSol - position.entryPriceSol) / position.entryPriceSol) * 100;

  updatePosition(mint, {
    currentPriceSol,
    peakPriceSol: peakPrice,
    peakMultiple: Math.max(position.peakMultiple || 1, currentMultiple),
    currentMultiple,
    pnlPct,
    lastPriceCheck: new Date().toISOString(),
  });

  // 3. Check rug detection (emergency)
  if (config.exit.autoExitOnRug) {
    const prevPrice = position.currentPriceSol || position.entryPriceSol;
    const priceDropPct = prevPrice > 0
      ? ((prevPrice - currentPriceSol) / prevPrice) * 100
      : 0;

    // Only check rug if price dropped significantly in short time
    if (priceDropPct > 30) {
      const rugCheck = detectRug({
        priceDropPct,
        liquidityDropPct: 0, // Would need bonding curve check
        devSoldPct: 0,       // Would need holder tracking
      });

      if (rugCheck.isRug) {
        console.log(chalk.red(`[monitor] 🚨 RUG DETECTED: ${position.symbol} — ${rugCheck.reason}`));
        await executeSell(mint, position, 100, `🚨 RUG: ${rugCheck.reason}`);
        return;
      }
    }
  }

  // 4. Check normal exit conditions (TP/SL/trailing/time)
  const exitCheck = checkExitConditions(
    { ...position, peakPriceSol: peakPrice },
    currentPriceSol
  );

  if (exitCheck.shouldExit) {
    console.log(chalk.yellow(`[monitor] ${exitCheck.reason} | ${position.symbol}`));
    await executeSell(mint, position, exitCheck.sellPct, exitCheck.reason, exitCheck);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTE SELL
// ═══════════════════════════════════════════════════════════════════════════════

async function executeSell(mint, position, sellPct, reason, exitMeta = {}) {
  const config = getConfig();
  const slippage = config.entry.slippageBps;

  console.log(chalk.red(
    `[monitor] 🔴 SELLING ${sellPct}% of ${position.symbol} (${mint.slice(0, 8)}…) | Reason: ${reason}`
  ));

  // Execute sell
  const result = await sellToken({ mint, sellPct, slippageBps: slippage });

  if (result.success) {
    const soldPct = (position.soldPct || 0) + sellPct;
    const solReceived = result.solReceived || 0;
    const entryAmountSol = position.entryAmountSol || 0;
    const pnlSol = solReceived - (entryAmountSol * (sellPct / 100));

    // Record in sell history
    const sellRecord = {
      sellPct,
      solReceived,
      pnlSol,
      reason,
      type: exitMeta.type || 'manual',
      triggerMultiple: exitMeta.triggerMultiple || null,
      timestamp: new Date().toISOString(),
      txHash: result.txHash,
    };

    if (sellPct >= 100 || soldPct >= 95) {
      // Full close
      closePositionState(mint, {
        pnlSol,
        closeReason: reason,
        closeType: exitMeta.type || 'manual',
        sellHistory: [...(position.sellHistory || []), sellRecord],
        soldPct: 100,
      });

      if (pnlSol < 0) recordLoss();

      // Telegram notification
      const emoji = pnlSol >= 0 ? '✅' : '🔴';
      await sendTelegram(
        `${emoji} *Position Closed*\n` +
        `Token: *${position.symbol}*\n` +
        `PnL: *${pnlSol >= 0 ? '+' : ''}${pnlSol.toFixed(4)} SOL*\n` +
        `Multiple: *${(position.currentMultiple || 1).toFixed(2)}x*\n` +
        `Reason: ${reason}\n` +
        `Hold time: ${getHoldTime(position.openedAt)}\n` +
        `Tx: \`${result.txHash || 'N/A'}\``
      );
    } else {
      // Partial sell — update position
      updatePosition(mint, {
        soldPct,
        sellHistory: [...(position.sellHistory || []), sellRecord],
      });

      await sendTelegram(
        `💰 *Partial Sell (${sellPct}%)*\n` +
        `Token: *${position.symbol}*\n` +
        `SOL received: *${solReceived.toFixed(4)}*\n` +
        `Remaining: ${100 - soldPct}%\n` +
        `Reason: ${reason}`
      );
    }

    console.log(chalk.green(`[monitor] ✅ Sell executed: ${result.txHash}`));
  } else {
    console.error(chalk.red(`[monitor] ❌ Sell FAILED: ${result.error}`));
    await sendTelegram(
      `❌ *Sell Failed*\nToken: *${position.symbol}*\nError: ${result.error}\nReason: ${reason}`
    );
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function getHoldTime(openedAt) {
  const ms = Date.now() - new Date(openedAt).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

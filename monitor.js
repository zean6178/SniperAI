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
import { getOpenPositions, updatePosition, closePosition as closePositionState, getClosedCount } from './state.js';
import { sellToken, getTokenPrice, getTokenBalance } from './executor.js';
import { checkExitConditions, detectRug, recordLoss } from './risk.js';
import { sendTelegram } from './telegram.js';
import { formatMcapUsd } from './telegram-ui.js';

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

/**
 * reconcileNow() — Sync on-chain balances with state.
 * In DRY_RUN, this is a no-op since there are no real positions.
 */
export async function reconcileNow() {
  const config = getConfig();
  if (config.isDryRun) {
    console.log(chalk.gray('[monitor] ⏭️ reconcileNow skipped — DRY_RUN mode'));
    return { skipped: true, reason: 'DRY_RUN — no real on-chain positions to reconcile' };
  }

  console.log(chalk.cyan('[monitor] 🔄 Reconciling on-chain balances…'));
  const positions = getOpenPositions();
  const mints = Object.keys(positions);

  let cleaned = 0;
  for (const mint of mints) {
    try {
      const balance = await getTokenBalance(mint);
      if (balance === 0) {
        const pos = positions[mint];
        console.log(chalk.yellow(`[monitor] 🧹 Closing ${pos.symbol} (${mint.slice(0, 8)}…) — on-chain balance is zero`));
        closePositionState(mint, {
          pnlSol: 0,
          closeReason: '🧹 Stale Position Auto-Closed — on-chain balance zero',
          closeType: 'reconciliation',
          soldPct: 100,
        });
        cleaned++;
      }
    } catch (e) {
      console.warn(chalk.yellow(`[monitor] ⚠️ reconcileNow error for ${mint.slice(0, 8)}: ${e.message}`));
    }
  }

  console.log(chalk.green(`[monitor] ✅ Reconciliation complete — cleaned ${cleaned} stale position(s)`));
  return { cleaned };
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
  const currentPriceSol = await getTokenPrice(mint, position.useBondingCurve);
  if (currentPriceSol === null) {
    // Price unavailable — could be pre-migration token (not on Jupiter yet)
    const hadPriceBefore = position.currentPriceSol && position.currentPriceSol > 0;
    const lastPriceCheck = position.lastPriceCheck || position.openedAt;
    const holdTimeMin = (Date.now() - new Date(position.openedAt).getTime()) / 60000;
    const staleDurationMs = Date.now() - new Date(lastPriceCheck).getTime();
    const staleThresholdMs = config.exit.stalePriceMinutes * 60 * 1000;

    // Determine per-mode max hold time (trade modes have shorter timeouts)
    let maxHoldMinutes = config.exit.maxHoldTimeMinutes;
    const tradeMode = position.tradeMode;
    if (tradeMode && config.screening.tradeModes?.[tradeMode]?.maxHoldSeconds) {
      maxHoldMinutes = config.screening.tradeModes[tradeMode].maxHoldSeconds / 60;
    }

    // Try to update peakMcapSol from PumpPortal WS cached data even without Jupiter price
    try {
      const { getCachedMcap } = await import('./detector.js');
      const liveMcap = getCachedMcap(mint);
      if (liveMcap > 0) {
        const updates = {
          peakMcapSol: Math.max(position.peakMcapSol || 0, liveMcap),
          lastPriceCheck: new Date().toISOString(),
        };
        // ✅ FIX BUG 4: Retroaktif isi entryMcapSol jika belum ada (pre-migration token)
        if (!(position.entryMcapSol > 0)) {
          updates.entryMcapSol = liveMcap;
          updates.peakMcapSol = liveMcap; // reset peak = entry (first known mcap)
          console.log(chalk.gray(`[monitor] 📐 ${position.symbol} entryMcapSol retroactively set to ${liveMcap.toFixed(2)} SOL`));
        }
        updatePosition(mint, updates);
      }
    } catch {}

    // ══════════════════════════════════════════════════════════════════════
    // HYBRID BONDING CURVE — auto-ON jika terdeteksi aktivitas trading
    // ══════════════════════════════════════════════════════════════════════
    const hbc = config.exit.hybridBondingCurve;
    if (hbc?.enabled && !position.useBondingCurve && !hadPriceBefore && holdTimeMin < maxHoldMinutes) {
      try {
        const { getTradeStats } = await import('./detector.js');
        const stats = getTradeStats(mint, hbc.windowSec * 1000);
        const totalTrades = (stats?.buyCount || 0) + (stats?.sellCount || 0);
        if (totalTrades >= hbc.minTrades) {
          console.log(chalk.cyan(`[monitor] 🔗 ${position.symbol} — ${totalTrades} trades in ${hbc.windowSec}s → bonding curve ON`));
          updatePosition(mint, { useBondingCurve: true });
          position.useBondingCurve = true;
          const bcPrice = await getTokenPrice(mint, true);
          if (bcPrice !== null) {
            console.log(chalk.green(`[monitor] 💰 ${position.symbol} — bonding curve price found: ${bcPrice.toFixed(8)} SOL`));
            // ⭐ Override currentPriceSol so flow continues to risk check
            currentPriceSol = bcPrice;
          }
        }
      } catch {}
    }

    // If hybrid bonding curve found a price, skip time-exit / stale checks
    if (currentPriceSol !== null) {
      // Continue to risk check below (exit the null-handling block)
    } else {
      // Force-close pre-migration tokens that exceeded max hold time
      if (!hadPriceBefore && holdTimeMin >= maxHoldMinutes) {
        let preMigPnlPct = 0;
        try {
          const { getCachedMcap } = await import('./detector.js');
          const currentMcap = getCachedMcap(mint);
          const freshPos = (await import('./state.js')).getPosition(mint) || position;
          if (currentMcap > 0 && freshPos.entryMcapSol > 0) {
            preMigPnlPct = ((currentMcap - freshPos.entryMcapSol) / freshPos.entryMcapSol) * 100;
            updatePosition(mint, { pnlPct: preMigPnlPct });
          }
        } catch {}

        console.log(chalk.yellow(`[monitor] ⏰ ${position.symbol} pre-migration for ${holdTimeMin.toFixed(0)}min (max: ${maxHoldMinutes.toFixed(0)}min) — simulated flat exit`));
        await executeSell(mint, position, 100, `⏰ TIME EXIT: pre-migration for ${holdTimeMin.toFixed(0)}min (max: ${maxHoldMinutes.toFixed(0)}min) — no migration detected`, { type: 'time_exit' });
        return;
      }

      if (hadPriceBefore && staleDurationMs > staleThresholdMs) {
        console.log(chalk.yellow(`[monitor] ⚠️ ${position.symbol} price lost for ${(staleDurationMs / 60000).toFixed(0)}min (had price before) — emergency sell`));
        await executeSell(mint, position, 100, '⚠️ STALE PRICE: previously priced token lost price data');
      } else if (!hadPriceBefore) {
        console.log(chalk.gray(`[monitor] ℹ️ ${position.symbol} no Jupiter price (pre-migration) — ${holdTimeMin.toFixed(0)}/${config.exit.maxHoldTimeMinutes}min before auto-close`));
      }
      return;
    }
  }

  // 2. Update position metadata
  const peakPrice = Math.max(position.peakPriceSol || 0, currentPriceSol);
  const currentMultiple = position.entryPriceSol > 0
    ? currentPriceSol / position.entryPriceSol
    : 1;
  const pnlPct = ((currentPriceSol - position.entryPriceSol) / position.entryPriceSol) * 100;

  // Estimate current MCap from price ratio * entry MCap
  const currentMcapEst = position.entryMcapSol > 0 && position.entryPriceSol > 0
    ? position.entryMcapSol * (currentPriceSol / position.entryPriceSol)
    : 0;
  const peakMcapSol = Math.max(position.peakMcapSol || 0, currentMcapEst);

  const posUpdates = {
    currentPriceSol,
    peakPriceSol: peakPrice,
    peakMultiple: Math.max(position.peakMultiple || 1, currentMultiple),
    peakMcapSol,
    currentMultiple,
    pnlPct,
    lastPriceCheck: new Date().toISOString(),
  };

  // ✅ FIX BUG 4: Retroaktif isi entryMcapSol jika masih 0 tapi currentMcapEst sudah tersedia
  // (Terjadi saat token pre-migration yang baru dapat Jupiter price setelah migrate)
  if (!(position.entryMcapSol > 0) && currentMcapEst > 0) {
    posUpdates.entryMcapSol = currentMcapEst;
    posUpdates.peakMcapSol = currentMcapEst; // peak = entry dulu, akan naik dari sini
    console.log(chalk.gray(`[monitor] 📐 ${position.symbol} entryMcapSol retroactively set to ${currentMcapEst.toFixed(2)} SOL (post-migration)`));
  }

  updatePosition(mint, posUpdates);

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
  const tradeValueSol = position.entryAmountSol ? (position.entryAmountSol * (sellPct / 100)) : 0;
  const result = await sellToken({ mint, sellPct, slippageBps: slippage, tradeValueSol, entryPriceSol: position.entryPriceSol, useBondingCurve: position.useBondingCurve });

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

      // Telegram notification — Carter-style
      const emoji = pnlSol >= 0 ? '✅' : '🔴';
      const exitType = exitMeta.type || 'manual';
      const exitLabel = exitType.replace('_', ' ').toUpperCase();
      const metaParts = ['closed'];
      if (config.isDryRun) metaParts.push('Mode: dry\\_run');
      if (position.tradeMode) metaParts.push(`Strategy: ${position.tradeMode.replace(/_/g, '\\_')}`);
      const statusLine = `Status: ${metaParts.join(' · ')}`;

      const entryMcap = position.entryMcapSol > 0
        ? formatMcapUsd(position.entryMcapSol)
        : 'N/A';

      // ✅ FIX BUG 1: Tampilkan peakMcapSol selama > 0, bukan hanya saat > entryMcapSol
      // Bug lama: kondisi (peakMcapSol > entryMcapSol) selalu false karena savePosition()
      // menginit peakMcapSol = entryMcapSol, sehingga High selalu tampil sama dengan Entry
      const peakMcap = position.peakMcapSol > 0
        ? formatMcapUsd(position.peakMcapSol)
        : entryMcap;

      // ✅ FIX BUG 2: Hitung pnlPct dari pnlSol aktual (realized), bukan dari position.pnlPct
      // Bug lama: position.pnlPct adalah unrealized % dari last price check — bisa stale
      // dan tidak mencerminkan actual exit PnL setelah slippage/fee
      const pnlPct = entryAmountSol > 0
        ? (pnlSol / entryAmountSol) * 100
        : (position.pnlPct || 0);

      // ✅ FIX BUG 3: Gunakan currentMultiple (price-based) untuk estimasi exit mcap
      // Bug lama: pnlRatio = 1 + (pnlSol / entryAmountSol) — ini SOL-based dan sudah
      // dipotong slippage/fee sehingga exit mcap ikut meleset. Harusnya pakai price ratio.
      const exitMultiple = position.currentMultiple > 0
        ? position.currentMultiple
        : (position.entryPriceSol > 0 && position.currentPriceSol > 0
            ? position.currentPriceSol / position.entryPriceSol
            : 1);
      const exitMcapValue = exitMultiple !== 1 && position.entryMcapSol > 0
        ? position.entryMcapSol * exitMultiple
        : (position.peakMcapSol || position.entryMcapSol || 0);
      const exitMcap = exitMcapValue > 0
        ? formatMcapUsd(exitMcapValue)
        : 'N/A';

      // TP as percentage (convert first TP multiple to %)
      const firstTpPct = config.exit.takeProfitLevels?.[0]?.triggerMultiple
        ? ((config.exit.takeProfitLevels[0].triggerMultiple - 1) * 100).toFixed(0)
        : 'N/A';
      const tpLabel = `TP: ${firstTpPct}%`;
      const slLabel = `SL: ${config.exit.stopLossPct}%`;
      const trailLabel = `Trail: ${config.exit.trailingStopPct}%`;
      const posNumber = getClosedCount() + 1;

      await sendTelegram(
        `${emoji} *Dry-run exit: ${exitLabel}*\n\n` +
        `📍 *${position.symbol}*  #${posNumber}\n` +
        `Token: \`${mint.slice(0, 8)}…pump\`\n` +
        `${statusLine}\n` +
        `Entry mcap: ${entryMcap} · High: ${peakMcap}\n` +
        `Size: ${(position.entryAmountSol || 0).toFixed(4)} SOL · PnL: *${pnlPct.toFixed(1)}%*\n` +
        `${tpLabel} · ${slLabel} · ${trailLabel}\n` +
        `Exit: ${exitLabel} at ${exitMcap} (${pnlPct.toFixed(1)}%)\n` +
        `_${reason}_`
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
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins >= 1) {
    const hours = Math.floor(mins / 60);
    return hours >= 1 ? `${hours}h ${mins % 60}m` : `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

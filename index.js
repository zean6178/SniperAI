/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PUMP.FUN SNIPER BOT — Main Entry Point
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Flow:
 * 
 *   [PumpPortal WebSocket]
 *         │
 *         ▼
 *   [detector.js] ─── detect token baru
 *         │
 *         ▼
 *   [screening.js] ─── filter & score (holder, bundle, bonding curve, deployer)
 *         │
 *         ▼
 *   [risk.js] ─── pre-trade check (balance, max positions, daily limits)
 *         │
 *         ▼
 *   [executor.js] ─── buy token (PumpPortal API / Jupiter)
 *         │
 *         ▼
 *   [monitor.js] ─── track price, check TP/SL/trailing/rug → auto-sell
 *         │
 *         ▼
 *   [state.js] ─── persist trade history, PnL, blacklists
 *         │
 *         ▼
 *   [telegram.js] ─── notifications & commands
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import chalk from 'chalk';
import dayjs from 'dayjs';
import dotenv from 'dotenv';
dotenv.config();

import { getConfig } from './config.js';
import { startDetector, setOnNewToken, getDetectorStatus } from './detector.js';
import { runScreening } from './screening.js';
import { preTradeRiskCheck, calculateBuyAmount } from './risk.js';
import { buyToken, getBalance } from './executor.js';
import { startMonitor, getMonitorStatus } from './monitor.js';
import { savePosition, recordBuy, getDailyStats, getWinRate } from './state.js';
import { initTelegram, sendTelegram, isPaused } from './telegram.js';

// ═══════════════════════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const config = getConfig();

  // Banner
  console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════╗
║         🎯 PUMP.FUN SNIPER BOT v1.0                  ║
║         Solana Memecoin Sniper — Professional        ║
╚═══════════════════════════════════════════════════════╝
  `));

  console.log(chalk.yellow(`Mode      : ${config.botMode}`));
  console.log(chalk.yellow(`Dry Run   : ${config.isDryRun}`));
  console.log(chalk.yellow(`Buy Amount: ${config.entry.buyAmountSol} SOL`));
  console.log(chalk.yellow(`Max Pos   : ${config.risk.maxOpenPositions}`));
  console.log(chalk.yellow(`Stop Loss : ${config.exit.stopLossPct}%`));
  console.log(chalk.yellow(`Trailing  : ${config.exit.trailingStopPct}%`));
  console.log('');

  // Balance check
  try {
    const { solBalance, address } = await getBalance();
    console.log(chalk.green(`Wallet    : ${address}`));
    console.log(chalk.green(`Balance   : ${solBalance.toFixed(4)} SOL`));
    console.log('');
  } catch (e) {
    console.error(chalk.red(`Wallet error: ${e.message}`));
    console.error(chalk.red('Check WALLET_PRIVATE_KEY and RPC_URL in .env'));
    process.exit(1);
  }

  // Init Telegram
  await initTelegram();

  // Start position monitor
  startMonitor();

  // Wire up hybrid merger → main pipeline
  if (config.hybrid?.enabled) {
    const { setOnDecision } = await import('./merger.js');
    setOnDecision(async (mergerResult) => {
      // Convert merger output to tokenData format for handleNewToken
      const tokenData = {
        mint: mergerResult.mint,
        symbol: mergerResult.symbol,
        name: mergerResult.name,
        deployer: mergerResult.deployer,
        marketCapSol: mergerResult.marketCapSol,
        initialBuySol: mergerResult.initialBuySol,
        timestamp: mergerResult.timestamp,
        // Pre-scored by merger
        _mergerScore: mergerResult.score,
        _mergerStrategy: mergerResult.strategy,
        _mergerSources: mergerResult.sources,
      };
      await handleNewToken(tokenData);
    });
    console.log(chalk.green('[main] ✅ Hybrid merger → pipeline connected'));
  }

  // Start token detector & set callback (for non-hybrid / fallback mode)
  setOnNewToken(handleNewToken);
  startDetector();

  // Startup notification
  await sendTelegram(
    `🎯 *Pump.fun Sniper Started*\n\n` +
    `Mode: *${config.botMode}*\n` +
    `Dry Run: *${config.isDryRun}*\n` +
    `Buy: *${config.entry.buyAmountSol} SOL*\n` +
    `_${dayjs().format('YYYY-MM-DD HH:mm:ss')}_`
  );

  console.log(chalk.green('\n✅ Bot is running. Waiting for new tokens...\n'));

  // Keep alive
  process.stdin.resume();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PIPELINE — Called for every new token detected
// ═══════════════════════════════════════════════════════════════════════════════

async function handleNewToken(tokenData) {
  const config = getConfig();

  // 0. Check if paused
  if (isPaused()) return;

  try {
    // ═════════════════════════════════════════════════════════════════════════
    // STEP 1: SCREENING — Score & filter token
    // ═════════════════════════════════════════════════════════════════════════
    const screenResult = await runScreening(tokenData);

    if (screenResult.decision === 'SKIP') {
      return; // Silent skip
    }

    if (screenResult.decision === 'WATCH') {
      // Bisa ditambahkan watchlist logic di sini
      console.log(chalk.gray(`[main] 👀 Watching: ${tokenData.symbol} (score: ${screenResult.score})`));
      return;
    }

    // Decision = SNIPE!
    console.log(chalk.green(`\n[main] 🎯 SNIPE SIGNAL: ${tokenData.symbol} | Score: ${screenResult.score}/100`));

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 2: RISK CHECK — Can we trade?
    // ═════════════════════════════════════════════════════════════════════════
    const riskCheck = await preTradeRiskCheck();
    if (!riskCheck.canTrade) {
      console.log(chalk.red(`[main] ⛔ Risk check failed for ${tokenData.symbol}`));
      await sendTelegram(
        `⛔ *Snipe Blocked*\nToken: ${tokenData.symbol}\nReasons:\n${riskCheck.reasons.join('\n')}`
      );
      return;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 3: CALCULATE BUY AMOUNT
    // ═════════════════════════════════════════════════════════════════════════
    const buyAmountSol = calculateBuyAmount(screenResult.score);

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 4: EXECUTE BUY
    // ═════════════════════════════════════════════════════════════════════════
    if (config.botMode === 'semi-auto') {
      // Send Telegram notification & wait for manual approval
      await sendTelegram(
        `🎯 *SNIPE OPPORTUNITY*\n\n` +
        `Token: *${tokenData.symbol}* (${tokenData.name})\n` +
        `Mint: \`${tokenData.mint}\`\n` +
        `Score: *${screenResult.score}/100*\n` +
        `Amount: *${buyAmountSol} SOL*\n` +
        `Dev: \`${tokenData.deployer?.slice(0, 12)}…\`\n\n` +
        `Reasons:\n${screenResult.reasons.slice(0, 5).join('\n')}\n\n` +
        `_Auto-buy disabled (semi-auto mode)_`
      );
      return;
    }

    // Full-auto mode: execute immediately
    console.log(chalk.green(`[main] 💰 Executing buy: ${buyAmountSol} SOL → ${tokenData.symbol}`));

    const buyResult = await buyToken({
      mint: tokenData.mint,
      amountSol: buyAmountSol,
      slippageBps: config.entry.slippageBps,
    });

    if (buyResult.success) {
      // ═════════════════════════════════════════════════════════════════════
      // STEP 5: SAVE POSITION → Monitor will track from here
      // ═════════════════════════════════════════════════════════════════════
      savePosition(tokenData.mint, {
        symbol:         tokenData.symbol,
        name:           tokenData.name,
        deployer:       tokenData.deployer,
        entryAmountSol: buyAmountSol,
        entryPriceSol:  tokenData.marketCapSol > 0
          ? tokenData.marketCapSol / 1_000_000_000 // price per token
          : buyAmountSol / (buyResult.tokenAmount || 1),
        tokenAmount:    buyResult.tokenAmount || 0,
        txHash:         buyResult.txHash,
        screenScore:    screenResult.score,
        bondingCurve:   tokenData.bondingCurve,
      });

      recordBuy(buyAmountSol);

      // Telegram notification
      await sendTelegram(
        `✅ *SNIPED!*\n\n` +
        `Token: *${tokenData.symbol}*\n` +
        `Amount: *${buyAmountSol} SOL*\n` +
        `Score: *${screenResult.score}/100*\n` +
        `Tx: \`${buyResult.txHash}\`\n\n` +
        `_Monitoring started — TP/SL active_`
      );

      console.log(chalk.green(`[main] ✅ Position opened: ${tokenData.symbol} | ${buyAmountSol} SOL`));
    } else {
      console.error(chalk.red(`[main] ❌ Buy failed: ${buyResult.error}`));
      await sendTelegram(`❌ *Buy Failed*\nToken: ${tokenData.symbol}\nError: ${buyResult.error}`);
    }

  } catch (e) {
    console.error(chalk.red(`[main] Pipeline error: ${e.message}`));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════════

process.on('SIGINT', async () => {
  console.log(chalk.red('\n🛑 Shutting down...'));
  const { stopDetector } = await import('./detector.js');
  const { stopMonitor } = await import('./monitor.js');
  stopDetector();
  stopMonitor();
  await sendTelegram('🛑 *Sniper bot stopped*');
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  console.error(chalk.red(`💥 Uncaught: ${err.message}`));
  await sendTelegram(`💥 *Error*: ${err.message}`).catch(() => {});
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
main().catch(err => {
  console.error(chalk.red(`Fatal: ${err.message}`));
  process.exit(1);
});

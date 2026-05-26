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
import { startDetector, setOnNewToken, getDetectorStatus, subscribeTokenTrades } from './detector.js';
import { runScreening } from './screening.js';
import { preTradeRiskCheck, calculateBuyAmount, isBalanceCooldownActive } from './risk.js';
import { buyToken, getBalance } from './executor.js';
import { startMonitor, getMonitorStatus, reconcileNow } from './monitor.js';
import { savePosition, recordBuy, getDailyStats, getWinRate } from './state.js';
import { initTelegram, sendTelegram, isPaused, setPaused, isSilent, setSilent } from './telegram.js';
import { sendInlineKeyboard, startCallbackPoller, stopCallbackPoller, editKeyboard, answerCallback, onCommand, sendMessageToChat, sendSound } from './telegram.js';
import { buildSnipeResultKeyboard } from './telegram-ui.js';
import { formatMcapUsd } from './telegram-ui.js';

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

  // Register command handlers
  onCommand('start', async (chatId) => {
    const bal = await getBalance().catch(() => ({ solBalance: 0 }));
    await sendMessageToChat(chatId,
      `🎯 *SniperAI — Solana Memecoin Sniper*\n\n` +
      `Mode: *${config.botMode}*${config.isDryRun ? ' (dry-run)' : ''}\n` +
      `Wallet: \`${bal.address?.slice(0, 12) || 'N/A'}…\`\n` +
      `Balance: *${bal.solBalance.toFixed(4)} SOL*\n` +
      `Buy Amount: *${config.entry.buyAmountSol} SOL*\n` +
      `Max Positions: *${config.risk.maxOpenPositions}*\n\n` +
      `_Token alerts appear automatically with inline buy buttons._`
    );
  });

  onCommand('status', async (chatId) => {
    const bal = await getBalance().catch(() => ({ solBalance: 0 }));
    const { getOpenPositionCount, getDailyStats } = await import('./state.js');
    const posCount = getOpenPositionCount();
    const stats = getDailyStats();
    await sendMessageToChat(chatId,
      `📊 *SniperAI Status*\n\n` +
      `Wallet: *${bal.solBalance.toFixed(4)} SOL*\n` +
      `Positions: *${posCount}* / ${config.risk.maxOpenPositions}\n` +
      `Daily Trades: *${stats.tradesCount}* / ${config.risk.maxDailyTrades}\n` +
      `Daily PnL: *${stats.totalPnlSol >= 0 ? '+' : ''}${stats.totalPnlSol.toFixed(4)} SOL*\n` +
      `Win Rate: *${(stats.wins / Math.max(stats.wins + stats.losses, 1) * 100).toFixed(1)}%*\n` +
      `Mode: ${config.botMode}${config.isDryRun ? ' (dry-run)' : ''}`
    );
  });

  onCommand('balance', async (chatId) => {
    const bal = await getBalance().catch(() => ({ solBalance: 0, address: 'Error' }));
    await sendMessageToChat(chatId,
      `💰 *Wallet*\n\n` +
      `Address: \`${bal.address}\`\n` +
      `Balance: *${bal.solBalance.toFixed(4)} SOL*`
    );
  });

  onCommand('pause', async (chatId) => {
    setPaused(true);
    await sendMessageToChat(chatId,
      `⏸️ *Bot Paused*\n\n_Screening & snipe dihentikan sementara.\nGunakan /resume untuk melanjutkan._`
    );
    console.log(chalk.yellow('[main] ⏸️ Bot paused by user'));
  });

  onCommand('resume', async (chatId) => {
    setPaused(false);
    await sendMessageToChat(chatId,
      `▶️ *Bot Resumed*\n\n_Screening & snipe aktif kembali._`
    );
    console.log(chalk.green('[main] ▶️ Bot resumed by user'));
  });

  onCommand('silent', async (chatId) => {
    setSilent(true);
    await sendMessageToChat(chatId,
      `🔇 *Silent Mode Enabled*\n\n_Pipeline tetap jalan, notifikasi dimatikan.\nGunakan /speak untuk mengaktifkan notifikasi kembali._`
    );
    console.log(chalk.yellow('[main] 🔇 Silent mode enabled'));
  });

  onCommand('speak', async (chatId) => {
    setSilent(false);
    await sendMessageToChat(chatId,
      `🔊 *Silent Mode Disabled*\n\n_Notifikasi diaktifkan kembali._`
    );
    console.log(chalk.green('[main] 🔊 Silent mode disabled'));
  });

  onCommand('stop', async (chatId) => {
    // Guard: skip if already stopped (e.g. replayed old command on restart)
    if (isPaused()) return;

    await sendMessageToChat(chatId, `🛑 *Stopping bot…*`);
    console.log(chalk.red('[main] 🛑 Stop command received — shutting down'));

    const { stopDetector } = await import('./detector.js');
    const { stopMonitor } = await import('./monitor.js');
    const { stopCallbackPoller } = await import('./telegram.js');
    const { cleanupLocks } = await import('./concurrency.js');
    const { stopServerClient } = await import('./src/signals/serverClient.js');
    stopDetector();
    stopMonitor();
    stopCallbackPoller();
    stopServerClient();
    cleanupLocks();

    // Set paused flag so PM2 autorestart brings it back in idle state
    setPaused(true);
    await sendTelegram('🛑 *Sniper bot stopped*\n⏸️ _Auto-paused — PM2 will restart but bot stays idle. Send /resume to activate._');

    // Graceful exit — PM2 autorestart handles cleanup
    process.exit(0);
  });

  onCommand('restart', async (chatId) => {
    await sendMessageToChat(chatId, `🔄 *Restarting bot…*`);
    console.log(chalk.cyan('[main] 🔄 Restart command received'));

    const { stopDetector } = await import('./detector.js');
    const { stopMonitor } = await import('./monitor.js');
    const { stopCallbackPoller } = await import('./telegram.js');
    const { cleanupLocks } = await import('./concurrency.js');
    const { stopServerClient } = await import('./src/signals/serverClient.js');
    stopDetector();
    stopMonitor();
    stopCallbackPoller();
    stopServerClient();
    cleanupLocks();

    // Graceful exit — PM2 autorestart handles the restart cleanly
    process.exit(0);
  });

  onCommand('sync', async (chatId) => {
    console.log(chalk.cyan('[main] 🔄 Sync triggered by user…'));
    await sendMessageToChat(chatId, `🔄 *Syncing on-chain balances…*`);
    await reconcileNow();
    await sendMessageToChat(chatId, `✅ *Sync complete* — positions reconciled with on-chain state.`);
  });

onCommand('help', async (chatId) => {
    await sendMessageToChat(chatId,
      `🤖 *SniperAI Bot*\n\n` +
      `Available commands:\n` +
      `/start — Bot info & status\n` +
      `/status — Wallet & position summary\n` +
      `/balance — Wallet balance\n` +
      `/pause — ⏸️ Pause screening & snipe\n` +
      `/resume — ▶️ Resume screening & snipe\n` +
      `/silent — 🔇 Suppress notifications (pipeline tetap jalan)\n` +
      `/speak — 🔊 Resume notifications\n` +
      `/preset safe|degen|ape — 🎛️ Load preset profile\n` +
      `/stop — 🛑 Stop bot entirely\n` +
      `/restart — 🔄 Restart bot via PM2\n` +
      `/sync — 🔄 Sync on-chain positions (kalo lo jual manual)\n` +
      `/help — This message\n\n` +
      `_When a token passes screening, an inline alert appears with buy buttons._`
    );
  });

  onCommand('preset', async (chatId, args) => {
    const { loadPreset, getActivePreset } = await import('./config.js');
    const validPresets = ['safe', 'degen', 'ape'];

    if (!args.length || !validPresets.includes(args[0].toLowerCase())) {
      await sendMessageToChat(chatId,
        `🎛️ *Preset System*\n\n` +
        `Usage: /preset safe|degen|ape\n\n` +
        `Available presets:\n` +
        `🔒 *safe* — Maximum safety, slow entries, social required\n` +
        `⚡ *degen* — Fast entries, loose filters, volume focus\n` +
        `🦍 *ape* — YOLO, minimal filters, maximum speed`
      );
      return;
    }

    const presetName = args[0].toLowerCase();
    const preset = loadPreset(presetName);

    if (!preset) {
      await sendMessageToChat(chatId, `❌ Preset "${presetName}" not found. Check /help.`);
      return;
    }

    // Reload fresh config after preset merge
    const { getConfig } = await import('./config.js');
    const cfg = getConfig();

    await sendMessageToChat(chatId,
      `🎛️ *Preset Applied: ${preset.label}*\n\n` +
      `_${preset.description}_\n\n` +
      `📋 *Settings changed:*\n` +
      `• Snipe Threshold: *${cfg.screening.snipeThreshold}*\n` +
      `• Buy Amount: *${cfg.entry.buyAmountSol} SOL*\n` +
      `• Slippage: *${(cfg.entry.slippageBps / 100).toFixed(1)}%*\n` +
      `• Max Positions: *${cfg.risk.maxOpenPositions}*\n` +
      `• Max Daily Trades: *${cfg.risk.maxDailyTrades}*\n` +
      `• Stop Loss: *${cfg.exit.stopLossPct}%*\n` +
      `• Trailing Stop: *${cfg.exit.trailingStopPct}%*`
    );

    console.log(chalk.cyan(`[main] 🎛️ Preset loaded: ${presetName} (${preset.label})`));
  });

  // Start callback poller untuk inline keyboard
  startCallbackPoller(handleCallback);

  // Check paused flag — if stopped previously, stay idle
  if (isPaused()) {
    await sendTelegram(
      `⏸️ *Bot restarted in paused mode*\n\n` +
      `_Bot was stopped previously and PM2 restarted it._\n` +
      `Send /resume to activate screening & sniper._`
    );
    console.log(chalk.yellow('[main] ⏸️ Bot started in paused mode. Send /resume to activate.'));
    process.stdin.resume();
    return; // Don't start services
  }

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

    // Start signal server polling client
    const { startServerClient } = await import('./src/signals/serverClient.js');
    startServerClient();
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
    // 📡 Subscribe to trades for this token — biar data trade terkumpul selama delay
    subscribeTokenTrades(tokenData.mint);

    // ⭐ Delay screening 8-12 detik biar ada data trade (dulu 10-15s, kurangin biar gak kelewatan)
    const delayMs = Math.floor(Math.random() * 4000) + 8000; // 8.000 - 12.000 ms
    console.log(chalk.gray(`[main] ⏳ Waiting ${(delayMs / 1000).toFixed(0)}s for trade data… (${tokenData.symbol})`));
    await new Promise(r => setTimeout(r, delayMs));

    // Re-check pause — token might be in-flight when user paused
    if (isPaused()) {
      console.log(chalk.gray(`[main] ⏸️ ${tokenData.symbol} skipped (paused during delay)`));
      return;
    }

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
      // Skip Telegram spam jika cuma cooldown balance
      if (!isBalanceCooldownActive()) {
        await sendTelegram(
          `⛔ *Snipe Blocked*\nToken: ${tokenData.symbol}\nReasons:\n${riskCheck.reasons.join('\n')}`
        );
      }
      return;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STEP 3: CALCULATE BUY AMOUNT
    // ═════════════════════════════════════════════════════════════════════════
    const buyAmountSol = calculateBuyAmount(screenResult.score, screenResult);

    // ═════════════════════════════════════════════════════════════════════════════
    // STEP 4: EXECUTE BUY
    // ═════════════════════════════════════════════════════════════════════════════
    console.log(chalk.gray(`[main] STEP 4: buyAmount=${buyAmountSol}, mode=${config.botMode}`));

    if (config.botMode === 'semi-auto') {
      // ⭐ Rich UI dengan inline keyboard
      const { buildSnipeAlertText, buildSnipeKeyboard } = await import('./telegram-ui.js');
      const text = buildSnipeAlertText(tokenData, screenResult);
      const keyboard = buildSnipeKeyboard(tokenData.mint, screenResult.score);
      console.log(chalk.gray(`[main] 📤 Sending inline keyboard to Telegram for ${tokenData.symbol}`));
      await sendInlineKeyboard(text, keyboard);
      // 🔊 Sound + push notification for SNIPED alert
      sendSound(
        '🎯🔊 *SNIPED!*\n\n' +
        `Token: *${tokenData.symbol}* — Score: *${screenResult.score}/100*\n` +
        '_Mode: semi-auto — buy buttons attached_'
      ).catch(() => {});
      console.log(chalk.gray(`[main] ✅ Inline keyboard sent for ${tokenData.symbol}`));
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
        entryPriceSol:  buyResult.dryPriceSol                          // Dry run: real Pump.fun price
          ? buyResult.dryPriceSol
          : buyResult.tokenAmount > 0
          ? buyAmountSol / (buyResult.tokenAmount / 1_000_000)
          : 0,
        entryMcapSol:   buyResult.dryMcapSol                    // Dry run: real MCap from bonding curve
          ? buyResult.dryMcapSol
          : tokenData.marketCapSol > 0
          ? tokenData.marketCapSol
          : tokenData.initialBuySol > 0
          ? tokenData.initialBuySol * 300                    // Estimate: initBuy × 300 ≈ MCap
          : buyAmountSol * 500,                               // Last resort: buyAmt × 500
        tokenAmount:    buyResult.tokenAmount || 0,
        txHash:         buyResult.txHash,
        screenScore:    screenResult.score,
        bondingCurve:   tokenData.bondingCurve,
        tradeMode:      screenResult.mode || null,
      });

      recordBuy(buyAmountSol);

// Telegram notification with inline keyboard
      const notifText = (
        `✅ *SNIPED!*\n\n` +
        `Token: *${tokenData.symbol}*\n` +
        `Amount: *${buyAmountSol} SOL*\n` +
        `Score: *${screenResult.score}/100*\n` +
        `MCap: ${formatMcapUsd(tokenData.marketCapSol)}\n` +
        `Tx: \`${buyResult.txHash}\`\n\n` +
        `_Monitoring started — TP/SL active_`
      );
      // 🔊 Sound + push notification for SNIPED
      sendSound(
        '✅🔊 *SNIPED!*\n\n' +
        `Token: *${tokenData.symbol}*\n` +
        `Amount: *${buyAmountSol} SOL* — Score: *${screenResult.score}/100*\n` +
        '_Monitoring started — TP/SL active_'
      ).catch(() => {});
      await sendInlineKeyboard(
        notifText,
        buildSnipeResultKeyboard(tokenData.mint)
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
  const { stopCallbackPoller } = await import('./telegram.js');
  const { cleanupLocks } = await import('./concurrency.js');
  const { stopServerClient } = await import('./src/signals/serverClient.js');
  stopDetector();
  stopMonitor();
  stopCallbackPoller();
  stopServerClient();
  cleanupLocks();
  await sendTelegram('🛑 *Sniper bot stopped*');
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CALLBACK HANDLER — Untuk inline keyboard buttons
// ═══════════════════════════════════════════════════════════════════════════════

async function handleCallback({ action, mint, value, msgId, chatId, queryId }) {
  const config = getConfig();

  try {
    switch (action) {

      case 'buy': {
        const amountSol = parseFloat(value);
        if (!amountSol || amountSol <= 0) {
          await answerCallback(queryId, '❌ Invalid amount');
          return;
        }

        console.log(chalk.green(`[callback] 🎯 Buy ${amountSol} SOL → ${mint.slice(0, 8)}…`));

        // Check if paused
        if (isPaused()) {
          await answerCallback(queryId, '⏸️ Bot is paused — /resume first');
          return;
        }

        // Risk check

        const riskCheck = await preTradeRiskCheck();
        if (!riskCheck.canTrade) {
          await answerCallback(queryId, `⛔ ${riskCheck.reasons[0]}`);
          return;
        }

        // Execute buy
        const buyResult = await buyToken({
          mint,
          amountSol,
          slippageBps: config.entry.slippageBps,
        });

        if (buyResult.success) {
          // Save position
          savePosition(mint, {
            symbol: mint.slice(0, 8),
            name: mint.slice(0, 8),
            entryAmountSol: amountSol,
            entryPriceSol: buyResult.dryPriceSol
              ? buyResult.dryPriceSol
              : buyResult.tokenAmount > 0
              ? amountSol / (buyResult.tokenAmount / 1_000_000)
              : 0,
            entryMcapSol: buyResult.dryMcapSol
              ? buyResult.dryMcapSol
              : amountSol * 500,
            tokenAmount: buyResult.tokenAmount || 0,
            txHash: buyResult.txHash,
            screenScore: 0,
          });
          recordBuy(amountSol);

          const { buildBuyResultText, buildPositionStatusText, buildSellKeyboard } = await import('./telegram-ui.js');
          const resultText = buildBuyResultText(mint.slice(0, 8), amountSol, buyResult.txHash, config.isDryRun);
          await sendInlineKeyboard(resultText, null, msgId);
          await answerCallback(queryId, `✅ Bought ${amountSol} SOL`);

          // Send position status with SELL buttons
          const entryPriceSol = buyResult.dryPriceSol
            ? buyResult.dryPriceSol
            : buyResult.tokenAmount > 0
            ? amountSol / (buyResult.tokenAmount / 1_000_000)
            : 0;
          const pnlPct = 0;
          const pnlSol = 0;
          const statusText = buildPositionStatusText(
            mint.slice(0, 8), mint, amountSol, 1, pnlPct, pnlSol, 'Just now',
            0, 0
          );
          await sendMessageToChat(chatId, statusText, buildSellKeyboard(mint));
        } else {
          await answerCallback(queryId, `❌ ${buyResult.error?.slice(0, 60)}`);
          await sendTelegram(`❌ *Buy Failed*\nMint: \`${mint.slice(0, 8)}…\`\nError: ${buyResult.error}`);
        }
        break;
      }

      case 'custom': {
        await answerCallback(queryId, '🔢 Kirim jumlah SOL via chat');
        await sendTelegram(
          `🔢 *Custom Buy*\nToken: \`${mint.slice(0, 8)}…\`\n_Ketik jumlah SOL yang mau dibeli sebagai reply_`
        );
        break;
      }

      case 'monitor': {
        // Edit message: show monitor view
        await answerCallback(queryId, '📺 Monitoring');
        await sendInlineKeyboard(
          `📺 *Monitoring*\nToken: \`${mint.slice(0, 8)}…\`\n_Gak ada posisi open — watchlist aja_`,
          null,
          msgId
        );
        break;
      }

      case 'skip': {
        // Disable keyboard, keep message
        await answerCallback(queryId, '⏭️ Skipped');
        await editKeyboard(chatId, msgId, { inline_keyboard: [] });
        break;
      }

      case 'close': {
        // Delete message entirely
        await answerCallback(queryId, '❌ Closed');
        try {
          const token = config.telegram.botToken;
          await fetch(`https://api.telegram.org/bot${token}/deleteMessage?chat_id=${chatId}&message_id=${msgId}`);
        } catch {}
        break;
      }

      // ═══════════════════════════════════════════════════════════════════
      // SELL ACTIONS (for active positions)
      // ═══════════════════════════════════════════════════════════════════
      case 'sell': {
        const sellPct = parseInt(value);
        if (!sellPct || sellPct <= 0 || sellPct > 100) {
          await answerCallback(queryId, '❌ Invalid sell %');
          return;
        }

        // Check position exists
        const { getOpenPositions } = await import('./state.js');
        const positions = getOpenPositions();
        const pos = positions[mint];

        if (!pos) {
          await answerCallback(queryId, '⚠️ No active position');
          return;
        }

        await answerCallback(queryId, `Selling ${sellPct}%...`);

        const { sellToken, getTokenBalance } = await import('./executor.js');
        const sellResult = await sellToken({
          mint,
          sellPct,
          slippageBps: config.entry.slippageBps,
          tradeValueSol: (pos.entryAmountSol || 0) * (sellPct / 100),
          entryPriceSol: pos.entryPriceSol,
        });

        if (sellResult.success) {
          const solReceived = sellResult.solReceived || 0;
          const pnlSol = solReceived - ((pos.entryAmountSol || 0) * (sellPct / 100));

          // Update state
          const { updatePosition, closePosition } = await import('./state.js');
          const newSoldPct = (pos.soldPct || 0) + sellPct;

          if (newSoldPct >= 100) {
            closePosition(mint, {
              pnlSol,
              closeReason: 'manual_sell (inline)',
              closeType: 'manual',
              soldPct: 100,
              sellHistory: [...(pos.sellHistory || []), {
                sellPct,
                solReceived,
                pnlSol,
                reason: 'manual_sell',
                type: 'manual',
                timestamp: new Date().toISOString(),
              }],
            });
          } else {
            updatePosition(mint, {
              soldPct: newSoldPct,
              sellHistory: [...(pos.sellHistory || []), {
                sellPct,
                solReceived,
                pnlSol,
                reason: 'manual_sell',
                type: 'manual',
                timestamp: new Date().toISOString(),
              }],
            });
          }

          await sendInlineKeyboard(
            `💰 *Sold ${sellPct}%*\nToken: \`${mint.slice(0, 8)}…\`\nSOL: *${solReceived.toFixed(4)}*\nPnL: *${pnlSol >= 0 ? '+' : ''}${pnlSol.toFixed(4)} SOL*`,
            null,
            msgId
          );

          // Send fresh position status if still holding
          if (newSoldPct < 100) {
            const { buildPositionStatusText, buildSellKeyboard } = await import('./telegram-ui.js');
            const { sendMessageToChat } = await import('./telegram.js');
            const finalBal = sellResult.remainingTokens || (await getTokenBalance(mint));
            // Send new message as position update
            await sendMessageToChat(
              chatId,
              buildPositionStatusText(
                pos.symbol || mint.slice(0, 8),
                mint,
                pos.entryAmountSol || 0,
                pos.currentMultiple || 1,
                pos.pnlPct || 0,
                pnlSol,
                'Ongoing',
                pos.entryMcapSol || 0,
                pos.peakMcapSol || 0
              ),
              buildSellKeyboard(mint)
            );
          }
        } else {
          await answerCallback(queryId, `❌ ${(sellResult.error || '').slice(0, 40)}`);
        }
        break;
      }

      case 'refresh': {
        await answerCallback(queryId, '🔄 Refreshing...');
        const { getOpenPositions } = await import('./state.js');
        const positions = getOpenPositions();
        const pos = positions[mint];

        if (!pos) {
          await sendInlineKeyboard('⚠️ No active position', null, msgId);
          return;
        }

        const { buildPositionStatusText, buildSellKeyboard } = await import('./telegram-ui.js');
        const { getTokenPrice, getTokenBalance } = await import('./executor.js');

        const currentPrice = await getTokenPrice(mint);
        const currentMultiple = currentPrice && pos.entryPriceSol > 0
          ? currentPrice / pos.entryPriceSol : 1;
        const pnlPct = currentPrice && pos.entryPriceSol > 0
          ? ((currentPrice - pos.entryPriceSol) / pos.entryPriceSol) * 100 : 0;
        const pnlSol = pos.entryAmountSol > 0
          ? ((currentMultiple * pos.entryAmountSol) - pos.entryAmountSol) * (1 - (pos.soldPct || 0) / 100)
          : 0;

        const duration = pos.openedAt
          ? (() => {
              const ms = Date.now() - new Date(pos.openedAt).getTime();
              const mins = Math.floor(ms / 60000);
              const secs = Math.floor((ms % 60000) / 1000);
              return mins >= 1 ? `${mins}m` : `${secs}s`;
            })()
          : 'N/A';

        const currentMcapSol = pos.entryMcapSol > 0
          ? pos.entryMcapSol * currentMultiple
          : 0;

        await sendInlineKeyboard(
          buildPositionStatusText(
            pos.symbol || mint.slice(0, 8),
            mint,
            pos.entryAmountSol || 0,
            currentMultiple,
            pnlPct,
            pnlSol,
            duration,
            pos.entryMcapSol || 0,
            pos.peakMcapSol || 0,
            currentMcapSol
          ),
          buildSellKeyboard(mint),
          msgId
        );
        break;
      }

      default:
        await answerCallback(queryId, 'Unknown action');
    }
  } catch (e) {
    console.error(chalk.red(`[callback] Error: ${e.message}`));
    await answerCallback(queryId, `Error: ${e.message.slice(0, 40)}`);
  }
}

process.on('uncaughtException', async (err) => {
  console.error(chalk.red(`💥 Uncaught: ${err.message}`));
  await sendTelegram(`💥 *Error*: ${err.message}`).catch(() => {});
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
main().catch(err => {
  console.error(chalk.red(`Fatal: ${err.message}`));
  process.exit(1);
});

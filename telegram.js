/**
 * telegram.js
 * Telegram notification & command handler
 */

import chalk from 'chalk';
import { getConfig } from './config.js';

let bot = null;
let paused = false;

// ─── Init Telegram Bot ────────────────────────────────────────────────────────
export async function initTelegram() {
  const config = getConfig();
  if (!config.telegram.botToken || !config.telegram.chatId) {
    console.log(chalk.yellow('[telegram] No token/chatId configured — notifications disabled'));
    return;
  }

  try {
    const TelegramBot = (await import('node-telegram-bot-api')).default;
    bot = new TelegramBot(config.telegram.botToken, { polling: true });

    // Command handlers
    bot.onText(/\/status/, async () => {
      const { getMonitorStatus } = await import('./monitor.js');
      const { getDailyStats, getWinRate } = await import('./state.js');
      const { getDetectorStatus } = await import('./detector.js');
      const { getBalance } = await import('./executor.js');

      const stats = getDailyStats();
      const monitor = getMonitorStatus();
      const detector = getDetectorStatus();
      let balanceInfo = 'N/A';
      try {
        const { solBalance } = await getBalance();
        balanceInfo = `${solBalance.toFixed(4)} SOL`;
      } catch {}

      await sendTelegram(
        `📊 *Bot Status*\n\n` +
        `Connected: ${detector.connected ? '✅' : '❌'}\n` +
        `Monitoring: ${monitor.positions} positions\n` +
        `Balance: ${balanceInfo}\n\n` +
        `*Today:*\n` +
        `Trades: ${stats.tradesCount}\n` +
        `Win Rate: ${getWinRate()}%\n` +
        `PnL: ${stats.totalPnlSol >= 0 ? '+' : ''}${stats.totalPnlSol.toFixed(4)} SOL\n` +
        `Paused: ${paused ? '⏸️ Yes' : '▶️ No'}`
      );
    });

    bot.onText(/\/pause/, async () => {
      paused = true;
      await sendTelegram('⏸️ Bot paused — will not enter new positions');
    });

    bot.onText(/\/resume/, async () => {
      paused = false;
      await sendTelegram('▶️ Bot resumed — ready to snipe');
    });

    bot.onText(/\/positions/, async () => {
      const { getOpenPositions } = await import('./state.js');
      const positions = getOpenPositions();
      const mints = Object.keys(positions);

      if (mints.length === 0) {
        await sendTelegram('📭 No open positions');
        return;
      }

      const lines = mints.map(mint => {
        const p = positions[mint];
        const pnl = p.pnlPct ? `${p.pnlPct.toFixed(1)}%` : '?';
        const multiple = p.currentMultiple ? `${p.currentMultiple.toFixed(2)}x` : '?';
        return `• *${p.symbol || mint.slice(0, 8)}* — ${multiple} (${pnl})`;
      });

      await sendTelegram(`📊 *Open Positions (${mints.length}):*\n\n${lines.join('\n')}`);
    });

    console.log(chalk.green('[telegram] ✅ Bot initialized'));
  } catch (e) {
    console.warn(chalk.yellow(`[telegram] Init failed: ${e.message}`));
  }
}

// ─── Send message ─────────────────────────────────────────────────────────────
export async function sendTelegram(message) {
  const config = getConfig();
  if (!bot || !config.telegram.chatId) return;

  try {
    await bot.sendMessage(config.telegram.chatId, message, { parse_mode: 'Markdown' });
  } catch (e) {
    console.warn(chalk.yellow(`[telegram] Send failed: ${e.message}`));
  }
}

// ─── Pause state ──────────────────────────────────────────────────────────────
export function isPaused() { return paused; }
export function setPaused(val) { paused = val; }

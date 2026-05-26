/**
 * telegram.js
 * Telegram Bot — Send + Inline Keyboard + Callback Handler
 * 
 * Dual mode:
 * - send-only (existing): kirim notifikasi
 * - interactive: inline keyboard + callback polling untuk UI snipe
 */

import chalk from 'chalk';
import { getConfig } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '.sniperai-state.json');

let bot = null;
let paused = false;
let silent = false;
let callbackInterval = null;
let callbackHandlerRef = null;
const POLL_INTERVAL_MS = 10000;
let lastUpdateId = 0;
const bootTimestamp = Math.floor(Date.now() / 1000); // Guard against replaying old commands

// ─── Persistent State ──────────────────────────────────────────────────────────

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      paused = !!data.paused;
      silent = !!data.silent;
      if (typeof data.lastUpdateId === 'number') {
        lastUpdateId = data.lastUpdateId;
      }
    }
  } catch (e) {
    // Corrupted file — reset
    paused = false;
    silent = false;
    lastUpdateId = 0;
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ paused, silent, lastUpdateId }));
  } catch (e) {
    console.warn(chalk.yellow(`[telegram] Failed to save state: ${e.message}`));
  }
}

// Load persisted state on module init
loadState();

// Re-export pause state
export function isPaused() { return paused; }
export function setPaused(val) {
  paused = val;
  saveState(); // Persist so it survives PM2 restart
}

// ─── Telegram Rate Limiter ─────────────────────────────────────────────────────
let _rateLimitUntil = 0; // Timestamp kapan boleh kirim lagi

/**
 * Cek & apply rate limit sebelum kirim pesan
 * Kalau kena 429, drop aja — gak usah di-queue.
 */
async function _rateLimitedSend(fn, label) {
  const now = Date.now();

  // Silent mode — drop semua notifikasi
  if (silent) {
    return;
  }

  // Masih dalam cooldown? Drop aja
  if (now < _rateLimitUntil) {
    console.warn(chalk.gray(`[telegram] ⏳ ${label} dropped (rate limited ${Math.round((_rateLimitUntil - now) / 1000)}s remaining)`));
    return;
  }

  try {
    const res = await fn();
    if (res && !res.ok) {
      const body = await res.text().catch(() => '');
      // Cek 429 — rate limited
      if (res.status === 429) {
        let retryAfter = 10;
        try {
          const json = JSON.parse(body);
          const match = json.description?.match(/retry after (\d+)/);
          if (match) retryAfter = parseInt(match[1]);
        } catch {}
        _rateLimitUntil = Date.now() + (retryAfter * 1000);
        console.warn(chalk.yellow(`[telegram] ⛔ Rate limited for ${retryAfter}s — dropping messages until cooldown ends`));
        return;
      }
      return { ok: false, status: res.status, body };
    }
    return { ok: true };
  } catch (e) {
    console.warn(chalk.yellow(`[telegram] ${label} failed: ${e.message}`));
  }
}

// ─── Silent Mode — suppress notifications, pipeline tetap jalan ─────────────
export function isSilent() { return silent; }
export function setSilent(val) {
  silent = val;
  saveState(); // Persist
}

/**
 * Init Telegram Bot
 */
export async function initTelegram() {
  const config = getConfig();
  if (!config.telegram.botToken || !config.telegram.chatId) {
    console.log(chalk.yellow('[telegram] No token/chatId configured — notifications disabled'));
    return;
  }

  try {
    const TelegramBot = (await import('node-telegram-bot-api')).default;
    bot = new TelegramBot(config.telegram.botToken, { polling: false });
    console.log(chalk.green('[telegram] ✅ Bot initialized'));
  } catch (e) {
    console.warn(chalk.yellow(`[telegram] Init failed: ${e.message}`));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send plain text message (backward compatible) — pake fetch langsung
 */
export async function sendTelegram(message) {
  const token = getConfig().telegram.botToken;
  const chatId = getConfig().telegram.chatId;
  if (!token || !chatId) return;

  await _rateLimitedSend(async () => {
    return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
  }, 'sendMessage');
}

/**
 * Send message with inline keyboard — pake fetch langsung
 */
export async function sendInlineKeyboard(text, keyboard, editMsgId = null) {
  const token = getConfig().telegram.botToken;
  const chatId = getConfig().telegram.chatId;
  if (!token || !chatId) return;
  if (!keyboard) return sendMessageToChat(chatId, text);

  const label = editMsgId ? 'editInlineKeyboard' : 'sendInlineKeyboard';

  await _rateLimitedSend(async () => {
    const url = editMsgId
      ? `https://api.telegram.org/bot${token}/editMessageText?chat_id=${chatId}&message_id=${editMsgId}`
      : `https://api.telegram.org/bot${token}/sendMessage`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        editMsgId
          ? { chat_id: chatId, message_id: editMsgId, text, parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: JSON.stringify(keyboard) }
          : { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: JSON.stringify(keyboard) }
      ),
    });

    // Kalo markdown error — fallback ke plain text
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (errBody.includes('can\'t parse entities')) {
        console.warn(chalk.yellow(`[telegram] ⚠️ Markdown parse error, sending as plain text`));
        // Kirim ulang pake parse_mode None
        const fallbackRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            editMsgId
              ? { chat_id: chatId, message_id: editMsgId, text, reply_markup: JSON.stringify(keyboard) }
              : { chat_id: chatId, text, reply_markup: JSON.stringify(keyboard) }
          ),
        });
        if (!fallbackRes.ok) {
          console.error(chalk.red(`[telegram] ❌ ${label} fallback also failed: ${await fallbackRes.text().catch(() => '')}`));
        }
      } else {
        console.error(chalk.red(`[telegram] ❌ ${label} failed: ${errBody}`));
      }
    }

    return res;
  }, label);
}

/**
 * Edit keyboard buttons on existing message (e.g., disable after click)
 */
export async function editKeyboard(chatId, msgId, keyboard) {
  const token = getConfig().telegram.botToken;
  if (!token || !chatId || !msgId) return;
  await _rateLimitedSend(async () => {
    return fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: msgId, reply_markup: JSON.stringify(keyboard) }),
    });
  }, 'editKeyboard');
}

/**
 * Answer callback query (remove loading state on button)
 */
export async function answerCallback(callbackQueryId, text = '') {
  const token = getConfig().telegram.botToken;
  if (!token || !callbackQueryId) return;
  await _rateLimitedSend(async () => {
    return fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  }, 'answerCallback');
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE POLLER — Manual getUpdates untuk callback_query + commands
// ═══════════════════════════════════════════════════════════════════════════════

const _commandHandlers = new Map(); // command → handler function

/**
 * Register a command handler
 * @param {string} cmd - command name without / (e.g. 'start', 'status')
 * @param {Function} handler - async (chatId, args, msg) => {}
 */
export function onCommand(cmd, handler) {
  _commandHandlers.set(cmd.toLowerCase(), handler);
}

/**
 * Start polling updates (callback queries + commands)
 * @param {Function} callbackHandler - function to handle callback data
 */
export function startCallbackPoller(callbackHandler) {
  if (callbackInterval) return;

  callbackHandlerRef = callbackHandler;
  callbackInterval = setInterval(pollUpdates, POLL_INTERVAL_MS);
  console.log(chalk.green(`[telegram] 📡 Update poller started (every ${POLL_INTERVAL_MS / 1000}s)`));
}

export function stopCallbackPoller() {
  if (callbackInterval) {
    clearInterval(callbackInterval);
    callbackInterval = null;
    callbackHandlerRef = null;
    console.log(chalk.yellow('[telegram] 📡 Update poller stopped'));
  }
}

async function pollUpdates() {
  if (!bot) return;

  try {
    const { parseCallbackData } = await import('./telegram-ui.js');
    const token = getConfig().telegram.botToken;
    if (!token) return;

    // Poll both callback_query and message updates
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=5&allowed_updates=["callback_query","message"]`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok || !data.result?.length) return;

    for (const update of data.result) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);

      // ── Handle callback_query (inline button clicks) ──────────────────────
      const cq = update.callback_query;
      if (cq) {
        await handleCallbackQuery(cq);
        continue;
      }

      // ── Handle regular messages (commands) ────────────────────────────────
      const msg = update.message;
      if (msg?.text) {
        // Skip old messages replayed after restart
        if (msg.date < bootTimestamp - 5) continue;
        await handleMessage(msg);
      }
    }

    // Persist lastUpdateId so restart doesn't replay old commands
    saveState();
  } catch (e) {
    // Silent — polling errors are normal
  }
}

async function handleCallbackQuery(cq) {
  const { parseCallbackData } = await import('./telegram-ui.js');

  const parsed = parseCallbackData(cq.data);
  if (!parsed) {
    await answerCallback(cq.id, 'Invalid action');
    return;
  }

  if (callbackHandlerRef) {
    await callbackHandlerRef({
      ...parsed,
      msgId: cq.message?.message_id,
      chatId: cq.message?.chat?.id,
      queryId: cq.id,
      from: cq.from,
    });
  }
}

async function handleMessage(msg) {
  const text = msg.text.trim();
  const chatId = msg.chat.id;

  // /command
  if (text.startsWith('/')) {
    const parts = text.split(' ');
    const cmd = parts[0].toLowerCase().replace('/', '');
    const args = parts.slice(1);

    const handler = _commandHandlers.get(cmd);
    if (handler) {
      try {
        await handler(chatId, args, msg);
      } catch (e) {
        console.warn(chalk.yellow(`[telegram] Command /${cmd} error: ${e.message}`));
      }
    } else {
      // Unknown command — show help
      await sendMessageToChat(chatId,
        `🤖 *SniperAI Bot*\n\n` +
        `Available commands:\n` +
        `/start — Bot info & status\n` +
        `/status — Wallet & position summary\n` +
        `/balance — Wallet balance\n` +
        `/help — This message\n\n` +
        `_New token alerts will appear automatically with inline buy buttons._`
      );
    }
  }
}

/**
 * Send message to specific chat — pake fetch langsung biar gak masalah library
 */
export async function sendMessageToChat(chatId, text, keyboard = null) {
  const token = getConfig().telegram.botToken;
  if (!token) return;

  await _rateLimitedSend(async () => {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };
    if (keyboard) body.reply_markup = JSON.stringify(keyboard);
    return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }, 'sendMessageToChat');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOUND & PUSH NOTIFICATION — Terminal bell + Telegram vibration alert
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send a sound notification: terminal bell (\\x07) AND a Telegram message
 * with vibration (disable_notification: false for guaranteed push).
 * 
 * Use this for high-priority alerts like SNIPED events.
 * 
 * @param {string} message - The alert text to send
 */
export async function sendSound(message) {
  // Terminal bell — \x07 triggers audible beep in most terminals
  process.stdout.write('\x07');
  console.log(chalk.magenta('[telegram] 🔊 Sound alert triggered'));

  // Send a high-priority Telegram notification with vibration effect
  // disable_notification: false ensures the user gets a push notification
  const token = getConfig().telegram.botToken;
  const chatId = getConfig().telegram.chatId;
  if (!token || !chatId) return;

  await _rateLimitedSend(async () => {
    return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        disable_notification: false,   // Force push notification with vibration
      }),
    });
  }, 'sendSound');
}

/**
 * serverClient.js — Signal Server HTTP Polling Client
 *
 * Polls api.thecharon.xyz for high-confidence token signals.
 * Supports:
 *   - HTTP polling with API key auth
 *   - Exponential backoff on failure (1s → 2s → 4s → ... → max 30s)
 *   - 4xx/5xx error handling
 *   - Parses response and feeds into merger via onServerSignal()
 */

import chalk from 'chalk';
import { getConfig } from '../../config.js';
import { onServerSignal } from '../../merger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════

let pollTimer = null;
let isRunning = false;
let consecutiveErrors = 0;

const BASE_DELAY_MS = 1000;    // 1 second
const MAX_BACKOFF_MS = 30000;  // 30 seconds

// ═══════════════════════════════════════════════════════════════════════════════
// BACKOFF HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function getBackoffDelay() {
  const delay = Math.min(
    BASE_DELAY_MS * Math.pow(2, consecutiveErrors),
    MAX_BACKOFF_MS
  );
  return delay;
}

function resetBackoff() {
  consecutiveErrors = 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP FETCH WITH TIMEOUT
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLL — Single iteration
// ═══════════════════════════════════════════════════════════════════════════════

async function poll() {
  if (!isRunning) return;

  const config = getConfig();
  const hy = config.hybrid;

  // Skip if hybrid is disabled or server source is disabled (weight 0)
  if (!hy.enabled || hy.serverWeight <= 0) {
    scheduleNext(hy.signalPollMs || 30000);
    return;
  }

  const apiKey = hy.signalServerKey;
  if (!apiKey) {
    console.warn(chalk.yellow('[serverClient] ⚠️ SIGNAL_SERVER_KEY not configured — skipping poll'));
    scheduleNext(hy.signalPollMs || 30000);
    return;
  }

  try {
    const url = `${hy.signalServerUrl}/api/signals?limit=20`;
    console.log(chalk.gray(`[serverClient] 📡 Polling ${url} …`));

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // ── Error handling for 4xx/5xx ──────────────────────────────────────
    if (!response.ok) {
      const status = response.status;
      const statusText = response.statusText;

      if (status >= 400 && status < 500) {
        // Client error — log warning but don't backoff aggressively
        console.warn(chalk.yellow(
          `[serverClient] ⚠️ ${status} ${statusText} — check API key or endpoint`
        ));
        // Try to get error body for debugging
        try {
          const errBody = await response.text();
          if (errBody) console.warn(chalk.gray(`[serverClient] Response body: ${errBody.slice(0, 200)}`));
        } catch (_) {}
        consecutiveErrors = Math.min(consecutiveErrors + 1, 5);
      } else if (status >= 500) {
        // Server error — exponential backoff
        console.error(chalk.red(
          `[serverClient] ❌ Server error ${status} ${statusText} — backing off`
        ));
        consecutiveErrors++;
      }

      const backoff = getBackoffDelay();
      console.log(chalk.gray(`[serverClient] ⏳ Next poll in ${(backoff / 1000).toFixed(0)}s (backoff #${consecutiveErrors})`));
      scheduleNext(backoff);
      return;
    }

    // ── Success ─────────────────────────────────────────────────────────
    resetBackoff();

    const data = await response.json();

    // Handle different response shapes
    const signals = Array.isArray(data)
      ? data
      : (data.signals || data.data || data.tokens || []);

    if (!Array.isArray(signals)) {
      console.warn(chalk.yellow(`[serverClient] ⚠️ Unexpected response format — expected array, got ${typeof signals}`));
      scheduleNext(hy.signalPollMs || 30000);
      return;
    }

    if (signals.length === 0) {
      console.log(chalk.gray(`[serverClient] 📭 No new signals`));
      scheduleNext(hy.signalPollMs || 30000);
      return;
    }

    console.log(chalk.cyan(`[serverClient] 📨 ${signals.length} signal(s) received`));

    for (const signal of signals) {
      // Normalize signal fields
      const normalized = {
        mint:        signal.mint || signal.address || signal.tokenAddress || '',
        symbol:      signal.symbol || '',
        name:        signal.name || '',
        sourceCount: signal.sourceCount || signal.sources || 1,
        trendingRank: signal.trendingRank || signal.rank || null,
        volume24h:   signal.volume24h || signal.volume || signal.volume24hUsd || 0,
        holders:     signal.holders || signal.holderCount || signal.holder_count || 0,
        feeClaim:    signal.feeClaim || signal.fee_claim || false,
        graduated:   signal.graduated || signal.isGraduated || false,
        score:       signal.score || signal.confidence || 0,
        timestamp:   signal.timestamp || Date.now(),
      };

      if (!normalized.mint) {
        console.warn(chalk.yellow('[serverClient] ⚠️ Signal missing mint address — skipping'));
        continue;
      }

      // Feed into merger
      onServerSignal(normalized);
    }

    scheduleNext(hy.signalPollMs || 30000);

  } catch (err) {
    // Network / timeout / parse errors
    if (err.name === 'AbortError') {
      console.error(chalk.red(`[serverClient] ❌ Request timed out`));
    } else {
      console.error(chalk.red(`[serverClient] ❌ Poll error: ${err.message}`));
    }

    consecutiveErrors++;
    const backoff = getBackoffDelay();
    console.log(chalk.gray(`[serverClient] ⏳ Next poll in ${(backoff / 1000).toFixed(0)}s (backoff #${consecutiveErrors})`));
    scheduleNext(backoff);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════════

function scheduleNext(delayMs) {
  if (!isRunning) return;

  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(() => {
    poll();
  }, delayMs);
}

// ═══════════════════════════════════════════════════════════════════════════════
// START / STOP
// ═══════════════════════════════════════════════════════════════════════════════

export function startServerClient() {
  if (isRunning) {
    console.log(chalk.yellow('[serverClient] Already running'));
    return;
  }

  const config = getConfig();
  const hy = config.hybrid;

  if (!hy.enabled || hy.serverWeight <= 0) {
    console.log(chalk.gray('[serverClient] ⏭️ Signal server disabled (weight 0 or hybrid disabled)'));
    return;
  }

  if (!hy.signalServerUrl) {
    console.log(chalk.gray('[serverClient] ⏭️ signalServerUrl not configured'));
    return;
  }

  isRunning = true;
  console.log(chalk.green(
    `[serverClient] ✅ Started — polling ${hy.signalServerUrl} every ${(hy.signalPollMs / 1000).toFixed(0)}s`
  ));

  // Immediate first poll, then schedule repeats
  poll();
}

export function stopServerClient() {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  console.log(chalk.gray('[serverClient] ⏹️ Stopped'));
}

export function getServerClientStatus() {
  return {
    running: isRunning,
    consecutiveErrors,
    nextBackoffMs: getBackoffDelay(),
  };
}
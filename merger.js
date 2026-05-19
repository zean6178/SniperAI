/**
 * merger.js — Hybrid Signal Merger
 * 
 * Menggabungkan 3 source:
 *   1. PumpPortal WS (real-time, 30% weight)
 *   2. Signal Server api.thecharon.xyz (high confidence, 50% weight)
 *   3. Jupiter Trending (momentum signal, 20% weight)
 * 
 * Flow: WS/Server/Trending → merger → weighted score → screening → executor
 */

import chalk from 'chalk';
import { getConfig } from './config.js';

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL QUEUE — Dedup & Merge
// ═══════════════════════════════════════════════════════════════════════════════

const signalQueue = new Map(); // mint → { wsData, serverData, trendingData, firstSeen }
let isProcessing = false;

function pruneQueue() {
  const cutoff = Date.now() - getConfig().hybrid.dedupWindowMs;
  for (const [mint, entry] of signalQueue) {
    if (entry.firstSeen < cutoff) signalQueue.delete(mint);
  }
}

// ─── Ingest dari PumpPortal WS ────────────────────────────────────────────────
export function onWsToken(tokenData) {
  if (!getConfig().hybrid.enabled) return;

  const mint = tokenData.mint;
  if (!mint) return;

  if (signalQueue.has(mint)) {
    signalQueue.get(mint).wsData = tokenData;
  } else {
    signalQueue.set(mint, {
      wsData: tokenData,
      serverData: null,
      trendingData: null,
      firstSeen: Date.now(),
    });
  }
  pruneQueue();

  evalSignal(mint, 'fast_snipe');
}

// ─── Ingest dari Signal Server ────────────────────────────────────────────────
export function onServerSignal(signalData) {
  if (!getConfig().hybrid.enabled) return;

  const mint = signalData.mint;
  if (!mint) return;

  const entry = signalQueue.get(mint);
  if (entry) {
    entry.serverData = signalData;
    // Kalo WS juga udah ada → high_confidence
    evalSignal(mint, entry.wsData ? 'high_confidence' : 'swing');
  } else {
    signalQueue.set(mint, {
      wsData: null,
      serverData: signalData,
      trendingData: null,
      firstSeen: Date.now(),
    });
    evalSignal(mint, 'swing');
  }
}

// ─── Ingest dari Trending (update score-only) ─────────────────────────────────
export function onTrendingData(trendingData) {
  if (!getConfig().hybrid.enabled) return;

  const mint = trendingData.address || trendingData.mint;
  if (!mint) return;

  const entry = signalQueue.get(mint);
  if (entry) {
    entry.trendingData = trendingData;
    // Trending gak trigger entry — cuma update score
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVALUATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

async function evalSignal(mint, strategy) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const config = getConfig();
    const entry = signalQueue.get(mint);
    if (!entry) return;

    const hy = config.hybrid;
    let combinedScore = 0;
    let totalWeight = 0;

    // WS score
    if (entry.wsData) {
      const wsScore = fastScore(entry.wsData);
      combinedScore += wsScore * hy.wsWeight;
      totalWeight += hy.wsWeight;
    }

    // Server score
    if (entry.serverData) {
      const serverScore = calcServerScore(entry.serverData);
      combinedScore += serverScore * hy.serverWeight;
      totalWeight += hy.serverWeight;
    }

    // Trending score
    if (entry.trendingData) {
      const trendingScore = calcTrendingScore(entry.trendingData);
      combinedScore += trendingScore * hy.trendingWeight;
      totalWeight += hy.trendingWeight;
    }

    const finalScore = totalWeight > 0 ? Math.round(combinedScore / totalWeight) : 0;

    console.log(chalk.cyan(
      `[merger] ${strategy} | ${entry.wsData?.symbol || mint.slice(0, 8)} | ` +
      `Score: ${finalScore}/100 | Sources: ${entry.wsData ? 'WS' : ''}${entry.serverData ? '+Server' : ''}${entry.trendingData ? '+Trending' : ''}`
    ));

    // Threshold per strategy
    const threshold = strategy === 'high_confidence' ? 50
                    : strategy === 'fast_snipe' ? 65
                    : 60;

    if (finalScore < threshold) {
      console.log(chalk.gray(`[merger] Score ${finalScore} < ${threshold}, skipping`));
      return;
    }

    // Forward ke onNewToken callback (screening pipeline atau Telegram)
    if (onDecision) {
      onDecision({
        mint,
        symbol: entry.wsData?.symbol || entry.serverData?.symbol || '???',
        name: entry.wsData?.name || '',
        deployer: entry.wsData?.deployer || '',
        marketCapSol: entry.wsData?.marketCapSol || 0,
        initialBuySol: entry.wsData?.initialBuySol || 0,
        score: finalScore,
        strategy,
        sources: {
          ws: !!entry.wsData,
          server: !!entry.serverData,
          trending: !!entry.trendingData,
        },
        timestamp: Date.now(),
      });
    }
  } catch (e) {
    console.error(chalk.red(`[merger] Error: ${e.message}`));
  } finally {
    isProcessing = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAST SCORE — dari WS data (instant, tanpa RPC call)
// ═══════════════════════════════════════════════════════════════════════════════

function fastScore(token) {
  let score = 50;

  // Dev initial buy — not too big, not too small
  const initBuy = token.initialBuySol || 0;
  if (initBuy > 0.01 && initBuy < 1) score += 10;
  else if (initBuy > 1) score -= 10;

  // Market cap
  const mcap = token.marketCapSol || 0;
  if (mcap > 10 && mcap < 500) score += 10;
  else if (mcap > 500) score -= 5;

  return Math.max(0, Math.min(100, score));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER SCORE — dari api.thecharon.xyz
// ═══════════════════════════════════════════════════════════════════════════════

function calcServerScore(signal) {
  let score = 50;

  const srcCount = signal.sourceCount || 1;
  score += (srcCount - 1) * 10;

  if (signal.trendingRank && signal.trendingRank <= 10) score += 20;
  else if (signal.trendingRank && signal.trendingRank <= 50) score += 10;

  const vol24h = signal.volume24h || 0;
  if (vol24h > 10000) score += 15;
  else if (vol24h > 1000) score += 10;
  else if (vol24h > 100) score += 5;

  const holders = signal.holders || 0;
  if (holders > 100) score += 10;
  else if (holders > 50) score += 5;

  if (signal.feeClaim) score += 15;
  if (signal.graduated) score += 10;

  return Math.max(0, Math.min(100, score));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRENDING SCORE — dari Jupiter Trending API
// ═══════════════════════════════════════════════════════════════════════════════

function calcTrendingScore(trend) {
  let score = 50;

  const rank = trend.rank || 999;
  if (rank <= 5) score += 25;
  else if (rank <= 10) score += 15;
  else if (rank <= 25) score += 10;
  else if (rank <= 50) score += 5;

  const volume = trend.volume || 0;
  if (volume > 50000) score += 15;
  else if (volume > 5000) score += 10;

  const mcap = trend.market_cap || 0;
  if (mcap > 10000 && mcap < 1000000) score += 10;

  const holders = trend.holder_count || 0;
  if (holders > 200) score += 10;
  else if (holders > 50) score += 5;

  return Math.max(0, Math.min(100, score));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALLBACK & STATUS
// ═══════════════════════════════════════════════════════════════════════════════

let onDecision = null;

export function setOnDecision(callback) {
  onDecision = callback;
}

export function getMergerStatus() {
  return {
    queueSize: signalQueue.size,
    processing: isProcessing,
  };
}

/**
 * Detector Service — Wraps bot engine for multi-user API
 * 
 * Manages the token feed, scoring cache, and WebSocket broadcasts.
 */

import { broadcastNewToken, broadcastScoreUpdate } from '../ws/handler.js';
import { publishToRedis } from '../db/redis.js';

// In-memory token feed (last 500 tokens scored)
const tokenFeed = [];
const MAX_FEED_SIZE = 500;

// Token detail cache
const tokenDetailCache = new Map(); // mint → detail

/**
 * Start the detector service
 * Imports and starts the core bot detector
 */
export function startDetectorService() {
  console.log('[detector-service] Starting...');
  // The core detector is started from the main bot engine
  // Here we hook into it for API/WS broadcasting
}

/**
 * Called by the bot engine when a new token is screened
 * @param {object} screenResult - { decision, score, reasons, data }
 */
export function onTokenScreened(screenResult) {
  const entry = {
    mint: screenResult.data.mint,
    symbol: screenResult.data.symbol,
    name: screenResult.data.name,
    score: screenResult.score,
    decision: screenResult.decision,
    deployer: screenResult.data.deployer,
    bondingCurvePct: screenResult.data.bondingCurvePct || null,
    marketCapSol: screenResult.data.marketCapSol || 0,
    volume5mSol: screenResult.data.volume5mSol || 0,
    buyCount5m: screenResult.data.buyCount5m || 0,
    uniqueBuyers: screenResult.data.uniqueBuyers || 0,
    isBundled: screenResult.data.isBundled || false,
    reasons: screenResult.reasons,
    detectedAt: screenResult.timestamp || new Date().toISOString(),
  };

  // Add to feed
  tokenFeed.unshift(entry);
  if (tokenFeed.length > MAX_FEED_SIZE) {
    tokenFeed.length = MAX_FEED_SIZE;
  }

  // Cache detail
  tokenDetailCache.set(entry.mint, {
    ...entry,
    currentPriceSol: null,
    holders: null,
    trades: null,
  });

  // Broadcast to WebSocket clients
  broadcastNewToken(entry);

  // Publish to Redis for other services
  publishToRedis('token:new', entry);
}

/**
 * Get token feed for API
 */
export function getTokenFeed({ minScore = 0, limit = 20, offset = 0, sortBy = 'time' }) {
  let filtered = tokenFeed.filter(t => t.score >= minScore);

  if (sortBy === 'score') {
    filtered.sort((a, b) => b.score - a.score);
  }
  // Default: sorted by time (newest first, already in order)

  return filtered.slice(offset, offset + limit);
}

/**
 * Get trending tokens (highest score in timeframe)
 */
export function getTrendingTokens({ timeframe = '5m', limit = 10 }) {
  const windowMs = timeframe === '1h' ? 3600000 : 300000;
  const cutoff = Date.now() - windowMs;

  return tokenFeed
    .filter(t => new Date(t.detectedAt).getTime() > cutoff)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get token detail
 */
export async function getTokenDetail(mint) {
  return tokenDetailCache.get(mint) || null;
}

/**
 * Get token history (for backtesting/review)
 */
export function getTokenHistory({ date, minScore = 0, outcome = 'all', limit = 50 }) {
  let filtered = tokenFeed.filter(t => t.score >= minScore);

  if (date) {
    filtered = filtered.filter(t => t.detectedAt?.startsWith(date));
  }

  return filtered.slice(0, limit);
}

/**
 * rugcheck.js
 * RugCheck.xyz API Integration — Token safety verification
 * 
 * API: https://api.rugcheck.xyz/v1/tokens/{mint}/report
 * Returns risk assessment: higher score = safer (300+ = decent)
 * 
 * Critical red flags:
 *   - Mint authority still enabled (dev can mint more)
 *   - Freeze authority enabled (dev can freeze holders)
 *   - Single holder > 50% (rug risk)
 *   - LP not burned / insufficient liquidity
 */

import axios from 'axios';
import chalk from 'chalk';

// ─── Config ───────────────────────────────────────────────────────────────────
const RUGCHECK_API_BASE = 'https://api.rugcheck.xyz/v1';
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit

// ─── Cache ────────────────────────────────────────────────────────────────────
const _cache = new Map();

function _getCached(mint) {
  const entry = _cache.get(mint);
  if (entry && (Date.now() - entry.ts) < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function _setCache(mint, data) {
  _cache.set(mint, { ts: Date.now(), data });
  // Evict old entries if cache grows too large
  if (_cache.size > 500) {
    const oldest = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) _cache.delete(oldest[0]);
  }
}

// ─── Critical Risk Names (dari RugCheck API) ────────────────────────────────
const CRITICAL_RISKS = [
  'Mint Authority',
  'Freeze Authority',
  'Single holder ownership',
  'Top holder concentration',
  'Liquidity',
  'Large pool imbalance',
  'Suspicious LP',
];

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check token safety via RugCheck.xyz
 * 
 * @param {string} mint - Token mint address
 * @param {object} [options] - Override config
 * @param {number} [options.minScore=300] - Minimum rugcheck score to pass
 * @param {boolean} [options.skipOnCriticalRisk=true] - Skip on critical risks
 * @returns {Promise<{
 *   safe: boolean,
 *   score: number|null,
 *   riskLevel: 'safe'|'warning'|'danger'|'unknown',
 *   risks: Array<{name: string, value: string, score: number, description: string}>,
 *   criticalRisks: string[],
 *   shouldSkip: boolean,
 *   skipReason: string|null,
 * }>}
 */
export async function checkToken(mint, options = {}) {
  const minScore = options.minScore ?? 300;
  const skipOnCriticalRisk = options.skipOnCriticalRisk ?? true;

  if (!mint || typeof mint !== 'string' || mint.length < 30) {
    return {
      safe: true,
      score: null,
      riskLevel: 'unknown',
      risks: [],
      criticalRisks: [],
      shouldSkip: false,
      skipReason: null,
    };
  }

  // Check cache
  const cached = _getCached(mint);
  if (cached) return cached;

  try {
    const url = `${RUGCHECK_API_BASE}/tokens/${mint}/report`;
    console.log(chalk.gray(`[rugcheck] 🔍 Verifying: ${mint.slice(0, 8)}…`));

    const res = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SniperAI/1.0',
      },
    });

    const report = res.data;
    if (!report) {
      const result = _unknownResult('Empty response');
      _setCache(mint, result);
      return result;
    }

    const risks = Array.isArray(report.risks) ? report.risks : [];
    const score = typeof report.score === 'number' ? report.score : null;

    // Extract critical risks
    const criticalRisks = [];
    for (const risk of risks) {
      const name = risk.name || '';
      const isCritical = CRITICAL_RISKS.some(cr => name.toLowerCase().includes(cr.toLowerCase()));
      if (isCritical) {
        criticalRisks.push(name + (risk.value ? `: ${risk.value}` : ''));
      }
    }

    // Scoring logic
    let shouldSkip = false;
    let skipReason = null;
    let riskLevel = 'safe';

    if (score !== null) {
      if (score < 100) {
        riskLevel = 'danger';
        if (skipOnCriticalRisk && criticalRisks.length > 0) {
          shouldSkip = true;
          skipReason = `🚫 RugCheck score ${score} (CRITICAL) — ${criticalRisks.slice(0, 3).join(', ')}`;
        } else if (score < minScore) {
          shouldSkip = true;
          skipReason = `🚫 RugCheck score ${score} < min ${minScore}`;
        }
      } else if (score < minScore) {
        riskLevel = 'warning';
        if (skipOnCriticalRisk && criticalRisks.length > 0) {
          shouldSkip = true;
          skipReason = `🚫 RugCheck score ${score} — ${criticalRisks.slice(0, 2).join(', ')}`;
        }
        // Don't skip on warning-level score alone, but mark it
      } else {
        riskLevel = 'safe';
      }
    } else {
      riskLevel = 'unknown';
    }

    const result = {
      safe: !shouldSkip,
      score,
      riskLevel,
      risks,
      criticalRisks,
      shouldSkip,
      skipReason,
    };

    _setCache(mint, result);
    return result;

  } catch (e) {
    // RugCheck API rate-limited or down — don't block trade
    if (e.response?.status === 429) {
      console.warn(chalk.yellow(`[rugcheck] Rate limited (429) — skipping validation`));
    } else if (e.response?.status === 404) {
      console.warn(chalk.yellow(`[rugcheck] Token not found on RugCheck: ${mint.slice(0, 8)}…`));
    } else {
      console.warn(chalk.gray(`[rugcheck] API error: ${e.message}`));
    }

    const result = _unknownResult(`API error: ${e.message}`);
    _setCache(mint, result);
    return result;
  }
}

/**
 * Quick assessment — return just the rugcheck score for scoring
 */
export async function getRugScore(mint) {
  const result = await checkToken(mint);
  return result.score;
}

/**
 * Get a score bonus/penalty from rugcheck for the screening pipeline
 * @param {string} mint
 * @returns {Promise<{bonus: number, label: string|null}>}
 */
export async function getRugScoreBonus(mint) {
  const result = await checkToken(mint);
  
  if (result.shouldSkip) {
    return { bonus: -100, label: `🚫 RugCheck SKIP (${result.score ?? '?'})` };
  }
  if (result.score === null) {
    return { bonus: 0, label: null };
  }
  if (result.score >= 700) {
    return { bonus: 20, label: `✅ RugCheck ${result.score} (very safe)` };
  }
  if (result.score >= 500) {
    return { bonus: 15, label: `✅ RugCheck ${result.score}` };
  }
  if (result.score >= 300) {
    return { bonus: 5, label: `⚠️ RugCheck ${result.score} (acceptable)` };
  }
  // Score < 300 but we didn't force-skip
  if (result.criticalRisks.length > 0) {
    return { bonus: -30, label: `🚫 RugCheck ${result.score} — ${result.criticalRisks[0]}` };
  }
  return { bonus: -10, label: `⚠️ RugCheck ${result.score} (low)` };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _unknownResult(reason) {
  return {
    safe: true,
    score: null,
    riskLevel: 'unknown',
    risks: [],
    criticalRisks: [],
    shouldSkip: false,
    skipReason: reason || null,
  };
}

/**
 * screening.js
 * Screening Pipeline — Evaluasi token baru apakah layak di-snipe
 * 
 * Pipeline:
 * 1. Pre-filter (age, blacklist) ← sudah di detector.js
 * 2. On-chain analysis (holders, dev wallet, bundling)
 * 3. Volume & momentum check (dari WS trade data)
 * 4. Confidence scoring
 * 5. Decision: SNIPE | WATCH | SKIP
 */

import axios from 'axios';
import chalk from 'chalk';
import { getConfig } from './config.js';
import { getTradeStats } from './detector.js';
import { isDeployerBlacklisted, addDeployerToBlacklist } from './state.js';
import { getConnection, rotateRpc } from './executor.js';
import { checkMayhemState } from './mayhem-check.js';
import { checkToken, getRugScoreBonus } from './rugcheck.js';
import { standardBundleCheck } from './bundle-detector.js';
import { recordTokenScan, getMarketCondition } from './market-conditions.js';

// ─── RPC Queue — sequential RPC calls, max 1 per 200ms ────────────────────────
const RPC_INTERVAL_MS = 200;
let _rpcQueue = Promise.resolve();

async function queuedRpc(fn, label) {
  const prev = _rpcQueue;
  let release;
  _rpcQueue = new Promise(resolve => { release = resolve; });
  await prev;
  await new Promise(r => setTimeout(r, RPC_INTERVAL_MS));
  try {
    return await fn();
  } finally {
    release();
  }
}

// Skip RPC-heavy checks entirely when fast-screening (via score < threshold)
function shouldSkipOnChain(config, tokenData) {
  const fastScore = tokenData.fastScore ?? tokenData._mergerScore ?? 0;
  return config.screening.skipOnChainIfLowScore && fastScore < (config.screening.onChainMinScore || 50);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREENING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluasi token baru → return decision + confidence score
 * @param {object} tokenData - dari index.js (via merger → handleNewToken)
 * @returns {Promise<{decision: string, score: number, reasons: string[], data: object}>}
 */
export async function runScreening(tokenData) {
  const config = getConfig();
  const sc = config.screening;
  const reasons = [];
  let score = 50; // Base score

  console.log(chalk.blue(`[screen] 🔬 Screening: ${tokenData.symbol} (${tokenData.mint?.slice(0, 8)}…)`));

  // Record token scan for market velocity tracking
  recordTokenScan();

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 0: Mayhem Mode Check — hindari token mayhem/paused
  // ═══════════════════════════════════════════════════════════════════════════
  const mayhem = await checkMayhemState(tokenData.mint);
  if (mayhem.isMayhem && mayhem.mayhemState === 'paused') {
    const reason = mayhem.reason || 'unknown';
    console.log(chalk.yellow(`[screen] 🚫 Mayhem PAUSED: ${tokenData.symbol} (${reason})`));
    return makeDecision('SKIP', 0, [`🚫 Mayhem paused: ${reason}`], tokenData);
  }
  if (mayhem.isMayhem && mayhem.mayhemState === 'active') {
    // Mayhem active = normal baru Pump.fun — kasi penalty kecil aja
    score -= 10;
    reasons.push('⚠️ Mayhem mode (no Raydium migration)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Token Age Check
  // ═══════════════════════════════════════════════════════════════════════════
  const ageMs = Date.now() - (tokenData.timestamp || Date.now());
  const ageSeconds = ageMs / 1000;
  const ageMinutes = ageSeconds / 60;

  if (ageSeconds < sc.minTokenAgeSeconds) {
    return makeDecision('SKIP', 0, [`Too new: ${ageSeconds.toFixed(0)}s < ${sc.minTokenAgeSeconds}s`], tokenData);
  }

  if (ageMinutes > sc.maxTokenAgeMinutes) {
    return makeDecision('SKIP', 0, [`Too old: ${ageMinutes.toFixed(0)}min > ${sc.maxTokenAgeMinutes}min`], tokenData);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1b: RugCheck.xyz — Token Safety Verification
  // ═══════════════════════════════════════════════════════════════════════════
  if (sc.rugcheck?.enabled) {
    try {
      const rugCheck = await checkToken(tokenData.mint, {
        minScore: sc.rugcheck.minScore || 300,
        skipOnCriticalRisk: sc.rugcheck.skipOnCriticalRisk !== false,
      });

      // ── Explicit mint/freeze authority labels ──────────────────────────
      const criticalNames = rugCheck.criticalRisks.map(r => r.toLowerCase());

      // Mint authority: if NOT in critical risks, it's revoked (good)
      const mintActive = criticalNames.some(r => r.includes('mint authority'));
      const freezeActive = criticalNames.some(r => r.includes('freeze authority'));

      if (!mintActive) {
        reasons.push('✅ Mint authority revoked');
        console.log(chalk.green(`  └ [rugcheck] ✅ Mint authority revoked`));
      } else {
        reasons.push('❌ Mint authority still active!');
        console.log(chalk.red(`  └ [rugcheck] ❌ Mint authority still active → SKIP`));
      }

      if (!freezeActive) {
        reasons.push('✅ Freeze authority revoked');
        console.log(chalk.green(`  └ [rugcheck] ✅ Freeze authority revoked`));
      } else {
        reasons.push('❌ Freeze authority active!');
        console.log(chalk.red(`  └ [rugcheck] ❌ Freeze authority active → SKIP`));
      }

      // ── Skip on critical risk (mint/freeze still active) ──────────────
      if (rugCheck.shouldSkip && rugCheck.skipReason) {
        reasons.push(`❌ ${rugCheck.skipReason}`);
        return makeDecision('SKIP', 0, reasons, tokenData);
      }

      // Add score bonus/penalty from rugcheck
      const rugBonus = await getRugScoreBonus(tokenData.mint);
      if (rugBonus.label) {
        score += rugBonus.bonus;
        reasons.push(rugBonus.label);
      }
    } catch (e) {
      if (!sc.rugcheck.skipOnApiError) {
        console.warn(chalk.yellow(`[screen] RugCheck error (non-blocking): ${e.message}`));
      } else {
        reasons.push('⏭️ RugCheck unavailable (API error)');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Trade Stats Analysis
  // ═══════════════════════════════════════════════════════════════════════════

  // Priority: in-memory WS trade data (if available — requires funded PumpPortal key)
  // On-chain RPC fetch is SKIPPED for now due to rate limits on free Helius RPC.
  // The merger score (_mergerScore) already accounts for signal strength.
  const tradeStats = getTradeStats(tokenData.mint, 5 * 60 * 1000);

  if (tradeStats) {
    // Buy count check
    if (tradeStats.buyCount >= sc.minBuyCount5m) {
      score += 15;
      reasons.push(`✅ Buy count: ${tradeStats.buyCount} (min: ${sc.minBuyCount5m})`);
    } else {
      score -= 10;
      reasons.push(`⚠️ Low buy count: ${tradeStats.buyCount} < ${sc.minBuyCount5m}`);
    }

    // Volume check
    if (tradeStats.totalBuySol >= sc.minVolume5mSol) {
      score += 10;
      reasons.push(`✅ Volume 5m: ${tradeStats.totalBuySol.toFixed(2)} SOL`);
    } else {
      score -= 10;
      reasons.push(`⚠️ Low volume: ${tradeStats.totalBuySol.toFixed(2)} SOL < ${sc.minVolume5mSol}`);
    }

    // Buy pressure (lebih banyak buy daripada sell = bagus)
    if (tradeStats.buyPressure > 0.7) {
      score += 10;
      reasons.push(`✅ Strong buy pressure: ${(tradeStats.buyPressure * 100).toFixed(0)}%`);
    } else if (tradeStats.buyPressure < 0.4) {
      score -= 15;
      reasons.push(`🚫 Sell pressure dominant: ${(tradeStats.buyPressure * 100).toFixed(0)}%`);
    }

    // Unique buyers (banyak wallet unik = organic)
    if (tradeStats.uniqueBuyers >= 10) {
      score += 10;
      reasons.push(`✅ Diverse buyers: ${tradeStats.uniqueBuyers} unique wallets`);
    } else if (tradeStats.uniqueBuyers < 5) {
      score -= 10;
      reasons.push(`⚠️ Few unique buyers: ${tradeStats.uniqueBuyers}`);
    }

    // Bundle detection (CRITICAL RED FLAG)
    if (tradeStats.isBundled && sc.blockBundledLaunch) {
      return makeDecision('SKIP', 0, [`🚫 BUNDLED LAUNCH detected (${tradeStats.bundleCount} wallets in <2s)`], tokenData);
    } else if (tradeStats.isBundled) {
      score -= 30;
      reasons.push(`🚫 Possible bundle: ${tradeStats.bundleCount} wallets bought in <2s`);
    }
  } else {
    // No WS trade data — merger score should be sufficient
    const mergerBonus = Math.max(0, ((tokenData._mergerScore || 0) - 50) * 0.5);
    score += mergerBonus;
    reasons.push(`📡 Merger score: ${tokenData._mergerScore || 'N/A'}/100 (+${mergerBonus.toFixed(0)} baseline)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: On-Chain Holder Analysis
  // ═══════════════════════════════════════════════════════════════════════════

  // Skip on-chain analysis untuk token fast-score rendah (RPC optimization)
  // atau token yang terlalu baru (< 3 detik) — belum ada holder data anyway
  const ageNow = Date.now() - (tokenData.timestamp || Date.now());
  const skipChain = shouldSkipOnChain(config, tokenData) || ageNow < 3000;
  if (skipChain) {
    reasons.push('⏭️ Skipped on-chain (low fast-score)');
  } else {
    const holderData = await analyzeHolders(tokenData.mint);

    if (holderData) {
      // Holder count
      if (holderData.holderCount >= sc.minHolders) {
        score += 10;
        reasons.push(`✅ Holders: ${holderData.holderCount}`);
      } else {
        score -= 10;
        reasons.push(`⚠️ Low holders: ${holderData.holderCount} < ${sc.minHolders}`);
      }

      // Top holder concentration
      if (holderData.topHolderPct > sc.maxTopHolderPct) {
        score -= 20;
        reasons.push(`🚫 Top holder owns ${holderData.topHolderPct.toFixed(1)}% (max: ${sc.maxTopHolderPct}%)`);
      }

      if (holderData.top10HolderPct > sc.maxTop10HolderPct) {
        score -= 15;
        reasons.push(`🚫 Top 10 hold ${holderData.top10HolderPct.toFixed(1)}% (max: ${sc.maxTop10HolderPct}%)`);
      } else {
        score += 5;
        reasons.push(`✅ Top 10 hold ${holderData.top10HolderPct.toFixed(1)}%`);
      }

      // Dev holding
      if (holderData.devHoldingPct > sc.maxDevHoldingPct) {
        score -= 25;
        reasons.push(`🚫 Dev holds ${holderData.devHoldingPct.toFixed(1)}% (max: ${sc.maxDevHoldingPct}%)`);
      } else {
        score += 10;
        reasons.push(`✅ Dev holding safe: ${holderData.devHoldingPct.toFixed(1)}%`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Bonding Curve Progress
  // ═══════════════════════════════════════════════════════════════════════════
  const bondingPct = await getBondingCurveProgress(tokenData.mint, tokenData.bondingCurve);

  if (bondingPct !== null) {
    if (bondingPct >= sc.minBondingCurvePct && bondingPct <= sc.maxBondingCurvePct) {
      score += 15;
      reasons.push(`✅ Bonding curve: ${bondingPct.toFixed(1)}% (sweet spot)`);
    } else if (bondingPct > sc.maxBondingCurvePct) {
      score -= 10;
      reasons.push(`⚠️ Bonding curve too advanced: ${bondingPct.toFixed(1)}% > ${sc.maxBondingCurvePct}%`);
    } else {
      reasons.push(`⏳ Bonding curve early: ${bondingPct.toFixed(1)}%`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Deployer History (repeat rugger detection)
  // ═══════════════════════════════════════════════════════════════════════════
  const deployerRisk = await checkDeployerHistory(tokenData.deployer);

  if (deployerRisk.isRisky) {
    score -= 30;
    reasons.push(`🚫 Deployer flagged: ${deployerRisk.reason}`);
    addDeployerToBlacklist(tokenData.deployer, deployerRisk.reason);
  } else if (deployerRisk.hasHistory) {
    score += 5;
    reasons.push(`✅ Deployer has clean history`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5b: Narrative Keywords — bonus untuk tren nama token
  // ═══════════════════════════════════════════════════════════════════════════
  if (sc.narrativeKeywords?.length) {
    const nameLower = (tokenData.symbol || tokenData.name || '').toLowerCase();
    const matchedKeyword = sc.narrativeKeywords.find(k => nameLower.includes(k));
    if (matchedKeyword) {
      const bonus = sc.narrativeBonusScore || 10;
      score += bonus;
      reasons.push(`🔥 Narrative match: "${matchedKeyword}" (+${bonus})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Social/Metadata Check (opsional)
  // ═══════════════════════════════════════════════════════════════════════════
  if (sc.requireSocial && tokenData.uri) {
    const hasSocial = await checkSocialPresence(tokenData.uri);
    if (hasSocial) {
      score += 5;
      reasons.push('✅ Has social links');
    } else {
      score -= 5;
      reasons.push('⚠️ No social presence');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL DECISION
  // ═══════════════════════════════════════════════════════════════════════════
  score = Math.max(0, Math.min(100, score));

  let decision;
  if (score >= sc.snipeThreshold) {
    decision = 'SNIPE';
  } else if (score >= sc.watchThreshold) {
    decision = 'WATCH';
  } else {
    decision = 'SKIP';
  }

  // ── Assign trade mode berdasarkan token age & bonding curve ──
  let assignedMode = null;

  if (decision === 'SNIPE' && sc.tradeModes) {
    for (const [modeName, modeCfg] of Object.entries(sc.tradeModes)) {
      if (!modeCfg.enabled) continue;
      const [curveMin, curveMax] = modeCfg.bondingCurveRange || [0, 100];
      if (ageSeconds <= modeCfg.tokenAgeMaxSec && bondingPct !== null) {
        const curvePct = typeof bondingPct === 'number' ? bondingPct : (bondingPct.progress ?? 0);
        if (curvePct >= curveMin && curvePct <= curveMax) {
          assignedMode = modeName;
          reasons.push(`${modeCfg.label} — ${modeCfg.description}`);
          break;
        }
      }
    }
  }

  // ── Auto mode switch — override with market conditions ──
  if (decision === 'SNIPE' && sc.autoModeSwitch?.enabled) {
    const marketCond = getMarketCondition();
    if (marketCond.recommendedMode && sc.tradeModes?.[marketCond.recommendedMode]?.enabled) {
      const oldMode = assignedMode;
      assignedMode = marketCond.recommendedMode;

      // Log the reasons from market conditions
      for (const r of marketCond.reasons) {
        console.log(chalk.cyan(`  └ [market] ${r}`));
      }

      if (oldMode && oldMode !== assignedMode) {
        const oldLabel = sc.tradeModes[oldMode]?.label || oldMode;
        const newLabel = sc.tradeModes[assignedMode]?.label || assignedMode;
        const msg = `🔄 Market override: ${oldLabel} → ${newLabel} (vel: ${marketCond.velocity}/min, vol: ${marketCond.volatility})`;
        reasons.push(msg);
        console.log(chalk.magenta(`  └ ${msg}`));
      } else {
        reasons.push(`📊 Market confirms: ${sc.tradeModes[assignedMode]?.label || assignedMode}`);
      }
    }
  }

  return makeDecision(decision, score, reasons, tokenData, assignedMode);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ON-CHAIN ANALYSIS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze token holders via Helius DAS API
 */
async function analyzeHolders(mint) {
  const config = getConfig();
  if (!config.heliusApiKey) return null;

  try {
    // Get token largest accounts
    const connection = getConnection();
    const mintPubkey = await import('@solana/web3.js').then(m => new m.PublicKey(mint));
    const accounts = await queuedRpc(() =>
      connection.getTokenLargestAccounts(mintPubkey),
      `holders(${mint.slice(0, 8)})`
    );

    if (!accounts?.value?.length) return null;

    const totalSupply = accounts.value.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    const sorted = accounts.value.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

    const topHolder = sorted[0] ? (parseFloat(sorted[0].amount) / totalSupply) * 100 : 0;
    const top10 = sorted.slice(0, 10).reduce((sum, a) => sum + parseFloat(a.amount), 0);
    const top10Pct = (top10 / totalSupply) * 100;

    // Dev holding = approximate as top holder yang bukan bonding curve
    const devHoldingPct = topHolder; // Simplified — in production, exclude bonding curve account

    return {
      holderCount: accounts.value.length,
      topHolderPct: topHolder,
      top10HolderPct: top10Pct,
      devHoldingPct,
      totalSupply,
    };
  } catch (e) {
    console.warn(`[screen] analyzeHolders error: ${e.message}`);
    // Auto-rotate RPC key
    try { rotateRpc(); } catch(_) {}
    return null;
  }
}

/**
 * Get bonding curve progress (% filled)
 * Pump.fun bonding curve = 85 SOL to graduate
 */
async function getBondingCurveProgress(mint, bondingCurveAddress) {
  // Cek mayhem cache dulu (lebih cepet & akurat)
  try {
    const { checkMayhemState } = await import('./mayhem-check.js');
    const mayhem = await checkMayhemState(mint);
    if (mayhem.bondingCurvePct !== null && mayhem.bondingCurvePct !== undefined) {
      return mayhem.bondingCurvePct;
    }
  } catch (_) {}

  // Fallback: on-chain
  try {
    if (bondingCurveAddress) {
      const { PublicKey } = await import('@solana/web3.js');
      const connection = getConnection();
      const curvePubkey = new PublicKey(bondingCurveAddress);
      const accountInfo = await queuedRpc(() =>
        connection.getAccountInfo(curvePubkey),
        `bonding(${mint.slice(0, 8)})`
      );

      if (accountInfo?.data) {
        const data = Buffer.from(accountInfo.data);
        if (data.length >= 40) {
          try {
            const totalRaised = Number(data.readBigUInt64LE(32));
            const pct = Math.min(100, (totalRaised / 85_000_000_000) * 100);
            return pct;
          } catch (_) {}
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Check deployer history — apakah deployer pernah melakukan rug sebelumnya
 */
// ─── Deployer History Cache — hindari RPC call berulang
const _deployerCache = new Map();
const DEPLOYER_CACHE_TTL = 10 * 60 * 1000; // 10 menit

async function checkDeployerHistory(deployer) {
  if (!deployer) return { isRisky: false, hasHistory: false };

  // Cek cache dulu
  const cached = _deployerCache.get(deployer);
  if (cached && (Date.now() - cached.ts) < DEPLOYER_CACHE_TTL) {
    return cached.result;
  }

  try {
    // Check blacklist first (quick in-memory check)
    if (isDeployerBlacklisted(deployer)) {
      const result = { isRisky: true, hasHistory: true, reason: 'In blacklist' };
      _deployerCache.set(deployer, { ts: Date.now(), result });
      return result;
    }

    // Simple heuristic: check deployer's recent transaction count
    const connection = getConnection();
    const { PublicKey } = await import('@solana/web3.js');
    const deployerPubkey = new PublicKey(deployer);

    const sigs = await queuedRpc(() =>
      connection.getSignaturesForAddress(deployerPubkey, { limit: 20 }),
      `deployer(${deployer.slice(0, 8)})`
    );

    const result = (sigs && sigs.length > 10)
      ? { isRisky: false, hasHistory: true }
      : { isRisky: false, hasHistory: false };

    _deployerCache.set(deployer, { ts: Date.now(), result });
    return result;
  } catch (e) {
    return { isRisky: false, hasHistory: false };
  }
}

/**
 * Periksa social presence dari metadata URI token
 */
async function checkSocialPresence(uri) {
  if (!uri) return false;
  try {
    const res = await axios.get(uri, { timeout: 5000, signal: AbortSignal.timeout(5000) });
    if (!res.data) return false;

    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const hasSocial = /twitter|x\.com|telegram|discord|website/i.test(body);
    return hasSocial;
  } catch (e) {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER — Decision Formatter
// ═══════════════════════════════════════════════════════════════════════════════

function makeDecision(decision, score, reasons, tokenData, assignedMode = null) {
  console.log(
    chalk[score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red'](
      `[screen] ${decision === 'SNIPE' ? '✅' : decision === 'WATCH' ? '👀' : '❌'} ${decision} | Score: ${score}/100 | ${tokenData.symbol}`
    )
  );

  // Log reasons in detail
  for (const r of reasons) {
    console.log(chalk.gray(`  └ ${r}`));
  }

  return {
    decision,
    score,
    reasons,
    data: tokenData,
    mode: assignedMode,
  };
}

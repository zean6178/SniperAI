/**
 * screening.js
 * Screening Pipeline — Evaluasi token baru apakah layak di-snipe
 * 
 * Pipeline:
 * 1. Pre-filter (age, blacklist) ← sudah di detector.js
 * 2. On-chain analysis (holders, dev wallet, bundling)
 * 3. Volume & momentum check
 * 4. Confidence scoring
 * 5. Decision: SNIPE | WATCH | SKIP
 */

import axios from 'axios';
import chalk from 'chalk';
import { getConfig } from './config.js';
import { getTradeStats } from './detector.js';
import { isDeployerBlacklisted, addDeployerToBlacklist } from './state.js';
import { getConnection } from './executor.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREENING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Evaluasi token baru → return decision + confidence score
 * @param {object} tokenData - dari detector.js
 * @returns {Promise<{decision: string, score: number, reasons: string[], data: object}>}
 */
export async function runScreening(tokenData) {
  const config = getConfig();
  const sc = config.screening;
  const reasons = [];
  let score = 50; // Base score

  console.log(chalk.blue(`[screen] 🔬 Screening: ${tokenData.symbol} (${tokenData.mint?.slice(0, 8)}…)`));

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
  // STEP 2: Trade Stats Analysis (dari WebSocket data)
  // ═══════════════════════════════════════════════════════════════════════════
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
    // No trade data yet — too early, put on watch
    reasons.push('⏳ No trade data yet — watching');
    score -= 5;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: On-Chain Holder Analysis
  // ═══════════════════════════════════════════════════════════════════════════
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
  // STEP 6: Social/Metadata Check (opsional)
  // ═══════════════════════════════════════════════════════════════════════════
  if (sc.requireSocial && tokenData.uri) {
    const hasSocial = await checkSocialPresence(tokenData.uri);
    if (hasSocial) {
      score += 5;
      reasons.push('✅ Has social links');
    } else {
      score -= 10;
      reasons.push('⚠️ No social presence');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL DECISION
  // ═══════════════════════════════════════════════════════════════════════════
  score = Math.max(0, Math.min(100, score));

  let decision;
  if (score >= 70) {
    decision = 'SNIPE';
  } else if (score >= 50) {
    decision = 'WATCH';
  } else {
    decision = 'SKIP';
  }

  return makeDecision(decision, score, reasons, tokenData);
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
    const accounts = await connection.getTokenLargestAccounts(mintPubkey);

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
    return null;
  }
}

/**
 * Get bonding curve progress (% filled)
 * Pump.fun bonding curve = 85 SOL to graduate
 */
async function getBondingCurveProgress(mint, bondingCurveAddress) {
  try {
    if (!bondingCurveAddress) return null;

    const connection = getConnection();
    const { PublicKey } = await import('@solana/web3.js');
    const accountInfo = await connection.getBalance(new PublicKey(bondingCurveAddress));
    const solInCurve = accountInfo / 1e9;

    // Pump.fun bonding curve graduates at ~85 SOL
    const GRADUATION_SOL = 85;
    const progress = (solInCurve / GRADUATION_SOL) * 100;

    return Math.min(progress, 100);
  } catch (e) {
    return null;
  }
}

/**
 * Check deployer's history (apakah pernah rug?)
 */
async function checkDeployerHistory(deployer) {
  if (!deployer) return { isRisky: false, hasHistory: false };

  const config = getConfig();
  if (!config.heliusApiKey) return { isRisky: false, hasHistory: false };

  try {
    // Check via Helius: get deployer's recent transactions
    const res = await axios.get(
      `https://api.helius.xyz/v0/addresses/${deployer}/transactions`,
      {
        params: { 'api-key': config.heliusApiKey, limit: 20, type: 'TOKEN_MINT' },
        timeout: 5000,
      }
    );

    const txns = res.data || [];

    // Jika deployer sudah launch >5 token dalam 24 jam = serial deployer (risky)
    const oneDayAgo = Date.now() / 1000 - 86400;
    const recentMints = txns.filter(tx => (tx.timestamp || 0) > oneDayAgo);

    if (recentMints.length > 5) {
      return {
        isRisky: true,
        hasHistory: true,
        reason: `Serial deployer: ${recentMints.length} tokens in 24h`,
      };
    }

    return { isRisky: false, hasHistory: txns.length > 0 };
  } catch (e) {
    return { isRisky: false, hasHistory: false };
  }
}

/**
 * Check apakah token punya social presence (dari metadata URI)
 */
async function checkSocialPresence(uri) {
  if (!uri) return false;
  try {
    const res = await axios.get(uri, { timeout: 3000 });
    const meta = res.data;
    const hasTwitter = !!(meta?.twitter || meta?.extensions?.twitter);
    const hasTelegram = !!(meta?.telegram || meta?.extensions?.telegram);
    const hasWebsite = !!(meta?.website || meta?.extensions?.website);
    return hasTwitter || hasTelegram || hasWebsite;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function makeDecision(decision, score, reasons, tokenData) {
  const emoji = decision === 'SNIPE' ? '🎯' : decision === 'WATCH' ? '👀' : '❌';
  console.log(chalk.yellow(
    `[screen] ${emoji} ${decision} | Score: ${score}/100 | ${tokenData.symbol} (${tokenData.mint?.slice(0, 8)}…)`
  ));

  if (reasons.length > 0 && decision !== 'SKIP') {
    reasons.forEach(r => console.log(chalk.gray(`         ${r}`)));
  }

  return {
    decision,
    score,
    reasons,
    data: tokenData,
    timestamp: new Date().toISOString(),
  };
}

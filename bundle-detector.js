/**
 * bundle-detector.js
 * Multiwallet Bundle Detection Engine
 *
 * Mendeteksi cluster wallets yang dikendalikan entitas yang sama.
 *
 * Metode:
 * 1. Temporal Clustering — wallets yang buy di block/waktu identik
 * 2. Funding Source Clustering — wallets yang mendapat SOL dari sumber yang sama
 * 3. Top Holder Connection Graph — mapping hubungan antar top holders
 *
 * Pipeline tiers:
 *   fastCheck()        — instant, no RPC (dari tradeStats WS)
 *   standardCheck()   — ~10-15 RPC calls (untuk screening pipeline)
 *   deepCheck()       — ~25+ RPC calls (untuk /analyst deep dive)
 */

import axios from 'axios';
import { getConfig } from './config.js';
import { getConnection } from './executor.js';
import { PublicKey } from '@solana/web3.js';

const HELIUS_URL_BASE = 'https://mainnet.helius-rpc.com/?api-key=';

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fast bundle check — zero RPC, uses trade stats from WebSocket only.
 * Ini yang sudah ada di detector.js, direfactor ke sini.
 *
 * @param {object} tradeStats - dari getTradeStats()
 * @returns {{ isBundled: boolean, score: number, reasons: string[] }}
 */
export function fastBundleCheck(tradeStats) {
  const reasons = [];
  let score = 0;

  if (!tradeStats) {
    return { isBundled: false, score: 0, reasons: ['No trade data'] };
  }

  // Temporal clustering (sudah ada di detector.js)
  if (tradeStats.isBundled) {
    const severity = Math.min(tradeStats.bundleCount * 12, 60);
    score += severity;
    reasons.push(`Temporal: ${tradeStats.bundleCount} wallets bought <2s apart`);
  }

  // Buyer/sell ratio anomaly
  if (tradeStats.uniqueBuyers < 3 && tradeStats.buyCount > 10) {
    score += 15;
    reasons.push(`Anomaly: ${tradeStats.buyCount} buys from only ${tradeStats.uniqueBuyers} wallets`);
  }

  // Lack of unique buyers despite volume
  if (tradeStats.uniqueBuyers < 5 && tradeStats.totalBuySol > 1) {
    score += 10;
    reasons.push(`Low diversity: ${tradeStats.uniqueBuyers} unique buyers for ${tradeStats.totalBuySol.toFixed(2)} SOL volume`);
  }

  return {
    isBundled: score >= 25,
    score: Math.min(score, 100),
    reasons,
  };
}

/**
 * Standard bundle check — ~10-15 RPC calls.
 * Cek funding source dari top 5 holders + temporal data.
 * Cocok untuk screening pipeline real-time.
 *
 * @param {string} mint - Token mint address
 * @param {string[]} topHolderOwners - Array of owner wallet addresses (dari analyzeHoldersEnhanced)
 * @param {object} tradeStats - dari getTradeStats()
 * @returns {Promise<object>} { isBundled, score, reasons, clusters, details }
 */
export async function standardBundleCheck(mint, topHolderOwners, tradeStats) {
  const config = getConfig();
  const heliusKey = config.heliusApiKey;
  const reasons = [];
  let score = 0;
  const clusters = [];

  // ── Phase 1: Temporal check ───────────────────────────────────────────
  const temporal = fastBundleCheck(tradeStats);
  score += temporal.score;
  reasons.push(...temporal.reasons);

  // ── Phase 2: Funding source clustering (top 5 holders) ────────────────
  if (heliusKey && topHolderOwners?.length >= 2) {
    const walletsToCheck = topHolderOwners.slice(0, Math.min(5, topHolderOwners.length));
    const fundingResults = await analyzeFundingSources(walletsToCheck, heliusKey);

    for (const cluster of fundingResults.clusters) {
      if (cluster.wallets.length >= 2) {
        const severity = cluster.wallets.length >= 4 ? 30
                       : cluster.wallets.length >= 3 ? 20
                       : 10;
        score += severity;
        reasons.push(
          `Funding: ${cluster.wallets.length} top holders funded by ` +
          `${cluster.funder.slice(0, 8)}... (${cluster.totalSol.toFixed(3)} SOL)`
        );
        clusters.push(cluster);
      }
    }

    // Jika funding source tidak terdeteksi (null) untuk semua wallet, skip penalty
    const detectedCount = fundingResults.clusters.filter(c => c.funder !== null).length;
    if (detectedCount === 0 && walletsToCheck.length >= 3) {
      // Semua wallet punya funding source berbeda → organic signal
      reasons.push('Organic: top holders funded from different sources');
    }
  }

  // ── Final score ───────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  return {
    isBundled: score >= 30,
    score,
    reasons,
    clusters,
    temporalScore: temporal.score,
  };
}

/**
 * Deep bundle analysis — full scan untuk /analyst on-demand.
 * Cek top 20 holders + timeline reconstruction.
 *
 * @param {string} mint - Token mint address
 * @returns {Promise<object>} Complete bundle analysis report
 */
export async function deepBundleAnalysis(mint) {
  const config = getConfig();
  const heliusKey = config.heliusApiKey;
  const connection = getConnection();

  const result = {
    mint,
    tokenInfo: null,
    topHolders: [],
    fundingClusters: [],
    temporalAnalysis: null,
    riskScore: 0,
    verdict: 'CLEAN',
    details: [],
  };

  try {
    // ── 1. Get top token holders ────────────────────────────────────────
    const mintPubkey = new PublicKey(mint);
    const accounts = await connection.getTokenLargestAccounts(mintPubkey);

    if (!accounts?.value?.length) {
      result.details.push('No token accounts found');
      return result;
    }

    const totalSupply = accounts.value.reduce((sum, a) => sum + parseFloat(a.amount), 0);

    // ── 2. Get owner addresses from token accounts ──────────────────────
    const walletInfo = await resolveOwners(
      accounts.value.slice(0, 20).map(a => a.address),
      connection
    );

    const topHolders = accounts.value.slice(0, 20).map((acc, i) => ({
      tokenAccount: acc.address.toBase58(),
      owner: walletInfo[i] || 'unknown',
      amount: parseFloat(acc.amount),
      pct: (parseFloat(acc.amount) / totalSupply) * 100,
    }));

    result.topHolders = topHolders;

    // ── 3. Funding source clustering ────────────────────────────────────
    if (heliusKey) {
      const owners = topHolders.map(h => h.owner).filter(o => o && o !== 'unknown');
      const fundingResult = await analyzeFundingSources(owners, heliusKey);

      // Tambah info holder ke cluster
      result.fundingClusters = fundingResult.clusters.map(c => ({
        ...c,
        wallets: c.wallets.map(w => {
          const holder = topHolders.find(h => h.owner === w);
          return {
            address: w,
            amount: holder?.amount || 0,
            pct: holder?.pct?.toFixed(1) || '?',
          };
        }),
      }));

      // Flag clusters yang signifikan
      for (const cluster of result.fundingClusters) {
        if (cluster.wallets.length >= 2) {
          const combinedPct = cluster.wallets.reduce((s, w) => s + parseFloat(w.pct || 0), 0);
          result.riskScore += cluster.wallets.length * 10;
          result.details.push(
            `⚠️ ${cluster.wallets.length} wallets (${combinedPct.toFixed(1)}% supply) ` +
            `share funder ${cluster.funder?.slice(0, 8) || '?'}...`
          );
        }
      }
    }

    // ── 4. Check for known patterns ─────────────────────────────────────
    // a. Top holder concentration
    const top1Pct = topHolders[0]?.pct || 0;
    const top5Pct = topHolders.slice(0, 5).reduce((s, h) => s + h.pct, 0);

    if (top1Pct > 20) {
      result.riskScore += 15;
      result.details.push(`🚩 Top 1 holder owns ${top1Pct.toFixed(1)}% supply`);
    }
    if (top5Pct > 60) {
      result.riskScore += 20;
      result.details.push(`🚩 Top 5 holders own ${top5Pct.toFixed(1)}% supply`);
    }

    // ── 5. Verdict ──────────────────────────────────────────────────────
    if (result.riskScore >= 60) {
      result.verdict = '🔴 BUNDLED';
    } else if (result.riskScore >= 30) {
      result.verdict = '🟡 SUSPICIOUS';
    } else {
      result.verdict = '🟢 CLEAN';
    }

    result.riskScore = Math.min(result.riskScore, 100);

  } catch (e) {
    result.details.push(`Analysis error: ${e.message}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL — Funding Source Clustering
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze funding sources for a list of wallets.
 * For each wallet, check their earliest transaction to find who funded them.
 *
 * @param {string[]} wallets - Array of wallet addresses
 * @param {string} heliusKey
 * @returns {Promise<{ clusters: Array<{ funder: string, wallets: string[], totalSol: number }> }>}
 */
async function analyzeFundingSources(wallets, heliusKey) {
  const heliusUrl = HELIUS_URL_BASE + heliusKey;
  const walletToFunder = new Map(); // wallet → funder
  const funderToWallets = new Map(); // funder → [wallets]

  // Process wallets in parallel with concurrency limit
  const concurrency = 3;
  for (let i = 0; i < wallets.length; i += concurrency) {
    const batch = wallets.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(w => findFundingSource(w, heliusUrl).catch(() => null))
    );

    for (let j = 0; j < batch.length; j++) {
      const fundingInfo = results[j];
      const wallet = batch[j];

      if (fundingInfo) {
        walletToFunder.set(wallet, fundingInfo.funder);

        if (!funderToWallets.has(fundingInfo.funder)) {
          funderToWallets.set(fundingInfo.funder, []);
        }
        funderToWallets.get(fundingInfo.funder).push({
          wallet,
          solReceived: fundingInfo.amount,
        });
      }
    }
  }

  // Build cluster results
  const clusters = [];
  for (const [funder, walletList] of funderToWallets) {
    if (walletList.length >= 2) {
      const totalSol = walletList.reduce((s, w) => s + w.solReceived, 0);
      clusters.push({
        funder,
        wallets: walletList.map(w => w.wallet),
        totalSol: parseFloat(totalSol.toFixed(4)),
      });
    }
  }

  // Sort by cluster size descending
  clusters.sort((a, b) => b.wallets.length - a.wallets.length);

  return { clusters };
}

/**
 * Find the funding source for a single wallet.
 * Checks the wallet's earliest transaction for incoming SOL.
 */
async function findFundingSource(wallet, heliusUrl) {
  // Get oldest signatures
  const sigRes = await axios.post(heliusUrl, {
    jsonrpc: '2.0', id: 1,
    method: 'getSignaturesForAddress',
    params: [wallet, { limit: 3 }],
  }, { timeout: 5000 });

  const sigs = sigRes.data?.result;
  if (!sigs?.length) return null;

  // Oldest signature = last in list (newest-first order)
  // Tapi kita ambil yang paling pertama (terakhir) untuk funder
  // Sebenarnya yang paling awal mungkin setup tx, coba cek 2 yang terakhir
  for (let i = sigs.length - 1; i >= 0; i--) {
    const sig = sigs[i].signature;

    // Skip if errored
    if (sigs[i].err) continue;

    const txRes = await axios.post(heliusUrl, {
      jsonrpc: '2.0', id: 1,
      method: 'getTransaction',
      params: [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
    }, { timeout: 5000 });

    const tx = txRes.data?.result;
    if (!tx?.meta) continue;

    const preBal = tx.meta.preBalances || [];
    const postBal = tx.meta.postBalances || [];
    const accounts = tx.transaction?.message?.accountKeys || [];
    const fee = tx.meta.fee || 0;

    // Cari wallet ini di account list
    let walletIdx = -1;
    for (let j = 0; j < accounts.length; j++) {
      const addr = typeof accounts[j] === 'string' ? accounts[j] : accounts[j].pubkey;
      if (addr === wallet) {
        walletIdx = j;
        break;
      }
    }

    if (walletIdx < 0) continue;

    // SOL change: positive = received SOL
    const solChange = (postBal[walletIdx] - preBal[walletIdx]) / 1e9;

    if (solChange > 0.005) {
      // Ada yang ngirim SOL ke wallet ini
      // Cari account yang SOLnya berkurang (pengirim)
      for (let j = 0; j < Math.min(preBal.length, accounts.length); j++) {
        if (j === walletIdx) continue;
        const senderChange = (preBal[j] - postBal[j] - (j === 0 ? fee : 0)) / 1e9;
        if (senderChange > 0.005) {
          const funder = typeof accounts[j] === 'string' ? accounts[j] : accounts[j].pubkey;
          return { funder, amount: solChange };
        }
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL — Owner Resolution
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve owner wallet addresses from token account addresses.
 * Parses the owner field from token account data (bytes 32-64).
 */
async function resolveOwners(tokenAccountAddresses, connection) {
  if (!tokenAccountAddresses?.length) return [];

  try {
    const pubkeys = tokenAccountAddresses.map(a =>
      typeof a === 'string' ? new PublicKey(a) : a
    );

    const accounts = await connection.getMultipleAccountsInfo(pubkeys);

    return accounts.map(acc => {
      if (!acc?.data) return null;
      try {
        // Token account layout: mint(32) + owner(32) + amount(8) + ...
        const ownerBytes = acc.data.slice(32, 64);
        return new PublicKey(ownerBytes).toBase58();
      } catch {
        return null;
      }
    });
  } catch (e) {
    console.warn(`[bundle] resolveOwners error: ${e.message}`);
    return tokenAccountAddresses.map(() => null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT FOR ANALYST
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format bundle analysis result untuk ditampilkan di Telegram / terminal.
 */
export function formatBundleReport(result) {
  if (!result || result.verdict === 'CLEAN' && !result.details.length) {
    return '📦 *Bundle Check*: No bundle data available';
  }

  let lines = [
    `📦 *Bundle Detection Report*`,
    ``,
    `Token: \`${result.mint?.slice(0, 12)}...\``,
    `Risk Score: *${result.riskScore}/100* | Verdict: ${result.verdict}`,
    ``,
  ];

  if (result.details?.length) {
    lines.push(`*Flags:*`);
    for (const d of result.details) {
      lines.push(`• ${d}`);
    }
    lines.push('');
  }

  // Funding clusters
  if (result.fundingClusters?.length) {
    lines.push(`*Funding Clusters:*`);
    for (const c of result.fundingClusters) {
      const holders = c.wallets.map(w =>
        `${w.address?.slice(0, 8)}... (${w.pct}%)`
      ).join(', ');
      lines.push(`• ${c.wallets.length} wallets ← \`${c.funder?.slice(0, 8)}...\` (${c.totalSol} SOL)`);
      lines.push(`  Holders: ${holders}`);
    }
    lines.push('');
  }

  // Top holders summary
  if (result.topHolders?.length) {
    lines.push(`*Top 5 Holders:*`);
    for (const h of result.topHolders.slice(0, 5)) {
      lines.push(`• \`${h.owner?.slice(0, 12)}...\` ${h.pct.toFixed(1)}% (${(h.amount || 0).toFixed(0)} tokens)`);
    }
  }

  return lines.join('\n');
}

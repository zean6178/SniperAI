/**
 * Revenue Service — Collects and distributes platform fees
 * 
 * Revenue sources:
 * 1. Swap fee (0.5% on every trade)
 * 2. Subscription payments (SOL/USDC/SKR)
 * 
 * Distribution:
 * - 50% → Treasury wallet (profit + operating costs)
 * - 30% → Reward pool (SKR distribution to users)
 * - 20% → Development fund (growth, marketing)
 * 
 * All revenue is sent to TREASURY_WALLET defined in .env
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';

const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const TREASURY_WALLET = process.env.TREASURY_WALLET || '';

// Revenue tracking (in-memory, replace with DB in production)
const revenueLog = [];

// ─── Config ───────────────────────────────────────────────────────────────────
const FEE_CONFIG = {
  swapFeePct: 0.5,          // 0.5% on each trade
  distribution: {
    profit: 50,             // 50% → treasury (owner profit)
    rewardPool: 30,         // 30% → SKR reward pool for users
    development: 20,        // 20% → development/marketing fund
  },
};

// ─── Subscription Prices (SOL) ────────────────────────────────────────────────
const SUBSCRIPTION_PRICES = {
  pro_weekly:  0.05,        // ~$9.99 equivalent per week
  pro_monthly: 0.15,        // ~$9.99/mo at ~$150/SOL
  elite:       0.45,        // ~$29.99/mo at ~$150/SOL
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get treasury wallet address
 */
export function getTreasuryWallet() {
  if (!TREASURY_WALLET) {
    console.warn('[revenue] ⚠️ TREASURY_WALLET not set in .env — fees will NOT be collected!');
    return null;
  }
  return TREASURY_WALLET;
}

/**
 * Calculate swap fee for a trade amount
 * @param {number} amountSol - Trade amount in SOL
 * @returns {{ feeSOL: number, userReceives: number }}
 */
export function calculateSwapFee(amountSol) {
  const feeSol = amountSol * (FEE_CONFIG.swapFeePct / 100);
  return {
    feeSol: parseFloat(feeSol.toFixed(6)),
    userPays: amountSol,
    platformReceives: feeSol,
    userReceivesAfterFee: amountSol - feeSol,
  };
}

/**
 * Record a fee collection event
 */
export function recordFee({ type, amountSol, userWallet, mint, txHash }) {
  const entry = {
    id: `fee_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,              // 'swap_fee' | 'subscription' | 'copy_trading'
    amountSol,
    userWallet,
    mint: mint || null,
    txHash: txHash || null,
    treasuryWallet: TREASURY_WALLET,
    distribution: {
      profit: amountSol * (FEE_CONFIG.distribution.profit / 100),
      rewardPool: amountSol * (FEE_CONFIG.distribution.rewardPool / 100),
      development: amountSol * (FEE_CONFIG.distribution.development / 100),
    },
    timestamp: new Date().toISOString(),
  };

  revenueLog.push(entry);
  // Keep last 1000 entries
  if (revenueLog.length > 1000) revenueLog.shift();

  console.log(`[revenue] 💰 ${type}: +${amountSol.toFixed(6)} SOL from ${userWallet?.slice(0, 8)}…`);
  return entry;
}

/**
 * Get subscription price in SOL
 */
export function getSubscriptionPrice(tierId) {
  return SUBSCRIPTION_PRICES[tierId] || null;
}

/**
 * Build transfer instruction to treasury (for including in user's trade tx)
 * This is the fee extraction mechanism — added to every swap transaction
 */
export function buildFeeTransferInstruction(userPublicKey, feeLamports) {
  if (!TREASURY_WALLET) return null;

  try {
    return SystemProgram.transfer({
      fromPubkey: new PublicKey(userPublicKey),
      toPubkey: new PublicKey(TREASURY_WALLET),
      lamports: feeLamports,
    });
  } catch (e) {
    console.warn(`[revenue] Failed to build fee instruction: ${e.message}`);
    return null;
  }
}

/**
 * Verify a subscription payment was received
 * @returns {boolean}
 */
export async function verifySubscriptionPayment(txHash, expectedAmount) {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const tx = await connection.getTransaction(txHash, { maxSupportedTransactionVersion: 0 });

    if (!tx || !tx.meta) return false;

    // Check if treasury received the expected amount
    const treasuryPubkey = new PublicKey(TREASURY_WALLET);
    const treasuryIndex = tx.transaction.message.staticAccountKeys?.findIndex(
      key => key.equals(treasuryPubkey)
    );

    if (treasuryIndex === -1 || treasuryIndex === undefined) return false;

    // Check balance change
    const preBalance = tx.meta.preBalances[treasuryIndex] || 0;
    const postBalance = tx.meta.postBalances[treasuryIndex] || 0;
    const received = (postBalance - preBalance) / LAMPORTS_PER_SOL;

    // Allow 1% tolerance
    return received >= expectedAmount * 0.99;
  } catch (e) {
    console.warn(`[revenue] Verify payment failed: ${e.message}`);
    return false;
  }
}

// ─── Revenue Stats ────────────────────────────────────────────────────────────

/**
 * Get revenue summary
 */
export function getRevenueStats(period = 'today') {
  const now = new Date();
  let filtered = revenueLog;

  if (period === 'today') {
    const todayStr = now.toISOString().split('T')[0];
    filtered = revenueLog.filter(e => e.timestamp.startsWith(todayStr));
  } else if (period === '7d') {
    const cutoff = new Date(now.getTime() - 7 * 86400000).toISOString();
    filtered = revenueLog.filter(e => e.timestamp > cutoff);
  }

  const totalSol = filtered.reduce((sum, e) => sum + e.amountSol, 0);
  const byType = {};
  filtered.forEach(e => {
    byType[e.type] = (byType[e.type] || 0) + e.amountSol;
  });

  return {
    period,
    totalRevenueSol: parseFloat(totalSol.toFixed(6)),
    transactions: filtered.length,
    byType,
    distribution: {
      profit: parseFloat((totalSol * FEE_CONFIG.distribution.profit / 100).toFixed(6)),
      rewardPool: parseFloat((totalSol * FEE_CONFIG.distribution.rewardPool / 100).toFixed(6)),
      development: parseFloat((totalSol * FEE_CONFIG.distribution.development / 100).toFixed(6)),
    },
    treasuryWallet: TREASURY_WALLET || 'NOT SET',
  };
}

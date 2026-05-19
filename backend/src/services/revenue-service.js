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

// ─── 3 Wallets for Auto-Split Revenue ─────────────────────────────────────────
const WALLETS = {
  treasury:    process.env.TREASURY_WALLET    || '4tifC6mukaYFh333k3pFn3U4wNkTCWUFEUSYkURMZJtZ',
  rewardPool:  process.env.REWARD_POOL_WALLET || 'BCH8jvDam9n6cTDjzbcjy3LWJPQUENnacskvPsz4MsUQ',
  development: process.env.DEV_FUND_WALLET    || 'En1foxxiV7d2siSDeX6s7gMCd1Gqc2UBLWPs4C9gWBkq',
};

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

// ─── Subscription Prices (Fixed USD, converted to SOL at runtime) ─────────────
// Harga tetap dalam USD — SOL amount dihitung dinamis berdasarkan harga SOL saat itu
const SUBSCRIPTION_PRICES_USD = {
  pro_weekly:  2.50,        // $2.50/week (~$9.99/month)
  pro_monthly: 9.99,        // $9.99/month
  elite:       29.99,       // $29.99/month
};

// Fallback SOL price jika API gagal (update manually jika perlu)
let cachedSolPriceUsd = 150;

/**
 * Get current SOL price in USD (from Jupiter/CoinGecko)
 */
async function fetchSolPrice() {
  try {
    const { default: axios } = await import('axios');
    const res = await axios.get('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112', { timeout: 5000 });
    const price = parseFloat(res.data?.data?.['So11111111111111111111111111111111111111112']?.price || 0);
    if (price > 0) cachedSolPriceUsd = price;
  } catch {}
  return cachedSolPriceUsd;
}

/**
 * Get subscription price in SOL (calculated from fixed USD price)
 */
async function getSubscriptionPriceSol(tierId) {
  const usdPrice = SUBSCRIPTION_PRICES_USD[tierId];
  if (!usdPrice) return null;
  const solPrice = await fetchSolPrice();
  return parseFloat((usdPrice / solPrice).toFixed(6));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get all revenue wallets
 */
export function getRevenueWallets() {
  return { ...WALLETS };
}

/**
 * Get treasury wallet address (primary/profit wallet)
 */
export function getTreasuryWallet() {
  if (!WALLETS.treasury) {
    console.warn('[revenue] ⚠️ TREASURY_WALLET not set — fees will NOT be collected!');
    return null;
  }
  return WALLETS.treasury;
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
  const profitSol     = amountSol * (FEE_CONFIG.distribution.profit / 100);
  const rewardSol     = amountSol * (FEE_CONFIG.distribution.rewardPool / 100);
  const devSol        = amountSol * (FEE_CONFIG.distribution.development / 100);

  const entry = {
    id: `fee_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,              // 'swap_fee' | 'subscription' | 'copy_trading'
    amountSol,
    userWallet,
    mint: mint || null,
    txHash: txHash || null,
    distribution: {
      profit:      { wallet: WALLETS.treasury,    amount: profitSol },
      rewardPool:  { wallet: WALLETS.rewardPool,  amount: rewardSol },
      development: { wallet: WALLETS.development, amount: devSol },
    },
    timestamp: new Date().toISOString(),
  };

  revenueLog.push(entry);
  if (revenueLog.length > 1000) revenueLog.shift();

  console.log(`[revenue] 💰 ${type}: +${amountSol.toFixed(6)} SOL from ${userWallet?.slice(0, 8)}…`);
  console.log(`[revenue]    → Treasury: ${profitSol.toFixed(6)} | Rewards: ${rewardSol.toFixed(6)} | Dev: ${devSol.toFixed(6)}`);
  return entry;
}

/**
 * Get subscription price in SOL (dynamic based on current SOL/USD rate)
 */
export { getSubscriptionPriceSol as getSubscriptionPrice };

/**
 * Get subscription price in USD (fixed)
 */
export function getSubscriptionPriceUsd(tierId) {
  return SUBSCRIPTION_PRICES_USD[tierId] || null;
}

/**
 * Build auto-split transfer instructions (3 wallets)
 * These instructions are added to the user's trade transaction
 * so fee is split atomically in a single tx.
 * 
 * @param {string} userPublicKey - User's wallet (payer)
 * @param {number} totalFeeLamports - Total fee in lamports
 * @returns {Array} - Array of SystemProgram.transfer instructions
 */
export function buildAutoSplitInstructions(userPublicKey, totalFeeLamports) {
  if (!WALLETS.treasury || !WALLETS.rewardPool || !WALLETS.development) {
    console.warn('[revenue] One or more wallets not configured — cannot split fees');
    return [];
  }

  try {
    const profitLamports = Math.floor(totalFeeLamports * FEE_CONFIG.distribution.profit / 100);
    const rewardLamports = Math.floor(totalFeeLamports * FEE_CONFIG.distribution.rewardPool / 100);
    const devLamports    = totalFeeLamports - profitLamports - rewardLamports; // Remainder to dev

    const fromPubkey = new PublicKey(userPublicKey);

    const instructions = [];

    // 50% → Treasury (profit)
    if (profitLamports > 0) {
      instructions.push(SystemProgram.transfer({
        fromPubkey,
        toPubkey: new PublicKey(WALLETS.treasury),
        lamports: profitLamports,
      }));
    }

    // 30% → Reward Pool
    if (rewardLamports > 0) {
      instructions.push(SystemProgram.transfer({
        fromPubkey,
        toPubkey: new PublicKey(WALLETS.rewardPool),
        lamports: rewardLamports,
      }));
    }

    // 20% → Development Fund
    if (devLamports > 0) {
      instructions.push(SystemProgram.transfer({
        fromPubkey,
        toPubkey: new PublicKey(WALLETS.development),
        lamports: devLamports,
      }));
    }

    return instructions;
  } catch (e) {
    console.warn(`[revenue] Failed to build split instructions: ${e.message}`);
    return [];
  }
}

/**
 * Legacy: single transfer to treasury only (fallback)
 */
export function buildFeeTransferInstruction(userPublicKey, feeLamports) {
  if (!WALLETS.treasury) return null;

  try {
    return SystemProgram.transfer({
      fromPubkey: new PublicKey(userPublicKey),
      toPubkey: new PublicKey(WALLETS.treasury),
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
    const treasuryPubkey = new PublicKey(WALLETS.treasury);
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
    treasuryWallet: WALLETS.treasury || 'NOT SET',
    rewardPoolWallet: WALLETS.rewardPool || 'NOT SET',
    developmentWallet: WALLETS.development || 'NOT SET',
  };
}

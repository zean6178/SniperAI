/**
 * SKR Token Service — Solana Mobile Ecosystem Rewards
 * 
 * SKR is the Seeker reward token. SniperAI integrates SKR for:
 * - Earning: daily usage rewards, successful trades, referrals
 * - Spending: premium features, fee discounts
 * - Governance: vote on screening parameters
 */

import { api } from './api';

// SKR Token Mint (Solana Mobile ecosystem token)
export const SKR_MINT = 'SKRTokenMintAddressPlaceholder1111111111111';
export const SKR_DECIMALS = 9;

// ─── Reward Rates ─────────────────────────────────────────────────────────────
export const REWARD_RATES = {
  dailyLogin: 1,
  tradeCompleted: 1,
  profitableTrade: 5,
  referral: 10,
  streak3Day: 7.5,
  streak7Day: 25,
  streak30Day: 100,
};

// ─── Premium Tiers ────────────────────────────────────────────────────────────

// Genesis Token holders get 50% discount on all subscription tiers
export const GENESIS_DISCOUNT_PCT = 50;

export const PREMIUM_TIERS = [
  {
    id: 'pro_weekly',
    name: 'Pro (Weekly)',
    priceUsd: 2.50,
    genesisPriceUsd: 1.25,   // 50% off for Genesis Token holders
    skrCost: 100,
    genesisSkrCost: 50,      // 50% off SKR cost too
    features: ['AI Chat unlimited', 'Score >60 alerts', '5 max positions'],
    duration: '7d',
  },
  {
    id: 'pro_monthly',
    name: 'Pro (Monthly)',
    priceUsd: 9.99,
    genesisPriceUsd: 4.99,   // 50% off
    skrCost: 350,
    genesisSkrCost: 175,
    features: ['AI Chat unlimited', 'Score >50 alerts', '10 max positions', 'Copy trading'],
    duration: '30d',
  },
  {
    id: 'elite',
    name: 'Elite (Monthly)',
    priceUsd: 29.99,
    genesisPriceUsd: 14.99,  // 50% off
    skrCost: 1000,
    genesisSkrCost: 500,
    features: ['Everything in Pro', 'Priority alerts (<1s)', 'Custom screening', 'API access'],
    duration: '30d',
  },
];

/**
 * Get price for a tier based on Genesis Token ownership
 */
export function getTierPrice(tierId: string, hasGenesisToken: boolean) {
  const tier = PREMIUM_TIERS.find(t => t.id === tierId);
  if (!tier) return null;
  return {
    priceUsd: hasGenesisToken ? tier.genesisPriceUsd : tier.priceUsd,
    skrCost: hasGenesisToken ? tier.genesisSkrCost : tier.skrCost,
    isDiscounted: hasGenesisToken,
    discountPct: hasGenesisToken ? GENESIS_DISCOUNT_PCT : 0,
    tier,
  };
}

/**
 * Check if wallet holds Seeker Genesis Token (on-chain verification)
 * Genesis Token is a non-transferable NFT minted to each Seeker device.
 * Re-verified every billing cycle — if NFT sold/transferred, discount lost.
 */
export async function checkGenesisToken(wallet: string): Promise<boolean> {
  try {
    const res = await api.get(`/skr/check-genesis?wallet=${wallet}`);
    return res.hasGenesisToken === true;
  } catch {
    return false;
  }
}

// ─── Balance ──────────────────────────────────────────────────────────────────
export async function getSKRBalance(wallet: string) {
  try {
    return await api.get(`/skr/balance?wallet=${wallet}`);
  } catch {
    return { balance: 0, formatted: '0 SKR', stakedAmount: 0, pendingRewards: 0 };
  }
}

// ─── Earning ──────────────────────────────────────────────────────────────────
export async function claimDailyReward() {
  try { return await api.post('/skr/claim-daily', {}); }
  catch { return { success: false, amount: 0, streak: 0 }; }
}

export async function getEarningHistory(limit = 20) {
  try { return (await api.get(`/skr/earnings?limit=${limit}`)).events || []; }
  catch { return []; }
}

// ─── Spending ─────────────────────────────────────────────────────────────────
export async function unlockPremium(tierId: string) {
  try { return await api.post('/skr/unlock-premium', { tierId }); }
  catch { return { success: false }; }
}

export async function payFeeWithSKR(mint: string, feeAmount: number) {
  try { return await api.post('/skr/pay-fee', { mint, feeAmount }); }
  catch { return { success: false, skrSpent: 0 }; }
}

// ─── Staking ──────────────────────────────────────────────────────────────────
export async function getStakeInfo(wallet: string) {
  try { return await api.get(`/skr/stake-info?wallet=${wallet}`); }
  catch { return { stakedAmount: 0, apy: 0, pendingRewards: 0, lockEndDate: null }; }
}

export async function stakeSKR(amount: number) {
  try { return await api.post('/skr/stake', { amount }); }
  catch { return { success: false }; }
}

export async function unstakeSKR(amount: number) {
  try { return await api.post('/skr/unstake', { amount }); }
  catch { return { success: false }; }
}

// ─── Referral ─────────────────────────────────────────────────────────────────

/**
 * Referral Requirements:
 * Reward (10 SKR) hanya diberikan jika teman yang di-refer sudah memenuhi SEMUA syarat:
 * 1. Execute trade (minimal 1 trade)
 * 2. Profitable trade (minimal 1 trade profit)
 * 3. 7-day streak (login 7 hari berturut-turut)
 * 
 * Jika belum memenuhi semua syarat → status "pending"
 * Setelah semua terpenuhi → auto-credit 10 SKR ke referrer
 */
export const REFERRAL_REQUIREMENTS = {
  minTrades: 1,
  minProfitableTrades: 1,
  minStreakDays: 7,
};

export async function getReferralInfo() {
  try { return await api.get('/skr/referral'); }
  catch { return { referralCode: '', totalReferred: 0, totalEarned: 0, pending: [] }; }
}

export async function getReferralStatus(referredWallet: string) {
  try { return await api.get(`/skr/referral/status?wallet=${referredWallet}`); }
  catch {
    return {
      wallet: referredWallet,
      hasTraded: false,
      hasProfitableTrade: false,
      has7DayStreak: false,
      isComplete: false,
      rewardClaimed: false,
    };
  }
}

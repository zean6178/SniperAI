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
  referral: 25,
  streak3Day: 7.5,
  streak7Day: 25,
  streak30Day: 100,
};

// ─── Premium Tiers ────────────────────────────────────────────────────────────
export const PREMIUM_TIERS = [
  {
    id: 'pro_weekly',
    name: 'Pro (Weekly)',
    skrCost: 100,
    features: ['AI Chat unlimited', 'Score >60 alerts', '5 max positions'],
    duration: '7d',
  },
  {
    id: 'pro_monthly',
    name: 'Pro (Monthly)',
    skrCost: 350,
    features: ['AI Chat unlimited', 'Score >50 alerts', '10 max positions', 'Copy trading'],
    duration: '30d',
  },
  {
    id: 'elite',
    name: 'Elite (Monthly)',
    skrCost: 1000,
    features: ['Everything in Pro', 'Priority alerts (<1s)', 'Custom screening', 'API access'],
    duration: '30d',
  },
];

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
export async function getReferralInfo() {
  try { return await api.get('/skr/referral'); }
  catch { return { referralCode: '', totalReferred: 0, totalEarned: 0 }; }
}

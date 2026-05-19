/**
 * config.js — Bot Configuration
 * 
 * Extended dengan hybrid merger config untuk multiple source.
 */

const config = {
  // ─── Wallet & RPC ─────────────────────────────────────────────────────────
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  rpcUrl:           process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  heliusApiKey:     process.env.HELIUS_API_KEY || '',

  // ─── Treasury / Revenue Wallet ──────────────────────────────────────────────
  treasury: {
    walletAddress:  process.env.TREASURY_WALLET || '4tifC6mukaYFh333k3pFn3U4wNkTCWUFEUSYkURMZJtZ',
    swapFeePct:     0.5,
    feeDistribution: {
      profit:       50,
      rewardPool:   30,
      development:  20,
    },
  },

  // ─── Mode ─────────────────────────────────────────────────────────────────
  isDryRun:  process.env.DRY_RUN === 'true',
  botMode:   process.env.BOT_MODE || 'semi-auto',

  // ─── Telegram ─────────────────────────────────────────────────────────────
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId:   process.env.TELEGRAM_CHAT_ID || '',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREENING FILTERS
  // ═══════════════════════════════════════════════════════════════════════════
  screening: {
    minBondingCurvePct:  1,
    maxBondingCurvePct:  25,
    minHolders:          5,
    maxTopHolderPct:     25,
    maxTop10HolderPct:   60,
    maxDevHoldingPct:    10,
    blockBundledLaunch:  true,
    maxBundleWallets:    5,
    minLiquiditySol:     0.5,
    minBuyCount5m:       3,
    minVolume5mSol:      0.2,
    requireSocial:       false,
    maxTokenAgeMinutes:  15,
    minTokenAgeSeconds:  0,
    snipeThreshold:      60,
    watchThreshold:      40,
    bundleDetection: {
      enabled:                  true,
      fundingClusterThreshold:  3,
      scorePenaltyPerCluster:   20,
      skipOnConfirmedBundle:    true,
      maxFundingClusters:       2,
    },
    useDeployerBlacklist: true,
    useTokenBlacklist:    true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTRY STRATEGY
  // ═══════════════════════════════════════════════════════════════════════════
  entry: {
    buyAmountSol:        0.05,
    maxBuyAmountSol:     0.10,
    slippageBps:         2000,
    priorityFeeLamports: 50000,
    enableScaling:       true,
    scalingTiers: [
      { minScore: 90, multiplier: 1.5 },
      { minScore: 75, multiplier: 1.0 },
      { minScore: 60, multiplier: 0.5 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXIT STRATEGY
  // ═══════════════════════════════════════════════════════════════════════════
  exit: {
    takeProfitLevels: [
      { triggerMultiple: 2.0, sellPct: 60 },
      { triggerMultiple: 4.0, sellPct: 30 },
      { triggerMultiple: 8.0, sellPct: 10 },
    ],
    stopLossPct:          -30,
    trailingStopPct:      25,
    maxHoldTimeMinutes:   60,
    stalePriceMinutes:    10,
    autoExitOnRug:        true,
    rugDetection: {
      devSellThreshold:     50,
      liquidityDropPct:     60,
      priceDropPct:         70,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RISK MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  risk: {
    maxOpenPositions:     2,
    maxDailyLossSol:      0.1,
    maxDailyTrades:       8,
    gasReserveSol:        0.02,
    cooldownAfterLossSec: 180,
    zeroBalanceCooldownSec: 715300,
    maxPortfolioExposure: 0.3,
    maxSingleExposure:    0.1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HYBRID MODE — Multi-source signal merger
  // ═══════════════════════════════════════════════════════════════════════════
  hybrid: {
    enabled: true,             // Enable hybrid merger (3 source)

    // ── Source Weights ────────────────────────────────────────────────────
    wsWeight:       0.30,      // PumpPortal WS (30%)
    serverWeight:   0.50,      // Signal Server api.thecharon.xyz (50%)
    trendingWeight: 0.20,      // Jupiter Trending (20%)

    // ── Signal Server (api.thecharon.xyz) ─────────────────────────────────
    signalServerUrl:  process.env.SIGNAL_SERVER_URL || '',
    signalServerKey:  process.env.SIGNAL_SERVER_KEY || '',
    signalPollMs:     Number(process.env.SIGNAL_POLL_MS || 30_000),

    // ── Jupiter Trending ──────────────────────────────────────────────────
    trendingEnabled:   true,
    trendingSource:    'jupiter',
    trendingInterval:  '5m',
    trendingLimit:     100,
    trendingPollMs:    Number(process.env.TRENDING_POLL_MS || 60_000),

    // ── Strategy Multipliers ──────────────────────────────────────────────
    strategyAmounts: {
      fast_snipe:       0.6,   // 60% dari buyAmountSol
      swing:            1.2,   // 120%
      high_confidence:  2.0,   // 200%
      low_confidence:   0.0,   // Skip
    },
    strategySlippage: {
      fast_snipe:       1.2,   // Lebih longgar
      swing:            1.0,   // Default
      high_confidence:  0.8,   // Lebih ketat
    },

    dedupWindowMs:    60_000,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MONITORING — Price tracking intervals
  // ═══════════════════════════════════════════════════════════════════════════
  monitoring: {
    priceCheckIntervalMs: Number(process.env.PRICE_CHECK_INTERVAL_MS || 15_000),
    holderCheckIntervalMs: 30000,
    cleanupIntervalMs:    60000,
  },
};

export default config;
export function getConfig() { return config; }

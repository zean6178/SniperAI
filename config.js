/**
 * config.js
 * Konfigurasi utama bot sniper pump.fun
 * Semua parameter tuning ada di sini.
 */

import dotenv from 'dotenv';
dotenv.config();

// ─── Validate critical env vars ─────────────────────────────────────────────
if (!process.env.WALLET_PRIVATE_KEY) {
  console.error('❌ WALLET_PRIVATE_KEY is not set in .env — bot cannot start.');
  console.error('   Copy .env.example → .env and fill in your wallet key.');
  process.exit(1);
}

if (!process.env.RPC_URL) {
  console.warn('⚠️  RPC_URL not set — using default public Solana RPC (slow, rate-limited).');
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const config = {

  // ─── Wallet & RPC ─────────────────────────────────────────────────────────
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  rpcUrl:           process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  rpcWssUrl:        process.env.RPC_WSS_URL || 'wss://api.mainnet-beta.solana.com',
  heliusApiKey:     process.env.HELIUS_API_KEY || '',

  // ─── Mode ─────────────────────────────────────────────────────────────────
  isDryRun:  process.env.DRY_RUN === 'true',
  botMode:   process.env.BOT_MODE || 'semi-auto', // 'full-auto' | 'semi-auto'

  // ─── Telegram ─────────────────────────────────────────────────────────────
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId:   process.env.TELEGRAM_CHAT_ID || '',
  },

  // ─── Jito MEV Protection ──────────────────────────────────────────────────
  jito: {
    enabled:     process.env.USE_JITO === 'true',
    tipLamports: parseInt(process.env.JITO_TIP_LAMPORTS || '10000'),
    endpoint:    'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREENING FILTERS — Token harus pass SEMUA filter ini untuk di-snipe
  // ═══════════════════════════════════════════════════════════════════════════
  screening: {

    // ── Bonding Curve ──────────────────────────────────────────────────────
    minBondingCurvePct:  5,     // Minimum progress bonding curve (%)
    maxBondingCurvePct:  40,    // Maximum (jangan masuk terlalu late)

    // ── Holder Analysis ────────────────────────────────────────────────────
    minHolders:          15,    // Minimum unique holders
    maxTopHolderPct:     15,    // Max % supply oleh 1 wallet (exclude dev)
    maxTop10HolderPct:   40,    // Max % supply oleh top 10 holders

    // ── Dev Wallet ─────────────────────────────────────────────────────────
    maxDevHoldingPct:    5,     // Max % dev masih pegang
    blockBundledLaunch:  true,  // Skip jika terdeteksi bundled launch
    maxBundleWallets:    3,     // Jika >3 wallet beli di block yang sama = bundled

    // ── Volume & Liquidity ─────────────────────────────────────────────────
    minLiquiditySol:     5,     // Minimum SOL in bonding curve
    minBuyCount5m:       10,    // Minimum jumlah buy dalam 5 menit terakhir
    minVolume5mSol:      3,     // Minimum volume 5 menit (SOL)

    // ── Social / Meta ──────────────────────────────────────────────────────
    requireSocial:       false, // Wajib punya Twitter/Telegram?
    trendingNarratives:  [],    // Filter by narrative (kosong = semua)

    // ── Age & Timing ───────────────────────────────────────────────────────
    maxTokenAgeMinutes:  30,    // Skip token yang terlalu lama (>30 min)
    minTokenAgeSeconds:  10,    // Skip token yang terlalu baru (<10 detik, biasanya bot)

    // ── Blacklist ──────────────────────────────────────────────────────────
    useDeployerBlacklist: true,
    useTokenBlacklist:    true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTRY STRATEGY — Kapan dan berapa beli
  // ═══════════════════════════════════════════════════════════════════════════
  entry: {
    buyAmountSol:        0.5,   // Jumlah SOL per snipe
    maxBuyAmountSol:     2.0,   // Maximum SOL per snipe (untuk scaling)
    slippageBps:         1500,  // Slippage tolerance (15%)
    priorityFeeLamports: 50000, // Priority fee untuk speed

    // ── Scaling (opsional) ─────────────────────────────────────────────────
    enableScaling:       false, // Scale buy amount berdasarkan confidence
    scalingTiers: [
      { minScore: 90, multiplier: 2.0 },  // Confidence 90+ → 2x buy
      { minScore: 75, multiplier: 1.5 },  // Confidence 75+ → 1.5x buy
      { minScore: 60, multiplier: 1.0 },  // Confidence 60+ → 1x buy (default)
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXIT STRATEGY — Kapan dan bagaimana jual
  // ═══════════════════════════════════════════════════════════════════════════
  exit: {
    // ── Take Profit (bertahap) ─────────────────────────────────────────────
    takeProfitLevels: [
      { triggerMultiple: 2.0, sellPct: 50 },   // Jual 50% di 2x
      { triggerMultiple: 3.0, sellPct: 30 },   // Jual 30% di 3x
      { triggerMultiple: 5.0, sellPct: 15 },   // Jual 15% di 5x
      // Sisa 5% = moonbag (hold forever)
    ],

    // ── Stop Loss ──────────────────────────────────────────────────────────
    stopLossPct:          -40,   // Cut loss di -40%
    trailingStopPct:      25,    // Trailing stop: jual jika turun 25% dari peak

    // ── Time-based Exit ────────────────────────────────────────────────────
    maxHoldTimeMinutes:   60,    // Auto-sell setelah 60 menit (jika belum TP/SL)
    stalePriceMinutes:    10,    // Jika harga tidak bergerak 10 menit → exit

    // ── Rug Detection ──────────────────────────────────────────────────────
    autoExitOnRug:        true,  // Auto-sell jika detect rug indicators
    rugDetection: {
      devSellThreshold:     50,  // Dev jual >50% holdings → rug
      liquidityDropPct:     60,  // Liquidity turun >60% dalam 1 menit → rug
      priceDropPct:         70,  // Harga drop >70% dalam 30 detik → rug
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RISK MANAGEMENT — Portfolio-level protection
  // ═══════════════════════════════════════════════════════════════════════════
  risk: {
    maxOpenPositions:     3,     // Maksimal 3 posisi terbuka bersamaan
    maxDailyLossSol:      5,     // Stop trading jika rugi >5 SOL hari ini
    maxDailyTrades:       15,    // Maks 15 trade per hari (avoid overtrade)
    gasReserveSol:        0.1,   // Selalu sisakan 0.1 SOL untuk gas
    cooldownAfterLossSec: 120,   // Cooldown 2 menit setelah loss

    // ── Portfolio Sizing ───────────────────────────────────────────────────
    maxPortfolioExposure: 0.3,   // Max 30% portfolio di memecoins
    maxSingleExposure:    0.1,   // Max 10% portfolio per trade
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MONITORING — Price tracking intervals
  // ═══════════════════════════════════════════════════════════════════════════
  monitoring: {
    priceCheckIntervalMs: 3000,  // Check harga setiap 3 detik
    holderCheckIntervalMs: 30000, // Check holder setiap 30 detik
    cleanupIntervalMs:    60000, // Cleanup expired positions setiap 1 menit
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COPY TRADING — Follow smart wallets (opsional)
  // ═══════════════════════════════════════════════════════════════════════════
  copyTrading: {
    enabled:        false,
    wallets:        [],           // Array of wallet addresses to copy
    minWalletWinRate: 60,        // Only copy wallets with >60% win rate
    maxCopyDelaySec:  10,        // Max delay sebelum copy (jika >10s, skip)
    copyAmountPct:    50,        // Copy 50% dari buy amount mereka
  },
};

export default config;
export function getConfig() { return config; }

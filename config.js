/**
 * config.js — Bot Configuration
 * 
 * Extended dengan hybrid merger config untuk multiple source.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Lazily-built config — reads process.env on every access so ESM import
// hoisting doesn't swallow dotenv-loaded vars.  Fixes the "Expected String"
// crash when getWallet() calls bs58.decode(undefined).
// ═══════════════════════════════════════════════════════════════════════════════

let _config = null;

function buildConfig() {
  return {
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
      // ── Hard filters (instant SKIP jika tidak lolos) ──
      maxDevHoldingPct:    20,
      maxTopHolderPct:     30,
      maxTop10HolderPct:   60,
      minHolders:          5,
      blockBundledLaunch:  true,
      maxBundleWallets:    5,
      minLiquiditySol:     0.5,

      // ── Range-based filters ──
      minBondingCurvePct:  1,
      maxBondingCurvePct:  75,     // Ditingkatin dari 25 jadi 75 biar curve play bisa masuk
      minBuyCount5m:       3,
      minVolume5mSol:      0.2,
      requireSocial:       true,
      maxTokenAgeMinutes:  3,       // Turun drastis: 15m → 2 menit
      minTokenAgeSeconds:  5,       // 5 detik — delay 8-12s jadi natural buffer
      snipeThreshold:      70,
      watchThreshold:      50,

      // ── 3 Trade Modes ──
      tradeModes: {
        early_snipe: {
          enabled:          true,
          label:            '⚡ Early Snipe',
          description:      '0-2 menit setelah launch',
          entryDelayMs:     [10_000, 30_000],  // Detik 10-30
          tokenAgeMaxSec:   120,
          sizeSol:          0.05,
          targetMultiple:   3.0,   // 3x
          stopLossPct:      -30,
          maxHoldSeconds:   90,    // 90 detik force exit kalo flat
          bondingCurveRange: [1, 25],  // curve 1-25%
          requiresVolume:   false,
        },
        momentum_ride: {
          enabled:          true,
          label:            '🎯 Momentum Ride',
          description:      '2-10 menit setelah launch',
          entryDelayMs:     [120_000, 600_000],
          tokenAgeMaxSec:   600,
          sizeSol:          0.10,
          targetMultiple:   2.0,   // 2x
          stopLossPct:      -20,
          maxHoldSeconds:   180,   // 3 menit
          bondingCurveRange: [10, 60],
          requiresVolume:   true,  // Butuh konfirmasi volume
          minCandleSequence: 3,    // Min 3 green candle
        },
        curve_play: {
          enabled:          true,
          label:            '🏃 Curve Play',
          description:      'Bonding curve 60-85% — dekat listing',
          entryDelayMs:     [30_000, 120_000],
          tokenAgeMaxSec:   600,
          sizeSol:          0.20,
          targetMultiple:   1.5,   // 1.5x (pump listing)
          stopLossPct:      -15,
          maxHoldSeconds:   120,   // 2 menit — kalo curve stuck, exit
          bondingCurveRange: [55, 85],
          requiresVolume:   true,
        },
      },
      // ── Auto Mode Switch — dynamic mode selection based on market conditions ──
      autoModeSwitch: {
        enabled:              true,
        adaptOnLoss:          true,
        lossStreakThreshold:  3,
      },
      bundleDetection: {
        enabled:                  true,
        fundingClusterThreshold:  3,
        scorePenaltyPerCluster:   20,
        skipOnConfirmedBundle:    true,
        maxFundingClusters:       2,
      },
      narrativeKeywords: ['ai', 'agent', 'gpt', 'trump', 'pepe', 'doge', 'sol', 'pump', 'maga', 'cat'],
      narrativeBonusScore: 10,
      useDeployerBlacklist: true,
      useTokenBlacklist:    true,

      // ── RugCheck.xyz — token safety verification ──
      rugcheck: {
        enabled:              true,
        minScore:             300,        // Skip if score < this
        scoreWeight:          0.3,        // Kontribusi ke total score
        skipOnCriticalRisk:   true,       // Skip on mint/freeze authority
        cacheTtlMs:           300_000,    // 5 menit cache
        skipOnApiError:       false,      // Jangan skip kalo API down
      },

      // RPC optimization — skip on-chain RPC calls untuk token fastScore rendah
      skipOnChainIfLowScore: true,
      onChainMinScore:       50,
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ENTRY STRATEGY
    // ═══════════════════════════════════════════════════════════════════════════
    entry: {
      buyAmountSol:        1.0,      // Base size — terendah (early snipe)
      maxBuyAmountSol:     1.0,      // Max size — curve play
      slippageBps:         1200,      // 15% — ikut dokumen
      priorityFeeLamports: 500000,
      enableScaling:       true,      // Aktifin scaling per mode
      scalingTiers: [
        { minScore: 85, multiplier: 1.5 },  // High confidence
        { minScore: 70, multiplier: 1.0 },  // Normal
        { minScore: 50, multiplier: 0.5 },  // Low confidence
      ],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // EXIT STRATEGY
    // ═══════════════════════════════════════════════════════════════════════════
    exit: {
      takeProfitLevels: [
        { triggerMultiple: 3.0, sellPct: 50 },   // 3x → jual 50%
        { triggerMultiple: 5.0, sellPct: 75 },   // 5x → jual 75% dari sisa
        { triggerMultiple: 10.0, sellPct: 100 },  // 10x → full exit
      ],
      stopLossPct:          -25,
      trailingStopPct:      20,
      maxHoldTimeMinutes:   10,      // Naikin: 5m → 10m biar token lebih waktu migrasi
      stalePriceMinutes:    2,       // Turun: 10m → 2 menit — force exit kalo no movement
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
      maxOpenPositions:     100,      // 100 — dry run mode
      maxDailyLossSol:      0.6,      // -30% dari 2 SOL modal
      dailyLossHardStopPct: 30,       // -30% modal hari ini → stop all
      maxDailyTrades:       500,      // Ample untuk dry run
      gasReserveSol:        0.05,
      cooldownAfterLossSec: 180,
      zeroBalanceCooldownSec: 715300,
      maxPortfolioExposure: 0.3,
      maxSingleExposure:    0.1,

      // Mayhem mode — kurangi size + target
      mayhemSizeMultiplier: 0.5,      // 50% dari normal size
      mayhemTargetMultiple: 1.5,      // TP cari 1.5x doang pas mayhem
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // HYBRID MODE — Multi-source signal merger
    // ═══════════════════════════════════════════════════════════════════════════
    hybrid: {
      enabled: true,             // Enable hybrid merger (3 source)

      // ── Source Weights ────────────────────────────────────────────────────
      wsWeight:       0.40,      // PumpPortal WS (40%)
      serverWeight:   0.30,      // Signal Server (30%)
      trendingWeight: 0.30,      // Jupiter Trending (30%)

      // ── Signal Server (api.thecharon.xyz) ───────────────────────────────────
      signalServerUrl:  'https://api.thecharon.xyz',
      signalServerKey:  process.env.SIGNAL_SERVER_KEY || '',
      signalPollMs:     Number(process.env.SIGNAL_POLL_MS || 30000),

      // ── Jupiter Trending ──────────────────────────────────────────────────
      trendingEnabled:   true,
      trendingSource:    'jupiter',
      trendingInterval:  '5m',
      trendingLimit:     100,
      trendingPollMs:    Number(process.env.TRENDING_POLL_MS || 60_000),

      // ── RPC WebSocket logsSubscribe — 4th source, no API key needed ─────
      rpcWs: {
        enabled:          true,
        reconnectDelay:   3000,
        maxReconnect:     10,
      },

      // ── PumpPortal WebSocket — trade data (butuh funded API key) ──────────
      pumpPortalApiKey: process.env.PUMPPORTAL_API_KEY || '',

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

    // ═══════════════════════════════════════════════════════════════════════════════
    // REBALANCE ENGINE — Portfolio rebalancing
    // ═══════════════════════════════════════════════════════════════════════════
    rebalance: {
      enabled:              true,
      maxSingleExposure:    0.5,    // Max 50% portfolio in 1 posisi
      minProfitToTrim:      50,     // Trim winner kalo >50% gain
      trimPct:              30,     // Trim 30% dari posisi
      maxDrawdownToCut:     20,     // Cut kalo drawdown >20% dari entry
      cutPct:               50,     // Cut 50% posisi
      staleHoursToReview:   2,      // Di-review kalo >2 jam gak gerak
      rebalanceIntervalMs:  60_000,
      minPortfolioValueSol: 0.1,    // Minimal portfolio value untuk rebalance
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // IL PROTECTION — 3-tier downside protection
    // ═══════════════════════════════════════════════════════════════════════════
    ilProtection: {
      enabled:              true,
      alertThreshold:       10,     // alert @ drop 10% from entry
      hedgeThreshold:       20,     // partial sell @ drop 20%
      exitThreshold:        35,     // full exit @ drop 35%
      hedgeSellPct:         50,     // Sell 50% of position on hedge
      exitSellPct:          100,    // Sell 100% on exit
      volatilityWindow:     20,     // Last N price checks for volatility calc
      volatilityBump:       5,      // +5% threshold per 50% vol increase
      baseVolatility:       30,     // Baseline volatility (std dev %)
      cooldownMs:           60_000, // Min time between hedge/exit per position
    },

    monitoring: {
      priceCheckIntervalMs: Number(process.env.PRICE_CHECK_INTERVAL_MS || 15_000),
      holderCheckIntervalMs: 30000,
      cleanupIntervalMs:    60000,
    },
  };
}

export default function getFreshConfig() { return buildConfig(); }
export function getConfig() {
  if (!_config) _config = buildConfig();
  return _config;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRESET SYSTEM — Load profile overrides (Safe/Degen/Ape)
// ═══════════════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_PATH = resolve(__dirname, 'presets.json');

let _activePreset = null;

/**
 * Load a preset by name and apply it to the currently cached config.
 * @param {string} presetName - 'safe', 'degen', or 'ape'
 * @returns {object|null} The preset data, or null if not found
 */
export function loadPreset(presetName) {
  if (!existsSync(PRESETS_PATH)) return null;
  const presets = JSON.parse(readFileSync(PRESETS_PATH, 'utf-8'));
  if (!presets[presetName]) return null;
  const preset = presets[presetName];
  _activePreset = presetName;

  // Rebuild config from env
  _config = buildConfig();

  // Deep-merge the preset values into the running config
  if (preset.screening) {
    Object.assign(_config.screening, preset.screening);
  }
  if (preset.entry) {
    Object.assign(_config.entry, preset.entry);
  }
  if (preset.exit) {
    Object.assign(_config.exit, preset.exit);
  }
  if (preset.risk) {
    Object.assign(_config.risk, preset.risk);
  }

  console.log(`[config] ✅ Loaded preset "${presetName}" (${preset.label})`);
  console.log(`[config]    snipeThreshold → ${_config.screening.snipeThreshold}`);
  console.log(`[config]    buyAmountSol   → ${_config.entry.buyAmountSol} SOL`);
  console.log(`[config]    slippageBps    → ${_config.entry.slippageBps}`);
  console.log(`[config]    maxPositions   → ${_config.risk.maxOpenPositions}`);

  return preset;
}

/**
 * Get the name of the currently active preset
 * @returns {string|null}
 */
export function getActivePreset() { return _activePreset; }

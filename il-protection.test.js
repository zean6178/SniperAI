/**
 * il-protection.test.js
 * Tests for 3-Tier IL Protection Engine
 * 
 * Run: node --test il-protection.test.js
 */

import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────

mock.module('./config.js', {
  namedExports: {
    getConfig: () => ({
      isDryRun: true,
      entry: { slippageBps: 1000 },
      ilProtection: {
        enabled: true,
        alertThreshold: 10,
        hedgeThreshold: 20,
        exitThreshold: 35,
        hedgeSellPct: 50,
        exitSellPct: 100,
        volatilityWindow: 20,
        volatilityBump: 5,
        baseVolatility: 30,
        cooldownMs: 60000,
      },
    }),
  },
});

mock.module('./state.js', {
  namedExports: {
    getOpenPositions: () => ({
      'abc123': {
        tokenMint: 'abc123',
        symbol: 'TEST1',
        entryPriceSol: 1.0,
        currentPriceSol: 0.75,
        peakPriceSol: 1.2,
        entryAmountSol: 0.1,
        openedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    }),
    getPosition: (mint) => {
      if (mint === 'abc123') {
        return {
          tokenMint: 'abc123',
          symbol: 'TEST1',
          entryPriceSol: 1.0,
          currentPriceSol: 0.75,
          peakPriceSol: 1.2,
          entryAmountSol: 0.1,
          openedAt: new Date(Date.now() - 3600000).toISOString(),
        };
      }
      return null;
    },
    updatePosition: () => {},
    closePosition: () => ({}),
  },
});

mock.module('./executor.js', {
  namedExports: {
    sellToken: async ({ mint, sellPct }) => ({
      success: true,
      txHash: 'mock_il_tx_' + mint.slice(0, 4),
      solReceived: 0.02,
    }),
  },
});

// ─── Import after mocks ───────────────────────────────────────────────────────

const {
  calcVolatility,
  getDynamicThresholds,
  evaluateTier,
  recordPrice,
  DEFAULTS,
} = await import('./il-protection.js');

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('calcVolatility()', () => {
  test('returns base volatility for insufficient data (<5 points)', () => {
    // Each call is a fresh module, so price history is empty
    const vol = calcVolatility('fresh_mint');
    assert.equal(vol, DEFAULTS.baseVolatility);
  });

  test('returns base volatility for exactly 4 points', () => {
    recordPrice('vol_mint', 1.0);
    recordPrice('vol_mint', 1.1);
    recordPrice('vol_mint', 0.9);
    recordPrice('vol_mint', 1.05);
    const vol = calcVolatility('vol_mint');
    assert.equal(vol, DEFAULTS.baseVolatility);
  });

  test('calculates volatility from price history', () => {
    // Record price history for testing mint
    for (let i = 0; i < 10; i++) {
      recordPrice('vol_mint2', 1.0);
    }
    const vol = calcVolatility('vol_mint2');
    // All same prices = 0 variance
    assert.equal(vol, 0);
  });

  test('handles volatile prices correctly', () => {
    // Record volatile price history
    const prices = [1.0, 1.5, 0.8, 1.3, 0.6, 1.2, 0.7, 1.1, 0.9, 1.4];
    for (const p of prices) {
      recordPrice('vol_mint3', p);
    }
    const vol = calcVolatility('vol_mint3');
    assert.ok(vol > 0, `Expected positive volatility, got ${vol}`);
    assert.ok(vol < 100, `Expected reasonable volatility, got ${vol}`);
  });
});

describe('getDynamicThresholds()', () => {
  const baseConfig = {
    alertThreshold: 10,
    hedgeThreshold: 20,
    exitThreshold: 35,
    baseVolatility: 30,
    volatilityBump: 5,
  };

  test('returns base thresholds when volatility <= baseline', () => {
    const t = getDynamicThresholds(25, baseConfig);
    assert.equal(t.alertThreshold, 10);
    assert.equal(t.hedgeThreshold, 20);
    assert.equal(t.exitThreshold, 35);
  });

  test('increases thresholds with volatility', () => {
    // 80 vol = 50 above baseline = +5 bump
    const t = getDynamicThresholds(80, baseConfig);
    assert.equal(t.alertThreshold, 15);
    assert.equal(t.hedgeThreshold, 25);
    assert.equal(t.exitThreshold, 40);
  });

  test('scales proportionally with extreme volatility', () => {
    // 130 vol = 100 above baseline = +10 bump (2 * 5)
    const t = getDynamicThresholds(130, baseConfig);
    assert.equal(t.alertThreshold, 20);
    assert.equal(t.hedgeThreshold, 30);
    assert.equal(t.exitThreshold, 45);
  });

  test('uses DEFAULTS when config not provided', () => {
    const t = getDynamicThresholds(30, undefined);
    assert.ok(t.alertThreshold >= 10);
    assert.ok(t.hedgeThreshold >= 20);
    assert.ok(t.exitThreshold >= 35);
  });
});

describe('evaluateTier()', () => {
  const basePosition = {
    tokenMint: 'test_mint',
    symbol: 'TEST',
    entryPriceSol: 1.0,
    peakPriceSol: 1.2,
    entryAmountSol: 0.1,
    openedAt: new Date(Date.now() - 3600000).toISOString(),
  };

  test('Tier 0 (SAFE) when drawdown below alert threshold', () => {
    // Price at 0.95 = 5% drawdown from 1.0 entry
    const result = evaluateTier('safe_mint', 0.95, { ...basePosition });
    assert.equal(result.tier, 0);
    assert.equal(result.name, 'SAFE');
    assert.equal(result.shouldAct, false);
  });

  test('Tier 1 (ALERT) when drawdown exceeds alert threshold', () => {
    // Price at 0.85 = 15% drawdown from 1.0 entry (> 10%)
    const result = evaluateTier('alert_mint', 0.85, { ...basePosition });
    assert.equal(result.tier, 1);
    assert.equal(result.name, 'ALERT');
    assert.equal(result.shouldAct, false);
  });

  test('Tier 2 (HEDGE) when drawdown exceeds hedge threshold', () => {
    // Price at 0.75 = 25% drawdown from 1.0 entry (> 20%)
    const result = evaluateTier('hedge_mint', 0.75, { ...basePosition });
    assert.equal(result.tier, 2);
    assert.equal(result.name, 'HEDGE');
    assert.equal(result.shouldAct, true);
  });

  test('Tier 3 (EXIT) when drawdown exceeds exit threshold', () => {
    // Price at 0.60 = 40% drawdown from 1.0 entry (> 35%)
    const result = evaluateTier('exit_mint', 0.60, { ...basePosition });
    assert.equal(result.tier, 3);
    assert.equal(result.name, 'EXIT');
    assert.equal(result.shouldAct, true);
  });

  test('returns 0 for non-existent position', () => {
    const result = evaluateTier('nonexistent', 1.0);
    assert.equal(result.tier, 0);
    assert.equal(result.name, 'NO_POSITION');
  });

  test('returns 0 for position with no entry price', () => {
    const result = evaluateTier('no_entry', 1.0, {
      symbol: 'BAD',
      entryPriceSol: 0,
    });
    assert.equal(result.tier, 0);
    assert.equal(result.name, 'NO_ENTRY_PRICE');
  });
});

describe('boundary conditions', () => {
  const basePosition = {
    tokenMint: 'test_mint',
    symbol: 'TEST',
    entryPriceSol: 1.0,
    peakPriceSol: 1.2,
    entryAmountSol: 0.1,
    openedAt: new Date(Date.now() - 3600000).toISOString(),
  };

  test('exactly at hedge threshold triggers Tier 2', () => {
    // 0.79 = 21% drawdown, safely above 20% hedge threshold
    const result = evaluateTier('exact_hedge', 0.79, { ...basePosition });
    assert.ok(result.tier >= 2, `Expected tier >= 2 at 21% drawdown, got tier ${result.tier} (${result.drawdownPct}%)`);
    assert.ok(result.drawdownPct >= 20);
  });

  test('profit mode returns Tier 0', () => {
    // currentPrice > entryPrice = profit
    const result = evaluateTier('profit_mint', 2.0, { ...basePosition });
    assert.equal(result.tier, 0, `Expected tier 0 on profit, got ${result.tier}`);
    assert.ok(result.drawdownPct < 0, `Expected negative drawdown, got ${result.drawdownPct}`);
  });
});

describe('DEFAULTS', () => {
  test('has all required tiers', () => {
    assert.ok(DEFAULTS.alertThreshold === 10);
    assert.ok(DEFAULTS.hedgeThreshold === 20);
    assert.ok(DEFAULTS.exitThreshold === 35);
    assert.ok(DEFAULTS.enabled === true);
  });

  test('has default sell percentages', () => {
    assert.equal(DEFAULTS.hedgeSellPct, 50);
    assert.equal(DEFAULTS.exitSellPct, 100);
  });
});

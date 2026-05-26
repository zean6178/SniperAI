/**
 * rebalance-engine.test.js
 * Tests for Rebalance Engine
 * 
 * Run: node --test rebalance-engine.test.js
 */

import { test, describe, before, mock } from 'node:test';
import assert from 'node:assert/strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const openPositions = {};

mock.module('./state.js', {
  namedExports: {
    getOpenPositions: () => ({ ...openPositions }),
    updatePosition: (mint, data) => {},
    closePosition: (mint, data) => ({}),
    getFullState: () => ({ positions: openPositions }),
  },
});

mock.module('./executor.js', {
  namedExports: {
    sellToken: async ({ mint, sellPct }) => ({
      success: true,
      txHash: 'mock_tx_' + mint.slice(0, 4),
      solReceived: 0.05,
    }),
  },
});

mock.module('./config.js', {
  namedExports: {
    getConfig: () => ({
      isDryRun: true,
      entry: { slippageBps: 1000 },
      rebalance: {
        enabled: true,
        maxSingleExposure: 0.5,
        minProfitToTrim: 50,
        trimPct: 30,
        maxDrawdownToCut: 20,
        cutPct: 50,
        staleHoursToReview: 2,
        rebalanceIntervalMs: 60000,
        minPortfolioValueSol: 0.1,
      },
    }),
  },
});

// ─── Import after mocks ───────────────────────────────────────────────────────

const { calcPortfolioValue, scorePosition, DEFAULTS } = await import('./rebalance-engine.js');

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('calcPortfolioValue()', () => {
  test('returns zero for empty positions', () => {
    const result = calcPortfolioValue({});
    assert.equal(result.totalValueSol, 0);
    assert.equal(result.positions.length, 0);
  });

  test('calculates single position value correctly', () => {
    const positions = {
      'abc123': {
        tokenMint: 'abc123',
        symbol: 'TEST',
        entryAmountSol: 1.0,
        entryPriceSol: 0.5,
        currentPriceSol: 1.0,
        peakPriceSol: 1.2,
        openedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    };
    const result = calcPortfolioValue(positions);
    assert.equal(result.totalValueSol, 2.0); // 1.0 SOL * (1.0/0.5) = 2.0
    assert.equal(result.positions.length, 1);
    assert.equal(result.positions[0].multiplier, 2.0);
    assert.equal(result.positions[0].pnlPct, 100);
  });

  test('handles multiple positions', () => {
    const positions = {
      'aaa': {
        tokenMint: 'aaa',
        symbol: 'WIN',
        entryAmountSol: 0.5,
        entryPriceSol: 0.1,
        currentPriceSol: 0.2,
        peakPriceSol: 0.3,
        openedAt: new Date(Date.now() - 1800000).toISOString(),
      },
      'bbb': {
        tokenMint: 'bbb',
        symbol: 'LOSS',
        entryAmountSol: 0.3,
        entryPriceSol: 1.0,
        currentPriceSol: 0.6,
        peakPriceSol: 1.1,
        openedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    };
    const result = calcPortfolioValue(positions);
    // WIN: 0.5 * (0.2/0.1) = 1.0
    // LOSS: 0.3 * (0.6/1.0) = 0.18
    assert.equal(Number(result.totalValueSol.toFixed(4)), 1.18);
    assert.equal(result.positions.length, 2);
  });

  test('falls back to entry price when currentPrice is missing', () => {
    const positions = {
      'xyz': {
        tokenMint: 'xyz',
        symbol: 'NOPRICE',
        entryAmountSol: 0.5,
        entryPriceSol: 0.1,
        openedAt: new Date().toISOString(),
      },
    };
    const result = calcPortfolioValue(positions);
    assert.equal(result.totalValueSol, 0.5); // currentPrice falls back to entryPrice
  });
});

describe('scorePosition()', () => {
  test('returns high score for deep drawdown position', () => {
    const pos = {
      mint: 'abc',
      symbol: 'CRASH',
      currentValue: 0.3,
      totalValue: 1.0,
      pnlPct: -25,
      peakPriceSol: 2.0,
      currentPrice: 0.75,
      entryPrice: 1.0,
      openedAt: new Date(Date.now() - 7200000).toISOString(),
    };
    const { score, reasons } = scorePosition(pos, 1.0);
    assert.ok(score >= 30, `Expected score >= 30, got ${score}`);
    assert.ok(reasons.some(r => r.includes('drawdown')), 'Should mention drawdown');
  });

  test('detects stale positions', () => {
    const pos = {
      currentValue: 0.2,
      totalValue: 1.0,
      pnlPct: 2,
      currentPrice: 1.02,
      entryPrice: 1.0,
      peakPriceSol: 1.05,
      openedAt: new Date(Date.now() - 10800000).toISOString(), // 3h ago
    };
    const { score, reasons } = scorePosition(pos, 1.0);
    assert.ok(score >= 10, `Stale score >= 10, got ${score}`);
    assert.ok(pos.isStale, 'Position should be marked stale');
  });

  test('identifies concentrated winners for trimming', () => {
    const pos = {
      currentValue: 0.6,
      totalValue: 1.0,
      pnlPct: 80,
      peakPriceSol: 1.9,
      currentPrice: 1.8,
      entryPrice: 1.0,
      openedAt: new Date(Date.now() - 1800000).toISOString(),
    };
    const { score, reasons } = scorePosition(pos, 1.0);
    assert.ok(score >= 10, `Trim winner score >= 10, got ${score}`);
    assert.ok(reasons.some(r => r.includes('trim')), 'Should suggest trimming');
  });

  test('returns zero for healthy positions', () => {
    const pos = {
      currentValue: 0.2,
      totalValue: 1.0,
      pnlPct: 5,
      peakPriceSol: 1.06,
      currentPrice: 1.05,
      entryPrice: 1.0,
      openedAt: new Date(Date.now() - 600000).toISOString(), // 10 min ago
    };
    const { score } = scorePosition(pos, 1.0);
    assert.equal(score, 0);
  });
});

describe('module exports', () => {
  test('DEFAULTS has expected keys', () => {
    assert.ok(DEFAULTS.enabled === true);
    assert.ok(DEFAULTS.maxSingleExposure === 0.5);
    assert.ok(DEFAULTS.minProfitToTrim === 50);
  });
});

/**
 * Portfolio Routes — Positions, history, stats
 */

import { authGuard } from '../middleware/auth.js';
import { getOpenPositions, getTradeHistory, getDailyStats, getWinRate, getClosedToday } from '../../../../state.js';

export default async function portfolioRoutes(fastify) {

  /**
   * GET /portfolio/positions
   * All open positions with live PnL
   */
  fastify.get('/positions', { preHandler: [authGuard] }, async (request) => {
    const positions = getOpenPositions();
    const entries = Object.entries(positions);

    const formatted = entries.map(([mint, pos]) => ({
      mint,
      symbol: pos.symbol || mint.slice(0, 8),
      name: pos.name || '',
      entryAmountSol: pos.entryAmountSol || 0,
      entryPriceSol: pos.entryPriceSol || 0,
      currentPriceSol: pos.currentPriceSol || pos.entryPriceSol || 0,
      currentMultiple: pos.currentMultiple || 1,
      pnlPct: pos.pnlPct || 0,
      pnlSol: pos.currentMultiple
        ? (pos.entryAmountSol || 0) * ((pos.currentMultiple || 1) - 1)
        : 0,
      peakMultiple: pos.peakMultiple || 1,
      soldPct: pos.soldPct || 0,
      holdTime: getHoldTime(pos.openedAt),
      screenScore: pos.screenScore || 0,
      openedAt: pos.openedAt,
      exitStrategy: {
        nextTp: getNextTp(pos),
        stopLoss: '-40%',
        trailingStop: '25% from peak',
      },
    }));

    // Summary
    const totalInvested = formatted.reduce((sum, p) => sum + p.entryAmountSol, 0);
    const totalCurrent = formatted.reduce((sum, p) => sum + p.entryAmountSol * (p.currentMultiple || 1), 0);
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return {
      positions: formatted,
      summary: {
        totalPositions: formatted.length,
        totalInvestedSol: parseFloat(totalInvested.toFixed(4)),
        totalCurrentValueSol: parseFloat(totalCurrent.toFixed(4)),
        totalPnlSol: parseFloat(totalPnl.toFixed(4)),
        totalPnlPct: parseFloat(totalPnlPct.toFixed(1)),
      },
    };
  });

  /**
   * GET /portfolio/history
   * Closed trades with performance data
   */
  fastify.get('/history', { preHandler: [authGuard] }, async (request) => {
    const { limit = 50, offset = 0 } = request.query;
    const history = getTradeHistory(parseInt(limit));

    const trades = history.slice(parseInt(offset)).map(trade => ({
      mint: trade.tokenMint || trade.mint,
      symbol: trade.symbol || '???',
      entryAmountSol: trade.entryAmountSol || 0,
      exitAmountSol: trade.pnlSol ? (trade.entryAmountSol || 0) + trade.pnlSol : 0,
      pnlSol: trade.pnlSol || 0,
      pnlPct: trade.entryAmountSol
        ? ((trade.pnlSol || 0) / trade.entryAmountSol) * 100
        : 0,
      peakMultiple: trade.peakMultiple || 1,
      holdTime: getHoldTime(trade.openedAt, trade.closedAt),
      exitReason: trade.closeReason || trade.closeType || 'unknown',
      screenScore: trade.screenScore || 0,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt,
    }));

    // Stats
    const wins = trades.filter(t => t.pnlSol > 0).length;
    const losses = trades.filter(t => t.pnlSol <= 0).length;
    const totalProfit = trades.filter(t => t.pnlSol > 0).reduce((s, t) => s + t.pnlSol, 0);
    const totalLoss = trades.filter(t => t.pnlSol <= 0).reduce((s, t) => s + t.pnlSol, 0);
    const avgPnlPct = trades.length > 0
      ? trades.reduce((s, t) => s + t.pnlPct, 0) / trades.length
      : 0;

    return {
      trades,
      stats: {
        totalTrades: trades.length,
        winRate: trades.length > 0 ? parseFloat(((wins / trades.length) * 100).toFixed(1)) : 0,
        avgPnlPct: parseFloat(avgPnlPct.toFixed(1)),
        totalProfitSol: parseFloat(totalProfit.toFixed(4)),
        totalLossSol: parseFloat(totalLoss.toFixed(4)),
        bestTrade: trades.sort((a, b) => b.pnlPct - a.pnlPct)[0] || null,
        worstTrade: trades.sort((a, b) => a.pnlPct - b.pnlPct)[0] || null,
      },
    };
  });

  /**
   * GET /portfolio/stats
   * Performance analytics
   */
  fastify.get('/stats', { preHandler: [authGuard] }, async (request) => {
    const { period = '7d' } = request.query;

    const stats = getDailyStats();
    const winRate = getWinRate();
    const closedToday = getClosedToday();

    return {
      period,
      winRate: parseFloat(winRate),
      totalTrades: stats.tradesCount,
      profitSol: stats.totalPnlSol > 0 ? stats.totalPnlSol : 0,
      lossSol: stats.totalPnlSol < 0 ? stats.totalPnlSol : 0,
      netPnlSol: parseFloat(stats.totalPnlSol.toFixed(4)),
      totalBuySol: parseFloat(stats.totalBuySol.toFixed(4)),
      wins: stats.wins,
      losses: stats.losses,
      closedToday: closedToday.length,
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHoldTime(openedAt, closedAt = null) {
  if (!openedAt) return '?';
  const start = new Date(openedAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const ms = end - start;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function getNextTp(position) {
  const soldPct = position.soldPct || 0;
  const levels = [
    { at: '2.0x', sellPct: 50 },
    { at: '3.0x', sellPct: 30 },
    { at: '5.0x', sellPct: 15 },
  ];
  const sold = position.sellHistory || [];
  for (const level of levels) {
    const alreadySold = sold.some(s => s.triggerMultiple === parseFloat(level.at));
    if (!alreadySold) return level;
  }
  return { at: 'moonbag', sellPct: 5 };
}

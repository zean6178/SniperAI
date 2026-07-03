/**
 * api-server.js
 * REST API + WebSocket Server untuk SniperAI Android App
 *
 * Endpoints:
 *   GET  /api/status       — Bot status, balance, daily stats
 *   GET  /api/positions     — Open positions with PnL
 *   GET  /api/history       — Trade history (closed positions)
 *   GET  /api/config        — Current config (non-sensitive)
 *   POST /api/pause         — Pause bot
 *   POST /api/resume        — Resume bot
 *   POST /api/sell          — Force sell position { mint, sellPct }
 *   POST /api/mode          — Change bot mode { mode: 'semi-auto'|'full-auto' }
 *
 * WebSocket events:
 *   → server:  trade, position_update, bot_status, snipe_alert, error
 *   ← client:  subscribe, unsubscribe
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import chalk from 'chalk';

// ═══════════════════════════════════════════════════════════════════════════════
// STATE — populated by initApiServer()
// ═══════════════════════════════════════════════════════════════════════════════

let _getConfig = null;
let _getBalance = null;
let _getOpenPositions = null;
let _getOpenPositionCount = null;
let _getDailyStats = null;
let _getTradeHistory = null;
let _getWinRate = null;
let _isPaused = null;
let _setPaused = null;
let _sellToken = null;
let _getTokenPrice = null;
let _formatMcapUsd = null;
let _API_KEY = null;

let io = null;
let httpServer = null;

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!_API_KEY || apiKey === _API_KEY) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized — invalid API key' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT — called from index.js after all modules are loaded
// ═══════════════════════════════════════════════════════════════════════════════

export function initApiServer(deps) {
  _getConfig           = deps.getConfig;
  _getBalance          = deps.getBalance;
  _getOpenPositions    = deps.getOpenPositions;
  _getOpenPositionCount = deps.getOpenPositionCount;
  _getDailyStats       = deps.getDailyStats;
  _getTradeHistory     = deps.getTradeHistory;
  _getWinRate          = deps.getWinRate;
  _isPaused            = deps.isPaused;
  _setPaused           = deps.setPaused;
  _sellToken           = deps.sellToken;
  _getTokenPrice       = deps.getTokenPrice;
  _formatMcapUsd       = deps.formatMcapUsd;
  _API_KEY             = deps.apiKey;

  const config = _getConfig();
  const port = config.api?.port || 3000;

  const app = express();
  httpServer = createServer(app);

  app.use(cors());
  app.use(express.json());
  app.use('/api', authMiddleware);

  // ═══════════════════════════════════════════════════════════════════════════
  // REST ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/status
  app.get('/api/status', async (req, res) => {
    try {
      const cfg = _getConfig();
      const bal = await _getBalance().catch(() => ({ solBalance: 0, address: '' }));
      const posCount = _getOpenPositionCount();
      const stats = _getDailyStats();
      const winRate = _getWinRate();
      const positions = _getOpenPositions();

      // Calculate unrealized PnL
      let unrealizedPnlSol = 0;
      const posList = Object.values(positions);
      for (const pos of posList) {
        unrealizedPnlSol += (pos.pnlSol || 0);
      }

      res.json({
        success: true,
        data: {
          bot: {
            mode: cfg.botMode,
            isDryRun: cfg.isDryRun,
            paused: _isPaused(),
          },
          wallet: {
            address: bal.address,
            balanceSol: bal.solBalance,
          },
          positions: {
            open: posCount,
            max: cfg.risk.maxOpenPositions,
          },
          daily: {
            trades: stats.tradesCount,
            maxTrades: cfg.risk.maxDailyTrades,
            wins: stats.wins,
            losses: stats.losses,
            totalPnlSol: stats.totalPnlSol,
            winRate: winRate,
          },
          unrealizedPnlSol,
        },
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // GET /api/positions
  app.get('/api/positions', async (req, res) => {
    try {
      const positions = _getOpenPositions();
      const cfg = _getConfig();

      const enriched = [];
      for (const [mint, pos] of Object.entries(positions)) {
        // Try to get current price
        let currentPrice = null;
        let currentMultiple = 1;
        let pnlPct = 0;
        let pnlSol = 0;
        try {
          currentPrice = await _getTokenPrice(mint, pos.useBondingCurve);
          if (currentPrice && pos.entryPriceSol > 0) {
            currentMultiple = currentPrice / pos.entryPriceSol;
            pnlPct = ((currentPrice - pos.entryPriceSol) / pos.entryPriceSol) * 100;
            const remainingPct = 1 - ((pos.soldPct || 0) / 100);
            pnlSol = (pos.entryAmountSol || 0) * (currentMultiple - 1) * remainingPct;
          }
        } catch (e) {
          // Price fetch failed — use stored values
          currentMultiple = pos.currentMultiple || 1;
          pnlPct = pos.pnlPct || 0;
          pnlSol = pos.pnlSol || 0;
        }

        const currentMcapSol = pos.entryMcapSol > 0
          ? pos.entryMcapSol * currentMultiple
          : 0;

        const duration = pos.openedAt
          ? Math.floor((Date.now() - new Date(pos.openedAt).getTime()) / 1000)
          : 0;

        enriched.push({
          mint,
          symbol: pos.symbol || mint.slice(0, 8),
          name: pos.name || '',
          entryAmountSol: pos.entryAmountSol || 0,
          entryPriceSol: pos.entryPriceSol || 0,
          entryMcapSol: pos.entryMcapSol || 0,
          currentPrice,
          currentMultiple: parseFloat(currentMultiple.toFixed(2)),
          currentMcapSol: parseFloat(currentMcapSol.toFixed(4)),
          currentMcapUsd: _formatMcapUsd(currentMcapSol),
          pnlPct: parseFloat(pnlPct.toFixed(1)),
          pnlSol: parseFloat(pnlSol.toFixed(4)),
          soldPct: pos.soldPct || 0,
          tradeMode: pos.tradeMode || null,
          openedAt: pos.openedAt,
          duration,
          txHash: pos.txHash,
          screenScore: pos.screenScore || 0,
        });
      }

      res.json({ success: true, data: enriched });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // GET /api/history?limit=50
  app.get('/api/history', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const trades = _getTradeHistory(limit);
      res.json({ success: true, data: trades });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // GET /api/config
  app.get('/api/config', (req, res) => {
    try {
      const cfg = _getConfig();
      res.json({
        success: true,
        data: {
          botMode: cfg.botMode,
          isDryRun: cfg.isDryRun,
          entry: {
            buyAmountSol: cfg.entry.buyAmountSol,
            slippageBps: cfg.entry.slippageBps,
          },
          exit: {
            stopLossPct: cfg.exit.stopLossPct,
            trailingStopPct: cfg.exit.trailingStopPct,
            maxHoldTimeMinutes: cfg.exit.maxHoldTimeMinutes,
            takeProfitLevels: cfg.exit.takeProfitLevels,
          },
          risk: {
            maxOpenPositions: cfg.risk.maxOpenPositions,
            maxDailyTrades: cfg.risk.maxDailyTrades,
            gasReserveSol: cfg.risk.gasReserveSol,
          },
          screening: {
            snipeThreshold: cfg.screening.snipeThreshold,
            watchThreshold: cfg.screening.watchThreshold,
            maxMcapSol: cfg.screening.maxMcapSol,
            maxTokenAgeMinutes: cfg.screening.maxTokenAgeMinutes,
          },
        },
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST /api/pause
  app.post('/api/pause', (req, res) => {
    try {
      _setPaused(true);
      broadcast('bot_status', { paused: true });
      res.json({ success: true, data: { paused: true } });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST /api/resume
  app.post('/api/resume', (req, res) => {
    try {
      _setPaused(false);
      broadcast('bot_status', { paused: false });
      res.json({ success: true, data: { paused: false } });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST /api/sell  { mint, sellPct }
  app.post('/api/sell', async (req, res) => {
    try {
      const { mint, sellPct } = req.body;
      if (!mint || !sellPct) {
        return res.status(400).json({ success: false, error: 'mint and sellPct required' });
      }

      const positions = _getOpenPositions();
      const pos = positions[mint];
      if (!pos) {
        return res.status(404).json({ success: false, error: 'Position not found' });
      }

      const cfg = _getConfig();
      const result = await _sellToken({
        mint,
        sellPct: parseInt(sellPct),
        slippageBps: cfg.entry.slippageBps,
        tradeValueSol: (pos.entryAmountSol || 0) * (parseInt(sellPct) / 100),
        entryPriceSol: pos.entryPriceSol,
      });

      if (result.success) {
        broadcast('position_update', {
          mint,
          action: 'sell',
          sellPct: parseInt(sellPct),
          solReceived: result.solReceived,
          remainingTokens: result.remainingTokens,
        });
        res.json({ success: true, data: result });
      } else {
        res.json({ success: false, error: result.error });
      }
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST /api/mode  { mode: 'semi-auto'|'full-auto' }
  app.post('/api/mode', (req, res) => {
    try {
      const { mode } = req.body;
      if (!['semi-auto', 'full-auto'].includes(mode)) {
        return res.status(400).json({ success: false, error: 'mode must be semi-auto or full-auto' });
      }
      process.env.BOT_MODE = mode;
      broadcast('bot_status', { mode });
      res.json({ success: true, data: { mode } });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBSOCKET (Socket.io)
  // ═══════════════════════════════════════════════════════════════════════════

  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // Auth middleware for WebSocket
  io.use((socket, next) => {
    const apiKey = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!_API_KEY || apiKey === _API_KEY) {
      return next();
    }
    return next(new Error('Unauthorized — invalid API key'));
  });

  io.on('connection', (socket) => {
    console.log(chalk.cyan(`[api] 📱 Client connected: ${socket.id}`));

    socket.on('subscribe', (channel) => {
      if (channel) {
        socket.join(channel);
        console.log(chalk.gray(`[api] ${socket.id} subscribed to ${channel}`));
      }
    });

    socket.on('unsubscribe', (channel) => {
      if (channel) {
        socket.leave(channel);
      }
    });

    socket.on('disconnect', () => {
      console.log(chalk.gray(`[api] Client disconnected: ${socket.id}`));
    });
  });

  // Start server
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(chalk.green(`\n[api] 🚀 API Server running on http://0.0.0.0:${port}`));
    console.log(chalk.gray(`[api]    WebSocket: ws://0.0.0.0:${port}`));
    console.log(chalk.gray(`[api]    Auth: ${_API_KEY ? 'API key required' : '⚠️  NO API KEY SET — open to anyone!'}`));
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET BROADCAST — called from index.js pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export function broadcast(event, data) {
  if (!io) return;
  try {
    io.emit(event, { ...data, timestamp: new Date().toISOString() });
  } catch (e) {
    // Silently fail — WebSocket is auxiliary, don't crash the bot
  }
}

export function broadcastSnipeAlert(tokenData, screenResult) {
  broadcast('snipe_alert', {
    mint: tokenData.mint,
    symbol: tokenData.symbol,
    name: tokenData.name,
    score: screenResult.score,
    marketCapSol: tokenData.marketCapSol,
    marketCapUsd: _formatMcapUsd ? _formatMcapUsd(tokenData.marketCapSol) : 'N/A',
    mode: screenResult.mode || 'unknown',
    reasons: screenResult.reasons || [],
  });
}

export function broadcastTrade(action, data) {
  broadcast('trade', {
    action, // 'buy' | 'sell' | 'exit'
    ...data,
  });
}

export function broadcastPositionUpdate(mint, updates) {
  broadcast('position_update', {
    mint,
    ...updates,
  });
}

export function stopApiServer() {
  if (io) {
    io.close();
    io = null;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  console.log(chalk.yellow('[api] Server stopped'));
}
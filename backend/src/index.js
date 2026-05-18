/**
 * SniperAI Backend — Main Server Entry Point
 * 
 * Fastify REST API + WebSocket server that exposes bot engine to mobile app.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

// Routes
import tokenRoutes from './api/routes/tokens.js';
import tradeRoutes from './api/routes/trade.js';
import portfolioRoutes from './api/routes/portfolio.js';
import authRoutes from './api/routes/auth.js';
import alertRoutes from './api/routes/alerts.js';

// WebSocket
import { registerWebSocket } from './ws/handler.js';

// Services
import { startDetectorService } from './services/detector-service.js';
import { startMonitorService } from './services/monitor-service.js';
import { initRedis } from './db/redis.js';

// ─── Server Setup ─────────────────────────────────────────────────────────────
const app = Fastify({
  logger: false,
});

async function start() {
  // Register plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(websocket);

  // Register routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(tokenRoutes, { prefix: '/api/v1/tokens' });
  await app.register(tradeRoutes, { prefix: '/api/v1/trade' });
  await app.register(portfolioRoutes, { prefix: '/api/v1/portfolio' });
  await app.register(alertRoutes, { prefix: '/api/v1/alerts' });

  // Register WebSocket
  await app.register(registerWebSocket);

  // Health check
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  // Initialize services
  await initRedis();
  startDetectorService();
  startMonitorService();

  // Start server
  const port = parseInt(process.env.PORT || '3000');
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });

  console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════╗
║         🎯 SniperAI Backend v1.0                     ║
║         API Server + WebSocket                       ║
╚═══════════════════════════════════════════════════════╝
  `));
  console.log(chalk.green(`Server running on http://${host}:${port}`));
  console.log(chalk.green(`WebSocket on ws://${host}:${port}/ws`));
  console.log(chalk.yellow(`Endpoints:`));
  console.log(chalk.yellow(`  POST /api/v1/auth/login`));
  console.log(chalk.yellow(`  GET  /api/v1/tokens/feed`));
  console.log(chalk.yellow(`  GET  /api/v1/tokens/:mint`));
  console.log(chalk.yellow(`  GET  /api/v1/tokens/trending`));
  console.log(chalk.yellow(`  POST /api/v1/trade/prepare-buy`));
  console.log(chalk.yellow(`  POST /api/v1/trade/submit`));
  console.log(chalk.yellow(`  POST /api/v1/trade/prepare-sell`));
  console.log(chalk.yellow(`  POST /api/v1/trade/submit-sell`));
  console.log(chalk.yellow(`  GET  /api/v1/portfolio/positions`));
  console.log(chalk.yellow(`  GET  /api/v1/portfolio/history`));
  console.log(chalk.yellow(`  GET  /api/v1/portfolio/stats`));
  console.log(chalk.yellow(`  GET  /api/v1/alerts/config`));
  console.log(chalk.yellow(`  PUT  /api/v1/alerts/config`));
  console.log('');
}

start().catch(err => {
  console.error(chalk.red(`Fatal: ${err.message}`));
  process.exit(1);
});

export default app;

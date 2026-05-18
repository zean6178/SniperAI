/**
 * Alert Routes — Notification preferences
 */

import { authGuard } from '../middleware/auth.js';

// In-memory alert configs (replace with DB in production)
const alertConfigs = new Map();

const DEFAULT_CONFIG = {
  enabled: true,
  minScoreForAlert: 75,
  alertOnRug: true,
  alertOnTakeProfit: true,
  alertOnStopLoss: true,
  quietHours: { start: '23:00', end: '07:00' },
  maxAlertsPerHour: 10,
};

export default async function alertRoutes(fastify) {

  fastify.get('/config', { preHandler: [authGuard] }, async (request) => {
    const config = alertConfigs.get(request.wallet) || DEFAULT_CONFIG;
    return config;
  });

  fastify.put('/config', { preHandler: [authGuard] }, async (request) => {
    const updates = request.body || {};
    const current = alertConfigs.get(request.wallet) || { ...DEFAULT_CONFIG };
    const updated = { ...current, ...updates };
    alertConfigs.set(request.wallet, updated);
    return updated;
  });
}

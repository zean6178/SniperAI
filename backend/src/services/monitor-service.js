/**
 * Monitor Service — Position monitoring for multi-user API
 * Wraps the core monitor.js and broadcasts updates via WebSocket.
 */

import { broadcastPositionUpdate, broadcastAlert } from '../ws/handler.js';

export function startMonitorService() {
  console.log('[monitor-service] Starting position monitor service...');
  // The core monitor is started from the bot engine (monitor.js)
  // This service hooks into it for API/WS broadcasting
}

/**
 * Called when a position price updates
 */
export function onPositionUpdate(wallet, data) {
  broadcastPositionUpdate(wallet, {
    mint: data.mint,
    currentPriceSol: data.currentPriceSol,
    currentMultiple: data.currentMultiple,
    pnlPct: data.pnlPct,
    peakMultiple: data.peakMultiple,
  });
}

/**
 * Called when an alert triggers (rug, TP, SL)
 */
export function onAlertTrigger(wallet, alert) {
  broadcastAlert(wallet, {
    alertType: alert.type,
    mint: alert.mint,
    symbol: alert.symbol,
    message: alert.message,
    action: alert.action || 'review',
    severity: alert.severity || 'high',
  });
}

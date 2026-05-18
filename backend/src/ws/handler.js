/**
 * WebSocket Handler — Real-time data channels
 * 
 * Channels:
 * - token_feed: New tokens with scores
 * - positions: Position price updates
 * - alerts: Rug detection, TP/SL triggers
 * - score_update: Token score changes
 */

import { verifyToken } from '../api/middleware/auth.js';

const clients = new Map(); // ws → { wallet, subscriptions: Set }

export async function registerWebSocket(fastify) {
  fastify.get('/ws', { websocket: true }, (socket, request) => {
    const client = { wallet: null, subscriptions: new Set() };
    clients.set(socket, client);

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(socket, client, msg);
      } catch {
        socket.send(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
    });

    socket.on('error', () => {
      clients.delete(socket);
    });

    // Send welcome
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'SniperAI WebSocket connected. Authenticate and subscribe to channels.',
    }));
  });
}

function handleClientMessage(socket, client, msg) {
  switch (msg.type) {
    case 'auth': {
      const decoded = verifyToken(msg.token);
      if (decoded) {
        client.wallet = decoded.wallet;
        socket.send(JSON.stringify({ type: 'auth_ok', wallet: decoded.wallet }));
      } else {
        socket.send(JSON.stringify({ type: 'auth_failed', message: 'Invalid token' }));
      }
      break;
    }

    case 'subscribe': {
      if (!client.wallet) {
        socket.send(JSON.stringify({ type: 'error', message: 'Authenticate first' }));
        return;
      }
      const channel = msg.channel;
      if (['token_feed', 'positions', 'alerts', 'score_update'].includes(channel)) {
        client.subscriptions.add(channel);
        // Store filter preferences
        if (msg.minScore) client.minScore = parseInt(msg.minScore);
        socket.send(JSON.stringify({ type: 'subscribed', channel }));
      } else {
        socket.send(JSON.stringify({ type: 'error', message: `Unknown channel: ${channel}` }));
      }
      break;
    }

    case 'unsubscribe': {
      client.subscriptions.delete(msg.channel);
      socket.send(JSON.stringify({ type: 'unsubscribed', channel: msg.channel }));
      break;
    }

    case 'ping': {
      socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      break;
    }

    default:
      socket.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
  }
}

// ─── Broadcast Functions (called by services) ─────────────────────────────────

/**
 * Broadcast new token to all subscribed clients
 */
export function broadcastNewToken(tokenData) {
  const payload = JSON.stringify({ type: 'new_token', data: tokenData });

  for (const [socket, client] of clients) {
    if (!client.subscriptions.has('token_feed')) continue;
    if (client.minScore && tokenData.score < client.minScore) continue;
    try { socket.send(payload); } catch {}
  }
}

/**
 * Broadcast position update
 */
export function broadcastPositionUpdate(wallet, positionData) {
  const payload = JSON.stringify({ type: 'position_update', data: positionData });

  for (const [socket, client] of clients) {
    if (client.wallet !== wallet) continue;
    if (!client.subscriptions.has('positions')) continue;
    try { socket.send(payload); } catch {}
  }
}

/**
 * Broadcast alert (rug, TP, SL)
 */
export function broadcastAlert(wallet, alertData) {
  const payload = JSON.stringify({ type: 'alert', severity: alertData.severity || 'high', data: alertData });

  for (const [socket, client] of clients) {
    if (wallet && client.wallet !== wallet) continue;
    if (!client.subscriptions.has('alerts')) continue;
    try { socket.send(payload); } catch {}
  }
}

/**
 * Broadcast score change
 */
export function broadcastScoreUpdate(scoreData) {
  const payload = JSON.stringify({ type: 'score_update', data: scoreData });

  for (const [socket, client] of clients) {
    if (!client.subscriptions.has('score_update')) continue;
    try { socket.send(payload); } catch {}
  }
}

export function getConnectedCount() {
  return clients.size;
}

/**
 * Push Notification Service (Firebase Cloud Messaging)
 * 
 * Sends push notifications to mobile users for:
 * - High-score token alerts
 * - Rug detection warnings
 * - Take profit / stop loss triggers
 */

// In-memory device token store (replace with DB in production)
const deviceTokens = new Map(); // wallet → fcmToken

/**
 * Register device token for push notifications
 */
export function registerDeviceToken(wallet, fcmToken) {
  deviceTokens.set(wallet, fcmToken);
  console.log(`[push] Registered device for ${wallet.slice(0, 8)}…`);
}

/**
 * Remove device token
 */
export function unregisterDeviceToken(wallet) {
  deviceTokens.delete(wallet);
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(wallet, { title, body, data = {} }) {
  const fcmToken = deviceTokens.get(wallet);
  if (!fcmToken) return false;

  const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;
  if (!FCM_SERVER_KEY) {
    console.warn('[push] FCM_SERVER_KEY not configured — push disabled');
    return false;
  }

  try {
    const { default: axios } = await import('axios');
    await axios.post('https://fcm.googleapis.com/fcm/send', {
      to: fcmToken,
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      priority: 'high',
    }, {
      headers: {
        Authorization: `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });

    return true;
  } catch (e) {
    console.warn(`[push] Failed to send to ${wallet.slice(0, 8)}: ${e.message}`);
    return false;
  }
}

/**
 * Send token alert to all subscribed users
 */
export async function sendTokenAlert(tokenData) {
  const title = `🎯 SniperAI: ${tokenData.symbol} (Score: ${tokenData.score})`;
  const body = `New ${tokenData.decision} signal! MC: ${tokenData.marketCapSol?.toFixed(1)} SOL`;

  for (const [wallet] of deviceTokens) {
    await sendPushNotification(wallet, {
      title,
      body,
      data: { type: 'new_token', mint: tokenData.mint, score: String(tokenData.score) },
    });
  }
}

/**
 * Send rug alert
 */
export async function sendRugAlert(wallet, { symbol, mint, reason }) {
  await sendPushNotification(wallet, {
    title: `🚨 RUG ALERT: ${symbol}`,
    body: reason,
    data: { type: 'rug_alert', mint },
  });
}

/**
 * Send exit alert (TP/SL)
 */
export async function sendExitAlert(wallet, { symbol, mint, reason, pnlPct }) {
  const emoji = pnlPct >= 0 ? '✅' : '🔴';
  await sendPushNotification(wallet, {
    title: `${emoji} ${symbol}: ${reason}`,
    body: `PnL: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`,
    data: { type: 'exit_alert', mint },
  });
}

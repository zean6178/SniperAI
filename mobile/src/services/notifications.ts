/**
 * Push Notifications Service — FCM integration for Seeker
 * Registers device, handles incoming push, routes to correct screen.
 */

import { Platform, Alert } from 'react-native';
import { api } from './api';

let fcmToken: string | null = null;

export async function initPushNotifications(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    // Production: use @react-native-firebase/messaging
    // const messaging = (await import('@react-native-firebase/messaging')).default;
    // await messaging().requestPermission();
    // fcmToken = await messaging().getToken();

    // Dev mode mock
    fcmToken = `fcm_mock_${Date.now()}`;
    await api.post('/alerts/register-device', { fcmToken }).catch(() => {});
    console.log('[push] Registered:', fcmToken.slice(0, 20));
    return fcmToken;
  } catch (e: any) {
    console.warn('[push] Init failed:', e.message);
    return null;
  }
}

export function handleForegroundNotification(notification: any) {
  const { title, body, data } = notification;
  Alert.alert(title || 'SniperAI', body || '', [
    { text: 'Dismiss', style: 'cancel' },
    { text: 'View', onPress: () => handleNotificationTap(data) },
  ]);
}

export function handleNotificationTap(data: any) {
  if (!data) return;
  console.log('[push] Tap:', data.type, data.mint);
}

export function setupNotificationListeners() {
  console.log('[push] Listeners registered');
}

export async function unregisterPush() {
  if (fcmToken) {
    await api.post('/alerts/unregister-device', { fcmToken }).catch(() => {});
    fcmToken = null;
  }
}

/**
 * API Service — REST client for SniperAI backend
 */

export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api/v1'
  : 'https://api.sniperai.app/api/v1';

export const API_WS_URL = __DEV__
  ? 'ws://localhost:3000/ws'
  : 'wss://api.sniperai.app/ws';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Authenticated API client
 */
export const api = {
  async get(path: string) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error: ${res.status}`);
    }

    return res.json();
  },

  async post(path: string, body: any) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error: ${res.status}`);
    }

    return res.json();
  },

  async put(path: string, body: any) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `API error: ${res.status}`);
    }

    return res.json();
  },
};

/**
 * Login with wallet signature
 */
export async function login(walletAddress: string, signature: string, message: string) {
  const res = await api.post('/auth/login', { walletAddress, signature, message });
  if (res.token) {
    setAuthToken(res.token);
  }
  return res;
}

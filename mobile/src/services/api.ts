/**
 * API Service — REST client for SniperAI backend
 * 
 * Enhanced:
 * - Request/response interceptors
 * - Automatic retry on 5xx errors
 * - Request timeout
 * - Better error handling
 */

const DEV_MODE = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

export const API_BASE_URL = DEV_MODE
  ? 'http://localhost:3000/api/v1'
  : 'https://api.sniperai.app/api/v1';

export const API_WS_URL = DEV_MODE
  ? 'ws://localhost:3000/ws'
  : 'wss://api.sniperai.app/ws';

const REQUEST_TIMEOUT = 15000; // 15 seconds
const MAX_RETRIES = 2;

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Make API request with retry logic
 */
async function request(method: string, path: string, body?: any, retries = 0): Promise<any> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Version': '1.0.0',
    'X-Platform': 'seeker',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetchWithTimeout(url, options);

    // Handle auth expiry
    if (res.status === 401) {
      clearAuthToken();
      throw new Error('Authentication expired. Please reconnect wallet.');
    }

    // Handle rate limiting
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
      if (retries < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return request(method, path, body, retries + 1);
      }
      throw new Error('Rate limited. Please try again later.');
    }

    // Handle server errors with retry
    if (res.status >= 500 && retries < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * (retries + 1)));
      return request(method, path, body, retries + 1);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `API error: ${res.status}`);
    }

    return res.json();
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw e;
  }
}

/**
 * Authenticated API client
 */
export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body: any) => request('POST', path, body),
  put: (path: string, body: any) => request('PUT', path, body),
  delete: (path: string) => request('DELETE', path),
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

/**
 * Check if currently authenticated
 */
export function isAuthenticated(): boolean {
  return authToken !== null;
}

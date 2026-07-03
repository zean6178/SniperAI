/**
 * useTokenFeed — Real-time token feed with WebSocket + REST fallback
 * 
 * Enhanced: 
 * - WebSocket-first for real-time updates
 * - REST polling fallback when WS unavailable
 * - Sorting by score (highest first)
 * - Deduplication by mint address
 * - Auto-cleanup of stale tokens (>30min)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, API_WS_URL } from '../services/api';

interface TokenFeedOptions {
  minScore?: number;
  limit?: number;
  maxAge?: number; // ms, default 30min
}

export function useTokenFeed(options: TokenFeedOptions = {}) {
  const { minScore = 50, limit = 50, maxAge = 30 * 60 * 1000 } = options;
  const [tokens, setTokens] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Remove stale tokens and sort by score
  const processTokens = useCallback((tokenList: any[]) => {
    const now = Date.now();
    return tokenList
      .filter(t => {
        if (!t.detectedAt) return true;
        return (now - new Date(t.detectedAt).getTime()) < maxAge;
      })
      .filter(t => (t.score || 0) >= minScore)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);
  }, [minScore, limit, maxAge]);

  // Add/update token in list (dedup by mint)
  const upsertToken = useCallback((newToken: any) => {
    setTokens(prev => {
      const existing = prev.findIndex(t => t.mint === newToken.mint);
      let updated: any[];
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = { ...updated[existing], ...newToken };
      } else {
        updated = [newToken, ...prev];
      }
      return processTokens(updated);
    });
  }, [processTokens]);

  // WebSocket connection
  const connectWS = useCallback(() => {
    try {
      const ws = new WebSocket(API_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Subscribe to token feed
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'tokens', minScore }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'new_token' || msg.type === 'token_update') {
            upsertToken(msg.data || msg.token);
          } else if (msg.type === 'token_batch') {
            const batch = msg.data || msg.tokens || [];
            setTokens(prev => processTokens([...batch, ...prev]));
          }
        } catch {}
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        // Reconnect after 5s
        reconnectTimer.current = setTimeout(connectWS, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setIsConnected(false);
      reconnectTimer.current = setTimeout(connectWS, 5000);
    }
  }, [minScore, upsertToken, processTokens]);

  // REST fetch (fallback + initial load)
  const fetchFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/tokens/feed?minScore=${minScore}&limit=${limit}`);
      const fetched = res.tokens || [];
      setTokens(processTokens(fetched));
      if (!wsRef.current) setIsConnected(fetched.length > 0);
    } catch {
      // Use mock data in dev
      setTokens(processTokens(getMockTokens()));
      if (!wsRef.current) setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [minScore, limit, processTokens]);

  // Initialize: try WS, fallback to polling
  useEffect(() => {
    fetchFeed(); // Initial load via REST
    connectWS(); // Try WebSocket

    // Polling fallback every 8s (only if WS disconnected)
    pollTimer.current = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchFeed();
      }
    }, 8000);

    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  return {
    tokens,
    isLoading,
    isConnected,
    refresh: fetchFeed,
    totalCount: tokens.length,
  };
}

// Mock data for development/offline
function getMockTokens() {
  const now = Date.now();
  return [
    {
      mint: 'ABC123mock1111111111111111111111111111111111',
      symbol: 'PEPE2',
      name: 'Pepe 2.0',
      score: 85,
      decision: 'SNIPE',
      marketCapSol: 18.5,
      volume5mSol: 6.3,
      buyCount5m: 28,
      uniqueBuyers: 15,
      bondingCurvePct: 22.5,
      isBundled: false,
      reasons: [
        '✅ Strong buy pressure: 82%',
        '✅ Diverse buyers: 15 unique wallets',
        '✅ Bonding curve: 22% (sweet spot)',
        '✅ No bundling detected',
      ],
      detectedAt: new Date(now - 120000).toISOString(),
      deployer: 'DeP1oyer111111111111111111111111111111111111',
    },
    {
      mint: 'DEF456mock2222222222222222222222222222222222',
      symbol: 'CHAD',
      name: 'GigaChad Token',
      score: 72,
      decision: 'SNIPE',
      marketCapSol: 8.2,
      volume5mSol: 3.8,
      buyCount5m: 14,
      uniqueBuyers: 9,
      bondingCurvePct: 15.3,
      isBundled: false,
      reasons: [
        '✅ Good buy count: 14 in 5m',
        '✅ Volume: 3.8 SOL (5m)',
        '⚠️ Low unique buyers: 9',
      ],
      detectedAt: new Date(now - 300000).toISOString(),
      deployer: 'DeP2oyer222222222222222222222222222222222222',
    },
    {
      mint: 'GHI789mock3333333333333333333333333333333333',
      symbol: 'MOON',
      name: 'Moon Shot',
      score: 58,
      decision: 'WATCH',
      marketCapSol: 4.1,
      volume5mSol: 1.5,
      buyCount5m: 7,
      uniqueBuyers: 5,
      bondingCurvePct: 8.0,
      isBundled: false,
      reasons: [
        '⚠️ Low buy count: 7',
        '⏳ Bonding curve early: 8%',
        '⚠️ Few unique buyers',
      ],
      detectedAt: new Date(now - 60000).toISOString(),
      deployer: 'DeP3oyer333333333333333333333333333333333333',
    },
    {
      mint: 'JKL012mock4444444444444444444444444444444444',
      symbol: 'DOGE3',
      name: 'Doge 3.0',
      score: 45,
      decision: 'SKIP',
      marketCapSol: 2.0,
      volume5mSol: 0.5,
      buyCount5m: 3,
      uniqueBuyers: 2,
      bondingCurvePct: 3.0,
      isBundled: true,
      reasons: [
        '🚫 Bundled launch detected',
        '❌ Only 2 unique buyers',
        '❌ Very low volume',
      ],
      detectedAt: new Date(now - 500000).toISOString(),
      deployer: 'DeP4oyer444444444444444444444444444444444444',
    },
  ];
}

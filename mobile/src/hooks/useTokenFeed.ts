/**
 * useTokenFeed — Fetches and manages real-time token feed
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface TokenFeedOptions {
  minScore?: number;
  limit?: number;
}

export function useTokenFeed(options: TokenFeedOptions = {}) {
  const { minScore = 50, limit = 30 } = options;
  const [tokens, setTokens] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const fetchFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/tokens/feed?minScore=${minScore}&limit=${limit}`);
      setTokens(res.tokens || []);
      setIsConnected(true);
    } catch (e) {
      console.warn('[feed] Fetch failed, using mock data');
      setTokens(getMockTokens());
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [minScore, limit]);

  useEffect(() => {
    fetchFeed();
    // Poll every 5 seconds (WebSocket preferred in production)
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  return {
    tokens,
    isLoading,
    isConnected,
    refresh: fetchFeed,
  };
}

// Mock data for development
function getMockTokens() {
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
      isBundled: false,
      reasons: ['✅ Strong buy pressure: 82%', '✅ Diverse buyers: 15 wallets', '✅ Bonding curve: 22% (sweet spot)'],
      detectedAt: new Date(Date.now() - 120000).toISOString(),
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
      isBundled: false,
      reasons: ['✅ Buy count: 14', '✅ Volume 5m: 3.8 SOL', '⚠️ Low unique buyers: 9'],
      detectedAt: new Date(Date.now() - 300000).toISOString(),
      deployer: 'DeP2oyer222222222222222222222222222222222222',
    },
    {
      mint: 'GHI789mock3333333333333333333333333333333333',
      symbol: 'MOON',
      name: 'Moon Shot',
      score: 55,
      decision: 'WATCH',
      marketCapSol: 4.1,
      volume5mSol: 1.5,
      buyCount5m: 7,
      uniqueBuyers: 5,
      isBundled: false,
      reasons: ['⚠️ Low buy count: 7', '⏳ Bonding curve early: 8%'],
      detectedAt: new Date(Date.now() - 60000).toISOString(),
      deployer: 'DeP3oyer333333333333333333333333333333333333',
    },
  ];
}

/**
 * usePortfolio — Fetches open positions and stats
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function usePortfolio() {
  const [positions, setPositions] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalPositions: 0,
    totalInvestedSol: 0,
    totalCurrentValueSol: 0,
    totalPnlSol: 0,
    totalPnlPct: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/portfolio/positions');
      setPositions(res.positions || []);
      setSummary(res.summary || summary);
    } catch (e) {
      // Use mock data in dev
      setPositions(getMockPositions());
      setSummary({
        totalPositions: 2,
        totalInvestedSol: 1.0,
        totalCurrentValueSol: 1.45,
        totalPnlSol: 0.45,
        totalPnlPct: 45.0,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 10000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  return { positions, summary, isLoading, refresh: fetchPortfolio };
}

function getMockPositions() {
  return [
    {
      mint: 'ABC123mock1111',
      symbol: 'PEPE2',
      entryAmountSol: 0.5,
      currentMultiple: 2.1,
      pnlPct: 110,
      peakMultiple: 2.3,
      holdTime: '8m',
      screenScore: 85,
    },
    {
      mint: 'DEF456mock2222',
      symbol: 'CHAD',
      entryAmountSol: 0.5,
      currentMultiple: 0.8,
      pnlPct: -20,
      peakMultiple: 1.3,
      holdTime: '22m',
      screenScore: 72,
    },
  ];
}

/**
 * useWallet — Public wallet API for components
 * 
 * Re-exports wallet context with convenience properties.
 * Enhanced with balance tracking and auth status.
 */

import { useState, useEffect, useCallback } from 'react';
import { useWalletContext } from '../providers/WalletProvider';
import { api, setAuthToken } from '../services/api';

export function useWallet() {
  const ctx = useWalletContext();
  const [balance, setBalance] = useState<number | null>(null);

  // Fetch SOL balance when connected
  const fetchBalance = useCallback(async () => {
    if (!ctx.account?.address) {
      setBalance(null);
      return;
    }
    try {
      const res = await api.get(`/portfolio/balance?wallet=${ctx.account.address}`);
      setBalance(res.balanceSol || 0);
    } catch {
      setBalance(null);
    }
  }, [ctx.account?.address]);

  // Auto-authenticate with backend when wallet connects
  const connectAndAuth = useCallback(async () => {
    const account = await ctx.connect();
    if (account) {
      try {
        // Sign a message for backend auth
        const message = `SniperAI Auth: ${Date.now()}`;
        const msgBytes = new TextEncoder().encode(message);
        const signature = await ctx.signMessage(msgBytes);
        
        // Login to backend
        const res = await api.post('/auth/login', {
          walletAddress: account.address,
          signature: Buffer.from(signature).toString('base64'),
          message,
        });
        
        if (res.token) {
          setAuthToken(res.token);
        }
      } catch {
        // Wallet connected but backend auth failed — still usable
      }
      fetchBalance();
    }
    return account;
  }, [ctx.connect, ctx.signMessage, fetchBalance]);

  useEffect(() => {
    if (ctx.isConnected) {
      fetchBalance();
      const interval = setInterval(fetchBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [ctx.isConnected, fetchBalance]);

  return {
    wallet: ctx.account?.address || null,
    publicKey: ctx.account?.publicKey || null,
    isConnected: ctx.isConnected,
    isConnecting: ctx.isConnecting,
    balance,
    connect: connectAndAuth,
    disconnect: ctx.disconnect,
    signMessage: ctx.signMessage,
    signTransaction: ctx.signTransaction,
    signAndSendTransaction: ctx.signAndSendTransaction,
    refreshBalance: fetchBalance,
  };
}

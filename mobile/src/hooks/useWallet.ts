/**
 * useWallet — Solana Mobile Wallet Adapter hook
 * 
 * Connects to Seed Vault via Mobile Wallet Adapter protocol.
 * In development/simulator, uses a mock wallet.
 */

import { useState, useCallback } from 'react';

interface WalletState {
  wallet: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
  signTransaction: (tx: string) => Promise<string>;
}

export function useWallet(): WalletState {
  const [wallet, setWallet] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      // In production: use @solana-mobile/mobile-wallet-adapter-protocol
      // const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
      // const authResult = await transact(async (mobileWallet) => {
      //   return await mobileWallet.authorize({ cluster: 'mainnet-beta', identity: { name: 'SniperAI' } });
      // });
      // setWallet(authResult.accounts[0].address);

      // Dev mode: mock wallet
      const mockWallet = 'SniperAI' + Math.random().toString(36).slice(2, 10) + '...mock';
      setWallet(mockWallet);
      console.log('[wallet] Connected:', mockWallet);
    } catch (e: any) {
      console.error('[wallet] Connect failed:', e.message);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');
    // In production: sign with Seed Vault
    return 'mock_signature_' + Date.now();
  }, [wallet]);

  const signTransaction = useCallback(async (tx: string): Promise<string> => {
    if (!wallet) throw new Error('Wallet not connected');
    // In production: sign serialized tx with Seed Vault
    return tx; // Returns "signed" tx
  }, [wallet]);

  return {
    wallet,
    isConnected: !!wallet,
    connect,
    disconnect,
    signMessage,
    signTransaction,
  };
}

/**
 * useWallet — Re-exports wallet context from WalletProvider
 * 
 * This is the public API for components to access wallet state.
 * Internally uses the WalletProvider context (Seed Vault / MWA).
 */

import { useWalletContext } from '../providers/WalletProvider';

export function useWallet() {
  const ctx = useWalletContext();

  return {
    wallet: ctx.account?.address || null,
    publicKey: ctx.account?.publicKey || null,
    isConnected: ctx.isConnected,
    isConnecting: ctx.isConnecting,
    connect: ctx.connect,
    disconnect: ctx.disconnect,
    signMessage: ctx.signMessage,
    signTransaction: ctx.signTransaction,
    signAndSendTransaction: ctx.signAndSendTransaction,
  };
}

/**
 * WalletProvider — Solana Mobile Wallet Adapter (MWA) Context
 * 
 * Wraps the app with MobileWalletProvider from @wallet-ui/react-native-web3js.
 * Provides wallet connection state, signing, and transaction submission
 * to all child components via React Context.
 * 
 * On Seeker devices, this connects to the Seed Vault hardware wallet.
 * On other devices, it connects to any MWA-compatible wallet (Phantom, Solflare, etc.)
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Platform } from 'react-native';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import bs58 from 'bs58';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface WalletAccount {
  address: string;
  publicKey: PublicKey;
  label?: string;
}

interface WalletContextState {
  // State
  account: WalletAccount | null;
  isConnected: boolean;
  isConnecting: boolean;
  authToken: string | null;

  // Actions
  connect: () => Promise<WalletAccount | null>;
  disconnect: () => void;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAndSendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<string>;
  signAllTransactions: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const WalletContext = createContext<WalletContextState>({
  account: null,
  isConnected: false,
  isConnecting: false,
  authToken: null,
  connect: async () => null,
  disconnect: () => {},
  signMessage: async () => new Uint8Array(),
  signTransaction: async (tx) => tx,
  signAndSendTransaction: async () => '',
  signAllTransactions: async (txs) => txs,
});

export function useWalletContext() {
  return useContext(WalletContext);
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP IDENTITY (shown in wallet approval dialog)
// ═══════════════════════════════════════════════════════════════════════════════

const APP_IDENTITY = {
  name: 'SniperAI',
  uri: 'https://sniperai.app',
  icon: 'favicon.ico', // relative to uri
};

const CLUSTER = 'mainnet-beta';
const RPC_ENDPOINT = process.env.EXPO_PUBLIC_RPC_URL || clusterApiUrl(CLUSTER);

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const connection = useMemo(() => new Connection(RPC_ENDPOINT, 'confirmed'), []);

  // ─── Connect (authorize with wallet) ────────────────────────────────────────
  const connect = useCallback(async (): Promise<WalletAccount | null> => {
    if (Platform.OS !== 'android') {
      console.warn('[wallet] MWA only supported on Android');
      return null;
    }

    setIsConnecting(true);
    try {
      const result = await transact(async (wallet) => {
        // Authorize — this opens the wallet app and asks user to approve
        const authResult = await wallet.authorize({
          chain: `solana:${CLUSTER}`,
          identity: APP_IDENTITY,
        });

        return authResult;
      });

      if (result?.accounts?.[0]) {
        const addr = result.accounts[0].address;
        const walletAccount: WalletAccount = {
          address: addr,
          publicKey: new PublicKey(bs58.decode(addr)),
          label: result.accounts[0].label || undefined,
        };

        setAccount(walletAccount);
        setAuthToken(result.auth_token || null);
        console.log('[wallet] ✅ Connected:', addr.slice(0, 8) + '…');
        return walletAccount;
      }

      return null;
    } catch (e: any) {
      console.error('[wallet] Connect failed:', e.message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // ─── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (authToken) {
      // Deauthorize if we have an auth token
      transact(async (wallet) => {
        await wallet.deauthorize({ auth_token: authToken });
      }).catch(() => {});
    }
    setAccount(null);
    setAuthToken(null);
    console.log('[wallet] Disconnected');
  }, [authToken]);

  // ─── Sign Message ───────────────────────────────────────────────────────────
  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!authToken) throw new Error('Wallet not connected');

    const result = await transact(async (wallet) => {
      // Reauthorize with stored auth_token
      await wallet.authorize({
        chain: `solana:${CLUSTER}`,
        identity: APP_IDENTITY,
        auth_token: authToken,
      });

      // Sign the message
      const signedMessages = await wallet.signMessages({
        addresses: [account!.address],
        payloads: [message],
      });

      return signedMessages[0];
    });

    return result;
  }, [authToken, account]);

  // ─── Sign Transaction (does NOT send) ──────────────────────────────────────
  const signTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<Transaction | VersionedTransaction> => {
    if (!authToken) throw new Error('Wallet not connected');

    const result = await transact(async (wallet) => {
      await wallet.authorize({
        chain: `solana:${CLUSTER}`,
        identity: APP_IDENTITY,
        auth_token: authToken,
      });

      // Serialize the transaction
      const serialized = 'version' in transaction
        ? transaction.serialize()
        : transaction.serialize({ requireAllSignatures: false });

      const signedTxs = await wallet.signTransactions({
        transactions: [serialized],
      });

      return signedTxs[0];
    });

    // Deserialize back
    if ('version' in transaction) {
      return VersionedTransaction.deserialize(result);
    } else {
      return Transaction.from(result);
    }
  }, [authToken]);

  // ─── Sign and Send Transaction ──────────────────────────────────────────────
  const signAndSendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<string> => {
    if (!authToken) throw new Error('Wallet not connected');

    const txHash = await transact(async (wallet) => {
      await wallet.authorize({
        chain: `solana:${CLUSTER}`,
        identity: APP_IDENTITY,
        auth_token: authToken,
      });

      const serialized = 'version' in transaction
        ? transaction.serialize()
        : transaction.serialize({ requireAllSignatures: false });

      // sign_and_send_transactions — wallet signs AND submits to network
      const signatures = await wallet.signAndSendTransactions({
        transactions: [serialized],
      });

      return bs58.encode(signatures[0]);
    });

    // Wait for confirmation
    await connection.confirmTransaction(txHash, 'confirmed');

    return txHash;
  }, [authToken, connection]);

  // ─── Sign All Transactions ──────────────────────────────────────────────────
  const signAllTransactions = useCallback(async (
    transactions: (Transaction | VersionedTransaction)[]
  ): Promise<(Transaction | VersionedTransaction)[]> => {
    if (!authToken) throw new Error('Wallet not connected');

    const results = await transact(async (wallet) => {
      await wallet.authorize({
        chain: `solana:${CLUSTER}`,
        identity: APP_IDENTITY,
        auth_token: authToken,
      });

      const serializedTxs = transactions.map(tx =>
        'version' in tx ? tx.serialize() : tx.serialize({ requireAllSignatures: false })
      );

      return await wallet.signTransactions({ transactions: serializedTxs });
    });

    // Deserialize all back
    return results.map((result, i) => {
      const original = transactions[i];
      if ('version' in original) {
        return VersionedTransaction.deserialize(result);
      }
      return Transaction.from(result);
    });
  }, [authToken]);

  // ─── Context value ──────────────────────────────────────────────────────────
  const contextValue: WalletContextState = useMemo(() => ({
    account,
    isConnected: !!account,
    isConnecting,
    authToken,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    signAndSendTransaction,
    signAllTransactions,
  }), [account, isConnecting, authToken, connect, disconnect, signMessage, signTransaction, signAndSendTransaction, signAllTransactions]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

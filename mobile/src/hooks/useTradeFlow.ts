/**
 * useTradeFlow — Complete buy/sell flow with Seed Vault signing
 * 
 * Flow:
 * 1. Call backend to prepare unsigned transaction
 * 2. Sign with Seed Vault (via WalletProvider)
 * 3. Submit signed tx back to backend (which broadcasts to Solana)
 * 
 * This hook encapsulates the entire trade lifecycle.
 */

import { useState, useCallback } from 'react';
import { VersionedTransaction } from '@solana/web3.js';
import { useWalletContext } from '../providers/WalletProvider';
import { api } from '../services/api';

interface TradeResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

interface BuyParams {
  mint: string;
  amountSol: number;
  slippageBps?: number;
}

interface SellParams {
  mint: string;
  sellPct: number;
  slippageBps?: number;
}

export function useTradeFlow() {
  const { isConnected, signTransaction, account } = useWalletContext();
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [lastResult, setLastResult] = useState<TradeResult | null>(null);

  /**
   * Execute buy: prepare → sign with Seed Vault → submit
   */
  const executeBuy = useCallback(async ({ mint, amountSol, slippageBps = 1500 }: BuyParams): Promise<TradeResult> => {
    if (!isConnected || !account) {
      return { success: false, error: 'Wallet not connected' };
    }

    setIsBuying(true);
    setLastResult(null);

    try {
      // STEP 1: Prepare unsigned transaction from backend
      console.log(`[trade] Preparing buy: ${amountSol} SOL → ${mint.slice(0, 8)}…`);
      const prepareRes = await api.post('/trade/prepare-buy', {
        mint,
        amountSol,
        slippageBps,
      });

      if (!prepareRes.transaction) {
        throw new Error('No transaction returned from backend');
      }

      // STEP 2: Deserialize and sign with Seed Vault
      console.log('[trade] Signing with Seed Vault...');
      const txBuffer = Buffer.from(prepareRes.transaction, 'base64');
      const unsignedTx = VersionedTransaction.deserialize(txBuffer);
      const signedTx = await signTransaction(unsignedTx) as VersionedTransaction;

      // STEP 3: Serialize signed tx and submit to backend
      console.log('[trade] Submitting signed transaction...');
      const signedBase64 = Buffer.from(signedTx.serialize()).toString('base64');
      const submitRes = await api.post('/trade/submit', {
        signedTransaction: signedBase64,
        mint,
        amountSol,
      });

      const result: TradeResult = {
        success: submitRes.success,
        txHash: submitRes.txHash,
      };

      setLastResult(result);
      console.log(`[trade] ✅ Buy success: ${submitRes.txHash}`);
      return result;

    } catch (e: any) {
      const result: TradeResult = { success: false, error: e.message };
      setLastResult(result);
      console.error(`[trade] ❌ Buy failed: ${e.message}`);
      return result;
    } finally {
      setIsBuying(false);
    }
  }, [isConnected, account, signTransaction]);

  /**
   * Execute sell: prepare → sign with Seed Vault → submit
   */
  const executeSell = useCallback(async ({ mint, sellPct, slippageBps = 1500 }: SellParams): Promise<TradeResult> => {
    if (!isConnected || !account) {
      return { success: false, error: 'Wallet not connected' };
    }

    setIsSelling(true);
    setLastResult(null);

    try {
      // STEP 1: Prepare unsigned sell transaction
      console.log(`[trade] Preparing sell: ${sellPct}% of ${mint.slice(0, 8)}…`);
      const prepareRes = await api.post('/trade/prepare-sell', {
        mint,
        sellPct,
        slippageBps,
      });

      if (!prepareRes.transaction) {
        throw new Error('No sell transaction returned from backend');
      }

      // STEP 2: Sign with Seed Vault
      console.log('[trade] Signing sell with Seed Vault...');
      const txBuffer = Buffer.from(prepareRes.transaction, 'base64');
      const unsignedTx = VersionedTransaction.deserialize(txBuffer);
      const signedTx = await signTransaction(unsignedTx) as VersionedTransaction;

      // STEP 3: Submit signed sell
      console.log('[trade] Submitting signed sell...');
      const signedBase64 = Buffer.from(signedTx.serialize()).toString('base64');
      const submitRes = await api.post('/trade/submit-sell', {
        signedTransaction: signedBase64,
        mint,
        sellPct,
      });

      const result: TradeResult = {
        success: submitRes.success,
        txHash: submitRes.txHash,
      };

      setLastResult(result);
      console.log(`[trade] ✅ Sell success: ${submitRes.txHash}`);
      return result;

    } catch (e: any) {
      const result: TradeResult = { success: false, error: e.message };
      setLastResult(result);
      console.error(`[trade] ❌ Sell failed: ${e.message}`);
      return result;
    } finally {
      setIsSelling(false);
    }
  }, [isConnected, account, signTransaction]);

  return {
    executeBuy,
    executeSell,
    isBuying,
    isSelling,
    isTrading: isBuying || isSelling,
    lastResult,
  };
}

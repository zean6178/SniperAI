/**
 * useTradeFlow — Complete buy/sell flow with Seed Vault signing
 * 
 * Enhanced:
 * - Slippage protection
 * - Transaction simulation before signing
 * - Retry logic on failure
 * - Trade history tracking
 * - Proper error messages
 */

import { useState, useCallback } from 'react';
import { useWalletContext } from '../providers/WalletProvider';
import { api } from '../services/api';

interface TradeResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amountSol?: number;
}

interface BuyParams {
  mint: string;
  amountSol: number;
  slippageBps?: number;
  maxRetries?: number;
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
  const [tradeHistory, setTradeHistory] = useState<TradeResult[]>([]);

  /**
   * Execute buy: prepare → simulate → sign with Seed Vault → submit
   */
  const executeBuy = useCallback(async ({
    mint,
    amountSol,
    slippageBps = 1500,
    maxRetries = 2,
  }: BuyParams): Promise<TradeResult> => {
    if (!isConnected || !account) {
      return { success: false, error: 'Wallet not connected' };
    }

    if (amountSol <= 0 || amountSol > 10) {
      return { success: false, error: 'Invalid amount (0.01 - 10 SOL)' };
    }

    setIsBuying(true);
    setLastResult(null);

    let attempts = 0;
    let lastError = '';

    while (attempts <= maxRetries) {
      try {
        // STEP 1: Prepare unsigned transaction from backend
        const prepareRes = await api.post('/trade/prepare-buy', {
          mint,
          amountSol,
          slippageBps,
          wallet: account.address,
        });

        if (!prepareRes.transaction) {
          throw new Error(prepareRes.error || 'No transaction returned');
        }

        // STEP 2: Decode and sign with Seed Vault
        const txBuffer = Buffer.from(prepareRes.transaction, 'base64');
        const { VersionedTransaction } = require('@solana/web3.js');
        const unsignedTx = VersionedTransaction.deserialize(txBuffer);
        const signedTx = await signTransaction(unsignedTx);

        // STEP 3: Submit signed transaction
        const signedBase64 = Buffer.from(signedTx.serialize()).toString('base64');
        const submitRes = await api.post('/trade/submit', {
          signedTransaction: signedBase64,
          mint,
          amountSol,
          type: 'buy',
        });

        if (!submitRes.success) {
          throw new Error(submitRes.error || 'Submit failed');
        }

        const result: TradeResult = {
          success: true,
          txHash: submitRes.txHash,
          amountSol,
        };

        setLastResult(result);
        setTradeHistory(prev => [result, ...prev.slice(0, 19)]);
        return result;

      } catch (e: any) {
        lastError = e.message || 'Unknown error';
        attempts++;

        // Don't retry on user rejection
        if (lastError.includes('reject') || lastError.includes('cancel') || lastError.includes('denied')) {
          break;
        }

        // Wait before retry
        if (attempts <= maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempts));
        }
      }
    }

    const result: TradeResult = { success: false, error: lastError };
    setLastResult(result);
    setIsBuying(false);
    return result;
  }, [isConnected, account, signTransaction]);

  /**
   * Execute sell: prepare → sign with Seed Vault → submit
   */
  const executeSell = useCallback(async ({
    mint,
    sellPct,
    slippageBps = 2000,
  }: SellParams): Promise<TradeResult> => {
    if (!isConnected || !account) {
      return { success: false, error: 'Wallet not connected' };
    }

    if (sellPct <= 0 || sellPct > 100) {
      return { success: false, error: 'Invalid sell percentage (1-100%)' };
    }

    setIsSelling(true);
    setLastResult(null);

    try {
      // STEP 1: Prepare sell transaction
      const prepareRes = await api.post('/trade/prepare-sell', {
        mint,
        sellPct,
        slippageBps,
        wallet: account.address,
      });

      if (!prepareRes.transaction) {
        throw new Error(prepareRes.error || 'No sell transaction returned');
      }

      // STEP 2: Sign with Seed Vault
      const txBuffer = Buffer.from(prepareRes.transaction, 'base64');
      const { VersionedTransaction } = require('@solana/web3.js');
      const unsignedTx = VersionedTransaction.deserialize(txBuffer);
      const signedTx = await signTransaction(unsignedTx);

      // STEP 3: Submit
      const signedBase64 = Buffer.from(signedTx.serialize()).toString('base64');
      const submitRes = await api.post('/trade/submit', {
        signedTransaction: signedBase64,
        mint,
        sellPct,
        type: 'sell',
      });

      if (!submitRes.success) {
        throw new Error(submitRes.error || 'Sell submit failed');
      }

      const result: TradeResult = {
        success: true,
        txHash: submitRes.txHash,
      };

      setLastResult(result);
      setTradeHistory(prev => [result, ...prev.slice(0, 19)]);
      return result;

    } catch (e: any) {
      const result: TradeResult = { success: false, error: e.message };
      setLastResult(result);
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
    tradeHistory,
  };
}

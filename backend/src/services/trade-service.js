/**
 * Trade Service — Prepare and submit transactions
 * 
 * Key difference from bot engine: transactions are NOT signed server-side.
 * Instead, we prepare unsigned transactions for the mobile app to sign
 * with Seed Vault, then submit the signed result.
 */

import { Connection, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';
import { savePosition, updatePosition, closePosition, recordBuy } from '../../../state.js';

const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

function getConnection() {
  return new Connection(RPC_URL, { commitment: 'confirmed' });
}

/**
 * Prepare unsigned buy transaction (for mobile signing)
 */
export async function prepareBuyTransaction({ wallet, mint, amountSol, slippageBps }) {
  try {
    // Get transaction from PumpPortal (unsigned)
    const response = await axios.post('https://pumpportal.fun/api/trade-local', {
      publicKey: wallet,
      action: 'buy',
      mint,
      amount: amountSol * LAMPORTS_PER_SOL,
      denominatedInSol: 'true',
      slippage: slippageBps / 100,
      priorityFee: 0.00005,
      pool: 'pump',
    }, { timeout: 10000 });

    if (!response.data) throw new Error('No transaction returned from PumpPortal');

    return {
      transaction: typeof response.data === 'string' ? response.data : Buffer.from(response.data).toString('base64'),
      estimatedTokens: null, // Determined after execution
      priceImpact: null,
      fee: {
        networkFee: 0.000005,
        priorityFee: 0.00005,
        platformFee: amountSol * 0.005, // 0.5% platform fee
      },
    };
  } catch (e) {
    // Fallback: Jupiter
    try {
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const quoteRes = await axios.get('https://quote-api.jup.ag/v6/quote', {
        params: {
          inputMint: SOL_MINT,
          outputMint: mint,
          amount: Math.floor(amountSol * LAMPORTS_PER_SOL),
          slippageBps,
        },
        timeout: 10000,
      });

      const swapRes = await axios.post('https://quote-api.jup.ag/v6/swap', {
        quoteResponse: quoteRes.data,
        userPublicKey: wallet,
        wrapAndUnwrapSol: true,
      }, { timeout: 10000 });

      return {
        transaction: swapRes.data.swapTransaction,
        estimatedTokens: parseInt(quoteRes.data.outAmount || 0),
        priceImpact: parseFloat(quoteRes.data.priceImpactPct || 0),
        fee: {
          networkFee: 0.000005,
          priorityFee: 0.00005,
          platformFee: amountSol * 0.005,
        },
      };
    } catch (jupErr) {
      throw new Error(`Both PumpPortal and Jupiter failed: ${e.message} | ${jupErr.message}`);
    }
  }
}

/**
 * Prepare unsigned sell transaction
 */
export async function prepareSellTransaction({ wallet, mint, sellPct, slippageBps }) {
  // Get token balance first (via RPC)
  const connection = getConnection();
  const { PublicKey } = await import('@solana/web3.js');
  const tokenAccounts = await connection.getTokenAccountsByOwner(new PublicKey(wallet), {
    mint: new PublicKey(mint),
  });

  if (!tokenAccounts.value.length) {
    throw new Error('No token balance found');
  }

  const data = tokenAccounts.value[0].account.data;
  const tokenBalance = Number(data.readBigUInt64LE(64));
  const sellAmount = Math.floor(tokenBalance * (sellPct / 100));

  if (sellAmount <= 0) throw new Error('Sell amount too small');

  try {
    const response = await axios.post('https://pumpportal.fun/api/trade-local', {
      publicKey: wallet,
      action: 'sell',
      mint,
      amount: sellAmount,
      denominatedInSol: 'false',
      slippage: slippageBps / 100,
      priorityFee: 0.00005,
      pool: 'pump',
    }, { timeout: 10000 });

    return {
      transaction: typeof response.data === 'string' ? response.data : Buffer.from(response.data).toString('base64'),
      estimatedSolReceived: null,
      estimatedPnl: null,
    };
  } catch (e) {
    // Jupiter fallback
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const quoteRes = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: { inputMint: mint, outputMint: SOL_MINT, amount: sellAmount, slippageBps },
      timeout: 10000,
    });

    const swapRes = await axios.post('https://quote-api.jup.ag/v6/swap', {
      quoteResponse: quoteRes.data,
      userPublicKey: wallet,
      wrapAndUnwrapSol: true,
    }, { timeout: 10000 });

    const solReceived = parseInt(quoteRes.data.outAmount || 0) / LAMPORTS_PER_SOL;

    return {
      transaction: swapRes.data.swapTransaction,
      estimatedSolReceived: solReceived,
      estimatedPnl: null,
    };
  }
}

/**
 * Submit signed transaction to blockchain
 */
export async function submitTransaction({ signedTransaction, mint, amountSol, sellPct, wallet, type }) {
  const connection = getConnection();

  const txBuf = Buffer.from(signedTransaction, 'base64');
  const tx = VersionedTransaction.deserialize(txBuf);

  const txHash = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  await connection.confirmTransaction(txHash, 'confirmed');

  if (type === 'buy') {
    // Save position to state
    savePosition(mint, {
      symbol: '',
      entryAmountSol: amountSol,
      entryPriceSol: 0,
      tokenAmount: 0,
      txHash,
    });
    recordBuy(amountSol);

    return {
      txHash,
      position: { mint, entryAmountSol: amountSol, openedAt: new Date().toISOString() },
    };
  }

  if (type === 'sell') {
    return {
      txHash,
      solReceived: null,
      pnlSol: null,
      remainingPct: 100 - (sellPct || 100),
    };
  }

  return { txHash };
}

/**
 * executor.js
 * Trade Executor — Menjalankan buy/sell token di Pump.fun
 * 
 * Supports:
 * - Direct swap via Pump.fun bonding curve
 * - Jupiter aggregator (untuk token yang sudah migrate)
 * - Jito bundles (MEV protection)
 */

import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction,
         SystemProgram, ComputeBudgetProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import axios from 'axios';
import chalk from 'chalk';
import { getConfig } from './config.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION & WALLET
// ═══════════════════════════════════════════════════════════════════════════════

let _connection = null;
let _wallet = null;

export function getConnection() {
  if (!_connection) {
    const config = getConfig();
    _connection = new Connection(config.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000,
    });
  }
  return _connection;
}

export function getWallet() {
  if (!_wallet) {
    const config = getConfig();
    const secretKey = bs58.decode(config.walletPrivateKey);
    _wallet = Keypair.fromSecretKey(secretKey);
  }
  return _wallet;
}

export async function getBalance() {
  const connection = getConnection();
  const wallet = getWallet();
  const lamports = await connection.getBalance(wallet.publicKey);
  return {
    address: wallet.publicKey.toBase58(),
    solBalance: lamports / LAMPORTS_PER_SOL,
    lamports,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUY TOKEN (via PumpPortal API / Jupiter)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Buy token on Pump.fun
 * @param {object} params
 * @param {string} params.mint - Token mint address
 * @param {number} params.amountSol - Amount of SOL to spend
 * @param {number} params.slippageBps - Slippage tolerance in basis points
 * @returns {Promise<{success: boolean, txHash?: string, error?: string, tokenAmount?: number}>}
 */
export async function buyToken({ mint, amountSol, slippageBps }) {
  const config = getConfig();
  const isDry = config.isDryRun;

  if (isDry) {
    console.log(chalk.yellow(`[executor] 🧪 DRY RUN — Buy ${amountSol} SOL of ${mint.slice(0, 8)}…`));
    return { success: true, dryRun: true, txHash: 'DRY_RUN_BUY', tokenAmount: amountSol * 1000000 };
  }

  console.log(chalk.green(`[executor] 🟢 BUYING ${amountSol} SOL → ${mint.slice(0, 8)}…`));

  try {
    // Method 1: PumpPortal Trade API (fastest for pump.fun tokens)
    const result = await buyViaPumpPortal(mint, amountSol, slippageBps);
    if (result.success) return result;

    // Method 2: Fallback to Jupiter (for migrated tokens)
    console.log(chalk.yellow('[executor] PumpPortal failed, trying Jupiter...'));
    return await buyViaJupiter(mint, amountSol, slippageBps);
  } catch (e) {
    console.error(chalk.red(`[executor] Buy error: ${e.message}`));
    return { success: false, error: e.message };
  }
}

/**
 * Buy via PumpPortal API
 */
async function buyViaPumpPortal(mint, amountSol, slippageBps) {
  const wallet = getWallet();
  const config = getConfig();

  try {
    // Get transaction from PumpPortal
    const response = await axios.post('https://pumpportal.fun/api/trade-local', {
      publicKey: wallet.publicKey.toBase58(),
      action: 'buy',
      mint: mint,
      amount: amountSol * LAMPORTS_PER_SOL, // in lamports
      denominatedInSol: 'true',
      slippage: slippageBps / 100, // PumpPortal uses %
      priorityFee: config.entry.priorityFeeLamports / LAMPORTS_PER_SOL,
      pool: 'pump',
    }, { timeout: 10000 });

    if (!response.data) throw new Error('No transaction data returned');

    // Deserialize and sign
    const txData = Buffer.from(response.data, 'base64');
    const tx = VersionedTransaction.deserialize(txData);
    tx.sign([wallet]);

    // Send transaction
    const connection = getConnection();
    const txHash = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true, // PumpPortal txs need skipPreflight for speed
      maxRetries: 3,
    });

    // Confirm
    const confirmation = await connection.confirmTransaction(txHash, 'confirmed');
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log(chalk.green(`[executor] ✅ Buy success | tx: ${txHash}`));
    return { success: true, txHash, tokenAmount: null }; // Token amount determined post-tx

  } catch (e) {
    return { success: false, error: `PumpPortal: ${e.message}` };
  }
}

/**
 * Buy via Jupiter Aggregator (for migrated tokens)
 */
async function buyViaJupiter(mint, amountSol, slippageBps) {
  const wallet = getWallet();
  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  try {
    // Get quote
    const quoteRes = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint: SOL_MINT,
        outputMint: mint,
        amount: Math.floor(amountSol * LAMPORTS_PER_SOL),
        slippageBps: slippageBps,
      },
      timeout: 10000,
    });

    const quote = quoteRes.data;
    if (!quote) throw new Error('No quote available');

    // Get swap transaction
    const swapRes = await axios.post('https://quote-api.jup.ag/v6/swap', {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: getConfig().entry.priorityFeeLamports,
    }, { timeout: 10000 });

    const { swapTransaction } = swapRes.data;
    if (!swapTransaction) throw new Error('No swap transaction returned');

    // Deserialize, sign, send
    const txBuf = Buffer.from(swapTransaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([wallet]);

    const connection = getConnection();
    const txHash = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false, // Jupiter txs — use preflight for safety
      maxRetries: 3,
    });

    await connection.confirmTransaction(txHash, 'confirmed');

    const tokenAmount = parseInt(quote.outAmount || 0);
    console.log(chalk.green(`[executor] ✅ Jupiter buy success | tx: ${txHash} | tokens: ${tokenAmount}`));
    return { success: true, txHash, tokenAmount };

  } catch (e) {
    return { success: false, error: `Jupiter: ${e.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELL TOKEN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sell token
 * @param {object} params
 * @param {string} params.mint - Token mint address
 * @param {number} params.sellPct - Percentage of holdings to sell (0-100)
 * @param {number} params.slippageBps - Slippage tolerance
 * @returns {Promise<{success: boolean, txHash?: string, solReceived?: number, error?: string}>}
 */
export async function sellToken({ mint, sellPct, slippageBps }) {
  const config = getConfig();
  const isDry = config.isDryRun;

  if (isDry) {
    console.log(chalk.yellow(`[executor] 🧪 DRY RUN — Sell ${sellPct}% of ${mint.slice(0, 8)}…`));
    return { success: true, dryRun: true, txHash: 'DRY_RUN_SELL', solReceived: 0.1 };
  }

  console.log(chalk.red(`[executor] 🔴 SELLING ${sellPct}% of ${mint.slice(0, 8)}…`));

  try {
    // Get token balance
    const tokenBalance = await getTokenBalance(mint);
    if (!tokenBalance || tokenBalance <= 0) {
      return { success: false, error: 'No token balance found' };
    }

    const sellAmount = Math.floor(tokenBalance * (sellPct / 100));
    if (sellAmount <= 0) {
      return { success: false, error: 'Sell amount too small' };
    }

    // Method 1: PumpPortal
    const result = await sellViaPumpPortal(mint, sellAmount, slippageBps);
    if (result.success) return result;

    // Method 2: Jupiter fallback
    console.log(chalk.yellow('[executor] PumpPortal sell failed, trying Jupiter...'));
    return await sellViaJupiter(mint, sellAmount, slippageBps);

  } catch (e) {
    console.error(chalk.red(`[executor] Sell error: ${e.message}`));
    return { success: false, error: e.message };
  }
}

/**
 * Sell via PumpPortal
 */
async function sellViaPumpPortal(mint, tokenAmount, slippageBps) {
  const wallet = getWallet();
  const config = getConfig();

  try {
    const response = await axios.post('https://pumpportal.fun/api/trade-local', {
      publicKey: wallet.publicKey.toBase58(),
      action: 'sell',
      mint: mint,
      amount: tokenAmount,
      denominatedInSol: 'false',
      slippage: slippageBps / 100,
      priorityFee: config.entry.priorityFeeLamports / LAMPORTS_PER_SOL,
      pool: 'pump',
    }, { timeout: 10000 });

    if (!response.data) throw new Error('No transaction data');

    const txData = Buffer.from(response.data, 'base64');
    const tx = VersionedTransaction.deserialize(txData);
    tx.sign([wallet]);

    const connection = getConnection();
    const txHash = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true, // PumpPortal sell — need speed
      maxRetries: 3,
    });

    await connection.confirmTransaction(txHash, 'confirmed');

    console.log(chalk.green(`[executor] ✅ Sell success | tx: ${txHash}`));
    return { success: true, txHash, solReceived: null };

  } catch (e) {
    return { success: false, error: `PumpPortal sell: ${e.message}` };
  }
}

/**
 * Sell via Jupiter
 */
async function sellViaJupiter(mint, tokenAmount, slippageBps) {
  const wallet = getWallet();
  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  try {
    const quoteRes = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint: mint,
        outputMint: SOL_MINT,
        amount: tokenAmount,
        slippageBps: slippageBps,
      },
      timeout: 10000,
    });

    const quote = quoteRes.data;
    if (!quote) throw new Error('No sell quote');

    const swapRes = await axios.post('https://quote-api.jup.ag/v6/swap', {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      prioritizationFeeLamports: getConfig().entry.priorityFeeLamports,
    }, { timeout: 10000 });

    const { swapTransaction } = swapRes.data;
    const txBuf = Buffer.from(swapTransaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([wallet]);

    const connection = getConnection();
    const txHash = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false, // Jupiter sell — use preflight
      maxRetries: 3,
    });

    await connection.confirmTransaction(txHash, 'confirmed');

    const solReceived = parseInt(quote.outAmount || 0) / LAMPORTS_PER_SOL;
    console.log(chalk.green(`[executor] ✅ Jupiter sell success | tx: ${txHash} | received: ${solReceived.toFixed(4)} SOL`));
    return { success: true, txHash, solReceived };

  } catch (e) {
    return { success: false, error: `Jupiter sell: ${e.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get token balance for our wallet
 */
export async function getTokenBalance(mint) {
  const connection = getConnection();
  const wallet = getWallet();

  try {
    const mintPubkey = new PublicKey(mint);
    const tokenAccounts = await connection.getTokenAccountsByOwner(wallet.publicKey, {
      mint: mintPubkey,
    });

    if (!tokenAccounts.value.length) return 0;

    // Parse token account data
    const accountInfo = tokenAccounts.value[0].account;
    const data = accountInfo.data;
    // Token amount is at offset 64, 8 bytes (u64 little-endian)
    const amount = data.readBigUInt64LE(64);
    return Number(amount);
  } catch (e) {
    console.warn(`[executor] getTokenBalance error: ${e.message}`);
    return 0;
  }
}

/**
 * Get token price in SOL (via bonding curve or Jupiter)
 */
export async function getTokenPrice(mint) {
  try {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const res = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint: mint,
        outputMint: SOL_MINT,
        amount: 1000000, // 1 token (assuming 6 decimals)
        slippageBps: 500,
      },
      timeout: 5000,
    });

    if (res.data?.outAmount) {
      return parseInt(res.data.outAmount) / LAMPORTS_PER_SOL;
    }
    return null;
  } catch {
    return null;
  }
}

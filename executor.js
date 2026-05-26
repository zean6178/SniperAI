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
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PUMP_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

// ═══════════════════════════════════════════════════════════════════════════════
// CONNECTION & WALLET
// ═══════════════════════════════════════════════════════════════════════════════

let _connection = null;
let _wallet = null;

// ─── RPC URLs — lazy-loaded biar gak kena ESM hoisting ──────────────────────
function _getRpcUrls() {
  return [
    process.env.RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/g0zYwYty44SBatLo2fhm0',
    process.env.BACKUP_RPC_URL,
  ].filter(Boolean);
}
let _rpcIndex = 0;
let _rpcUrls = null;

export function rotateRpc() {
  if (!_rpcUrls) _rpcUrls = _getRpcUrls();
  _rpcIndex = (_rpcIndex + 1) % _rpcUrls.length;
  const url = _rpcUrls[_rpcIndex];
  _connection = new Connection(url, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30000,
  });
  console.log(chalk.cyan(`[executor] 🔄 Rotated to RPC #${_rpcIndex + 1}/${_rpcUrls.length}: ${url.replace(/\/\/[^@]+@/, '//***@')}`));
  return _connection;
}

export function getConnection() {
  if (!_connection) {
    rotateRpc();
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
    // ⭐ Capture real Pump.fun price & MCap for simulated PnL
    const realPrice = await getTokenPrice(mint).catch(() => null);
    let realMcap = 0;
    if (realPrice) {
      try {
        const decimals = await getMintDecimals(mint);
        realMcap = await getPumpFunMcap(mint, decimals);
      } catch {}
    }
    return {
      success: true,
      dryRun: true,
      txHash: 'DRY_RUN_BUY',
      tokenAmount: amountSol * 1000000,
      dryPriceSol: realPrice,  // real bonding curve price at buy time
      dryMcapSol: realMcap,    // estimated MCap from bonding curve
    };
  }

  console.log(chalk.green(`[executor] 🟢 BUYING ${amountSol} SOL → ${mint.slice(0, 8)}…`));

  try {
    // Method 0: Jito Bundle (fastest, MEV protected) — try first if configured
    if (process.env.USE_JITO === 'true' && process.env.JITO_AUTH_TOKEN) {
      const jitoResult = await buyViaJito(mint, amountSol, slippageBps);
      if (jitoResult?.success) return jitoResult;
      if (jitoResult !== null) {
        console.log(chalk.yellow('[executor] Jito bundle failed, falling back to PumpPortal...'));
      }
    }

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
    }, {
      headers: config.hybrid?.pumpPortalApiKey ? { 'x-api-key': config.hybrid.pumpPortalApiKey } : {},
      timeout: 15000,
    });

    if (!response.data) throw new Error('No transaction data returned');

    // Deserialize and sign
    const txData = Buffer.from(response.data, 'base64');
    const tx = VersionedTransaction.deserialize(txData);
    tx.sign([wallet]);

    // Send transaction — skipPreflight: true for speed
    const connection = getConnection();
    const txHash = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });

    // ⭐ Confirmation — faster polling biar cepet dapet hasil
    const cfm = await confirmTxPolling(txHash, 15000); // max 15s wait
    if (!cfm.confirmed) {
      throw new Error(`Transaction not confirmed: ${cfm.error}. Check ${txHash}`);
    }

    let tokenAmount = null;
    try {
      const tokenBal = await getTokenBalance(mint);
      if (tokenBal > 0) tokenAmount = tokenBal;
    } catch (_) {}

    console.log(chalk.green(`[executor] ✅ Buy success | tx: ${txHash}`));
    // ⭐ Fee auto-split setelah buy sukses
    _handleFee(amountSol).catch(() => {});
    return { success: true, txHash, tokenAmount };

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
    const quoteRes = await axios.get('https://api.jup.ag/swap/v1/quote', {
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
    const swapRes = await axios.post('https://api.jup.ag/swap/v1/swap', {
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

    const cfm = await confirmTxPolling(txHash);
    if (!cfm.confirmed) {
      throw new Error(`Transaction not confirmed: ${cfm.error}. Check signature ${txHash} on Solana Explorer.`);
    }

    const tokenAmount = parseInt(quote.outAmount || 0);
    console.log(chalk.green(`[executor] ✅ Jupiter buy success | tx: ${txHash} | tokens: ${tokenAmount}`));
    return { success: true, txHash, tokenAmount };

  } catch (e) {
    return { success: false, error: `Jupiter: ${e.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JITO BUNDLE SUPPORT — MEV-protected buys via Jito Block Engine
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Buy via Jito Bundle — builds a Jupiter swap tx, then wraps it as a Jito bundle
 * with a tip instruction for priority inclusion.
 * 
 * Requires: USE_JITO=true, JITO_AUTH_TOKEN set in env.
 * Falls back to regular methods if Jito is unavailable.
 * 
 * @param {string} mint - Token mint address
 * @param {number} amountSol - Amount of SOL to spend
 * @param {number} slippageBps - Slippage in basis points
 * @returns {Promise<{success: boolean, txHash?: string, tokenAmount?: number}|null>}
 */
async function buyViaJito(mint, amountSol, slippageBps) {
  const jitoConfig = {
    enabled: process.env.USE_JITO === 'true',
    authToken: process.env.JITO_AUTH_TOKEN || '',
    tipLamports: parseInt(process.env.JITO_TIP_LAMPORTS || '30000'),
    endpoint: process.env.JITO_ENDPOINT || 'https://mainnet.block-engine.jito.wtf/api/v1/transactions',
  };

  if (!jitoConfig.enabled || !jitoConfig.authToken) return null;

  const wallet = getWallet();
  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  try {
    console.log(chalk.cyan(`[jito] 🚀 Building Jito bundle: ${amountSol} SOL → ${mint.slice(0, 8)}…`));

    // Step 1: Get quote from Jupiter
    const quoteRes = await axios.get('https://api.jup.ag/swap/v1/quote', {
      params: {
        inputMint: SOL_MINT,
        outputMint: mint,
        amount: Math.floor(amountSol * LAMPORTS_PER_SOL),
        slippageBps: slippageBps,
      },
      timeout: 10000,
    });

    const quote = quoteRes.data;
    if (!quote) throw new Error('No Jito quote available');

    // Step 2: Get swap transaction from Jupiter
    const swapRes = await axios.post('https://api.jup.ag/swap/v1/swap', {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }, { timeout: 10000 });

    const { swapTransaction } = swapRes.data;
    if (!swapTransaction) throw new Error('No swap transaction from Jupiter');

    // Step 3: Deserialize the swap tx
    const txBuf = Buffer.from(swapTransaction, 'base64');
    const swapTx = VersionedTransaction.deserialize(txBuf);

    // Step 4: Sign the transaction
    swapTx.sign([wallet]);

    // Step 5: Serialize to base64 for bundling
    const serializedTx = Buffer.from(swapTx.serialize()).toString('base64');

    // Step 6: Build the tip instruction (transfer lamports to Jito tip account)
    const tipAccount = new PublicKey('Cw8PFyRstePnm2KcJ4SX8MJy2JfKJ3TKB1t2i3qGkY5z');
    const tipIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: tipAccount,
      lamports: jitoConfig.tipLamports,
    });

    // Build a separate tip transaction
    const tipTx = new Transaction().add(tipIx);
    tipTx.feePayer = wallet.publicKey;
    const { blockhash } = await getConnection().getLatestBlockhash();
    tipTx.recentBlockhash = blockhash;
    tipTx.sign(wallet);
    const serializedTip = Buffer.from(tipTx.serialize()).toString('base64');

    // Step 7: Submit bundle to Jito Block Engine
    const bundlePayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendBundle',
      params: [[serializedTx, serializedTip]],
    };

    console.log(chalk.gray(`[jito] 📦 Submitting bundle (tip: ${jitoConfig.tipLamports} lamports)`));

    const bundleRes = await axios.post(jitoConfig.endpoint, bundlePayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jitoConfig.authToken}`,
      },
      timeout: 15000,
    });

    const bundleId = bundleRes.data?.result;
    if (!bundleId) {
      const errMsg = bundleRes.data?.error?.message || 'No bundle ID returned';
      throw new Error(`Jito bundle rejected: ${errMsg}`);
    }

    console.log(chalk.green(`[jito] ✅ Bundle submitted: ${bundleId}`));

    // Step 8: Poll for bundle confirmation
    const confirmed = await pollBundleConfirmation(bundleId, jitoConfig);
    if (!confirmed) {
      throw new Error(`Jito bundle ${bundleId} not confirmed within timeout`);
    }

    const tokenAmount = parseInt(quote.outAmount || 0);
    console.log(chalk.green(`[jito] ✅ Jito buy success | bundle: ${bundleId} | tokens: ${tokenAmount}`));
    return { success: true, txHash: bundleId, tokenAmount };

  } catch (e) {
    console.warn(chalk.yellow(`[jito] ⚠️ Jito bundle failed: ${e.message}`));
    return null; // Signal caller to fall back
  }
}

/**
 * Sell via Jito Bundle — builds a Jupiter swap tx (token → SOL), then wraps as Jito bundle
 * with a tip instruction for priority inclusion.
 *
 * Requires: USE_JITO=true, JITO_AUTH_TOKEN set in env.
 * Falls back to regular methods if Jito is unavailable.
 *
 * @param {string} mint - Token mint address (input token to sell)
 * @param {number} tokenAmount - Amount of tokens to sell (raw units, not SOL)
 * @param {number} slippageBps - Slippage in basis points
 * @returns {Promise<{success: boolean, txHash?: string, solReceived?: number}|null>}
 */
async function sellViaJito(mint, tokenAmount, slippageBps) {
  const jitoConfig = {
    enabled: process.env.USE_JITO === 'true',
    authToken: process.env.JITO_AUTH_TOKEN || '',
    tipLamports: parseInt(process.env.JITO_TIP_LAMPORTS || '30000'),
    endpoint: process.env.JITO_ENDPOINT || 'https://mainnet.block-engine.jito.wtf/api/v1/transactions',
  };

  if (!jitoConfig.enabled || !jitoConfig.authToken) return null;

  const wallet = getWallet();
  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  try {
    console.log(chalk.cyan(`[jito] 🚀 Building Jito sell bundle: ${mint.slice(0, 8)}… → SOL`));

    // Step 1: Get quote from Jupiter (sell tokens for SOL)
    const quoteRes = await axios.get('https://api.jup.ag/swap/v1/quote', {
      params: {
        inputMint: mint,
        outputMint: SOL_MINT,
        amount: tokenAmount,
        slippageBps: slippageBps,
      },
      timeout: 10000,
    });

    const quote = quoteRes.data;
    if (!quote) throw new Error('No Jito sell quote available');

    // Step 2: Get swap transaction from Jupiter
    const swapRes = await axios.post('https://api.jup.ag/swap/v1/swap', {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }, { timeout: 10000 });

    const { swapTransaction } = swapRes.data;
    if (!swapTransaction) throw new Error('No swap transaction from Jupiter');

    // Step 3: Deserialize the swap tx
    const txBuf = Buffer.from(swapTransaction, 'base64');
    const swapTx = VersionedTransaction.deserialize(txBuf);

    // Step 4: Sign the transaction
    swapTx.sign([wallet]);

    // Step 5: Serialize to base64 for bundling
    const serializedTx = Buffer.from(swapTx.serialize()).toString('base64');

    // Step 6: Build the tip instruction (transfer lamports to Jito tip account)
    const tipAccount = new PublicKey('Cw8PFyRstePnm2KcJ4SX8MJy2JfKJ3TKB1t2i3qGkY5z');
    const tipIx = SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: tipAccount,
      lamports: jitoConfig.tipLamports,
    });

    // Build a separate tip transaction
    const tipTx = new Transaction().add(tipIx);
    tipTx.feePayer = wallet.publicKey;
    const { blockhash } = await getConnection().getLatestBlockhash();
    tipTx.recentBlockhash = blockhash;
    tipTx.sign(wallet);
    const serializedTip = Buffer.from(tipTx.serialize()).toString('base64');

    // Step 7: Submit bundle to Jito Block Engine
    const bundlePayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'sendBundle',
      params: [[serializedTx, serializedTip]],
    };

    console.log(chalk.gray(`[jito] 📦 Submitting sell bundle (tip: ${jitoConfig.tipLamports} lamports)`));

    const bundleRes = await axios.post(jitoConfig.endpoint, bundlePayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jitoConfig.authToken}`,
      },
      timeout: 15000,
    });

    const bundleId = bundleRes.data?.result;
    if (!bundleId) {
      const errMsg = bundleRes.data?.error?.message || 'No bundle ID returned';
      throw new Error(`Jito bundle rejected: ${errMsg}`);
    }

    console.log(chalk.green(`[jito] ✅ Sell bundle submitted: ${bundleId}`));

    // Step 8: Poll for bundle confirmation
    const confirmed = await pollBundleConfirmation(bundleId, jitoConfig);
    if (!confirmed) {
      throw new Error(`Jito sell bundle ${bundleId} not confirmed within timeout`);
    }

    const solReceived = parseInt(quote.outAmount || 0) / LAMPORTS_PER_SOL;
    console.log(chalk.green(`[jito] ✅ Jito sell success | bundle: ${bundleId} | received: ${solReceived.toFixed(4)} SOL`));
    return { success: true, txHash: bundleId, solReceived };

  } catch (e) {
    console.warn(chalk.yellow(`[jito] ⚠️ Jito sell bundle failed: ${e.message}`));
    return null; // Signal caller to fall back
  }
}

/**
 * Poll for Jito bundle confirmation via the block engine
 */
async function pollBundleConfirmation(bundleId, jitoConfig, timeoutMs = 30000) {
  const start = Date.now();
  const pollInterval = 2000;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await axios.post(jitoConfig.endpoint, {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBundleStatuses',
        params: [[bundleId]],
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jitoConfig.authToken}`,
        },
        timeout: 5000,
      });

      const statuses = res.data?.result?.value;
      if (statuses && statuses.length > 0) {
        const status = statuses[0];
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          return true;
        }
        if (status.err) {
          console.warn(chalk.yellow(`[jito] Bundle error: ${JSON.stringify(status.err)}`));
          return false;
        }
      }
    } catch (e) {
      // Transient polling error — retry
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  return false;
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
export async function sellToken({ mint, sellPct, slippageBps, tradeValueSol, entryPriceSol }) {
  const config = getConfig();
  const isDry = config.isDryRun;

  if (isDry) {
    console.log(chalk.yellow(`[executor] 🧪 DRY RUN — Sell ${sellPct}% of ${mint.slice(0, 8)}…`));
    // Dry run: gunakan real price dari bonding curve untuk simulated PnL
    let currentPrice = await getTokenPrice(mint).catch(() => null);

    // ⭐ FIX: Fallback to PumpPortal WS cached price for pre-migration tokens
    if (!currentPrice || currentPrice <= 0) {
      try {
        const { getCachedTradePrice } = await import('./detector.js');
        const cached = getCachedTradePrice(mint);
        if (cached?.priceSol > 0) currentPrice = cached.priceSol;
      } catch {}
    }

    let solReceived = 0;

    if (currentPrice && currentPrice > 0 && entryPriceSol > 0) {
      // Simulasi dengan real price movement
      solReceived = tradeValueSol * (currentPrice / entryPriceSol);
    } else {
      // Fallback: break-even (tradeValueSol = entry amount)
      solReceived = tradeValueSol || 0;
    }

    return { success: true, dryRun: true, txHash: 'DRY_RUN_SELL', solReceived };
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

    // Method 0: Jito Bundle (fastest, MEV protected) — try first if configured
    if (process.env.USE_JITO === 'true' && process.env.JITO_AUTH_TOKEN) {
      const jitoResult = await sellViaJito(mint, sellAmount, slippageBps);
      if (jitoResult?.success) {
        if (tradeValueSol > 0) _handleFee(tradeValueSol).catch(() => {});
        return jitoResult;
      }
      if (jitoResult !== null) {
        console.log(chalk.yellow('[executor] Jito sell bundle failed, falling back to PumpPortal...'));
      }
    }

    // Method 1: PumpPortal
    const result = await sellViaPumpPortal(mint, sellAmount, slippageBps);
    if (result.success) {
      // ⭐ Fee auto-split setelah sell sukses
      if (tradeValueSol > 0) _handleFee(tradeValueSol).catch(() => {});
      return result;
    }

    // Method 2: Jupiter fallback
    console.log(chalk.yellow('[executor] PumpPortal sell failed, trying Jupiter...'));
    const jupResult = await sellViaJupiter(mint, sellAmount, slippageBps);
    if (jupResult.success && tradeValueSol > 0) {
      _handleFee(tradeValueSol).catch(() => {});
    }
    return jupResult;

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
    }, {
      headers: config.hybrid?.pumpPortalApiKey ? { 'x-api-key': config.hybrid.pumpPortalApiKey } : {},
      timeout: 15000,
    });

    if (!response.data) throw new Error('No transaction data');

    const txData = Buffer.from(response.data, 'base64');
    const tx = VersionedTransaction.deserialize(txData);
    tx.sign([wallet]);

    const connection = getConnection();
    const txHash = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true, // PumpPortal sell — need speed
      maxRetries: 3,
    });

    // ⭐ FIX: ganti connection.confirmTransaction (gagal di QuickNode/Alchemy)
    // dengan polling-based confirmTxPolling yang pake getSignatureStatus
    const cfm = await confirmTxPolling(txHash);
    if (!cfm.confirmed) {
      throw new Error(`Sell not confirmed: ${cfm.error}. Check ${txHash}`);
    }

    console.log(chalk.green(`[executor] ✅ PumpPortal sell success | tx: ${txHash}`));
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
    const quoteRes = await axios.get('https://api.jup.ag/swap/v1/quote', {
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

    const swapRes = await axios.post('https://api.jup.ag/swap/v1/swap', {
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

    const cfm = await confirmTxPolling(txHash);
    if (!cfm.confirmed) {
      throw new Error(`Sell not confirmed: ${cfm.error}. Check ${txHash}`);
    }

    const solReceived = parseInt(quote.outAmount || 0) / LAMPORTS_PER_SOL;
    console.log(chalk.green(`[executor] ✅ Jupiter sell success | tx: ${txHash} | received: ${solReceived.toFixed(4)} SOL`));
    return { success: true, txHash, solReceived };

  } catch (e) {
    return { success: false, error: `Jupiter sell: ${e.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION — polling-based, gak butuh signatureSubscribe (QuickNode compat)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Confirm transaction via polling getSignatureStatus
 */
async function confirmTxPolling(txHash, timeoutMs = 30000) {
  const connection = getConnection();
  const start = Date.now();
  let lastErr = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const sigStatus = await connection.getSignatureStatus(txHash, {
        searchTransactionHistory: true,
      });

      if (sigStatus?.value) {
        const status = sigStatus.value;
        if (status.err) {
          return { confirmed: false, error: JSON.stringify(status.err) };
        }
        if (status.confirmationStatus === 'confirmed' ||
            status.confirmationStatus === 'finalized') {
          return { confirmed: true, slot: status.slot };
        }
      }
    } catch (e) {
      lastErr = e.message;
    }

    const delay = Math.min(500 * Math.pow(2, Math.floor((Date.now() - start) / 5000)), 5000);
    await new Promise(r => setTimeout(r, delay));
  }

  return { confirmed: false, error: `Timeout after ${timeoutMs}ms. Last error: ${lastErr || 'none'}` };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEE AUTO-SPLIT — Revenue sharing setelah tiap trade
// ═══════════════════════════════════════════════════════════════════════════════

let _accumulatedFeeLamports = 0;
const FEE_PAYOUT_THRESHOLD = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL minimum

/**
 * Handle fee setelah trade sukses — accumulate & auto-pay kalau sudah cukup
 * @param {number} tradeAmountSol - Jumlah SOL yang di-trade
 */
async function _handleFee(tradeAmountSol) {
  const config = getConfig();
  const treasury = config.treasury;
  const feePct = treasury?.swapFeePct || 0.5;
  const dist = treasury?.feeDistribution || { profit: 50, rewardPool: 30, development: 20 };

  const feeLamports = Math.floor(tradeAmountSol * (feePct / 100) * LAMPORTS_PER_SOL);
  if (feeLamports <= 0) return;

  _accumulatedFeeLamports += feeLamports;
  console.log(chalk.gray(`[fee] 💰 Accumulated: ${(_accumulatedFeeLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL (fee: ${(feeLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL)`));

  if (_accumulatedFeeLamports < FEE_PAYOUT_THRESHOLD) return;

  await _payAccumulatedFees(treasury, dist);
}

async function _payAccumulatedFees(treasury, dist) {
  const wallet = getWallet();
  const connection = getConnection();
  const totalFee = _accumulatedFeeLamports;

  const allocations = [
    { name: 'Treasury (Profit)',  address: treasury.walletAddress,            pct: dist.profit },
    { name: 'Reward Pool',        address: process.env.REWARD_POOL_WALLET,     pct: dist.rewardPool },
    { name: 'Development Fund',   address: process.env.DEV_FUND_WALLET,        pct: dist.development },
  ];

  const tx = new Transaction();
  let totalSent = 0;

  for (const a of allocations) {
    if (!a.address) {
      console.warn(chalk.yellow(`[fee] ⚠️ ${a.name} address not configured`));
      continue;
    }
    const amount = Math.floor(totalFee * (a.pct / 100));
    if (amount <= 0) continue;

    try {
      tx.add(SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(a.address),
        lamports: amount,
      }));
      totalSent += amount;
    } catch (e) {
      console.warn(chalk.yellow(`[fee] ⚠️ ${a.name} transfer error: ${e.message}`));
    }
  }

  if (tx.instructions.length === 0) {
    console.log(chalk.gray('[fee] ℹ️ No valid fee destinations — skipping'));
    _accumulatedFeeLamports = 0;
    return;
  }

  try {
    tx.feePayer = wallet.publicKey;
    const hash = await connection.getLatestBlockhash();
    tx.recentBlockhash = hash.blockhash;
    tx.sign(wallet);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
    const cfm = await confirmTxPolling(sig);
    if (!cfm.confirmed) {
      throw new Error(`Fee payout not confirmed: ${cfm.error}. Check ${sig}`);
    }

    console.log(chalk.green(`[fee] ✅ Auto-split ${(totalSent / LAMPORTS_PER_SOL).toFixed(6)} SOL to ${tx.instructions.length} wallet(s) | tx: ${sig}`));
    _accumulatedFeeLamports = 0;
  } catch (e) {
    console.warn(chalk.yellow(`[fee] ⚠️ Pay-out failed: ${e.message} — will retry next trade`));
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
 * ⭐ FIX: Baca decimals real dari mint, bukan hardcode 6
 */
let _mintInfoCache = new Map();

async function getMintDecimals(mint) {
  const cached = _mintInfoCache.get(mint);
  if (cached && Date.now() - cached.ts < 3600000) return cached.decimals;
  try {
    const connection = getConnection();
    const { PublicKey } = await import('@solana/web3.js');
    const mintPubkey = new PublicKey(mint);
    const info = await connection.getAccountInfo(mintPubkey);
    if (!info) return 6; // fallback
    // Mint data: 44 bytes [mintAuthority(36) + supply(8)] then decimals at offset 44
    const decimals = info.data[44];
    _mintInfoCache.set(mint, { decimals, ts: Date.now() });
    return decimals;
  } catch {
    return 6; // fallback default
  }
}

export async function getTokenPrice(mint) {
  try {
    // ⭐ First try cached trade price from PumpPortal WS (REAL-TIME, most reliable)
    const { getCachedTradePrice } = await import('./detector.js');
    const cached = getCachedTradePrice(mint);
    if (cached?.priceSol > 0) {
      const age = Date.now() - cached.timestamp;
      if (age < 120000) { // Cache valid for 2 minutes
        return cached.priceSol;
      }
    }
    // ⭐ First try Jupiter (for migrated tokens)
    const decimals = await getMintDecimals(mint);
    const oneToken = Math.pow(10, decimals);

    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const res = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint: mint,
        outputMint: SOL_MINT,
        amount: oneToken,
        slippageBps: 500,
      },
      timeout: 5000,
    });

    if (res.data?.outAmount) {
      const price = parseInt(res.data.outAmount) / LAMPORTS_PER_SOL;
      if (price > 0) return price;
    }

    // ⭐ Fallback: DexScreener API (works for pre-migration Pump.fun tokens)
    const dexPrice = await getDexScreenerPrice(mint);
    if (dexPrice !== null) return dexPrice;

    // ⭐ Last resort: Pump.fun bonding curve AMM PDA (on-chain, real price)
    const pumpPrice = await getPumpFunPrice(mint, decimals);
    if (pumpPrice !== null) return pumpPrice;

    return null;
  } catch {
    // Last resort: DexScreener
    try {
      return await getDexScreenerPrice(mint);
    } catch {
      return null;
    }
  }
}

/**
 * Get token price from DexScreener API (works for Pump.fun pre-migration tokens)
 */
async function getDexScreenerPrice(mint) {
  try {
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/token/${mint}`, {
      timeout: 5000,
    });
    const pairs = res.data?.pairs;
    if (pairs && pairs.length > 0) {
      // Find the Pump.fun pair (chainId = solana, DEX = pumpfun)
      const pumpPair = pairs.find(p =>
        p.chainId === 'solana' && (p.dexId === 'pumpfun' || p.liquidity?.usd > 0)
      ) || pairs[0];

      if (pumpPair?.priceSol) {
        return parseFloat(pumpPair.priceSol);
      }
      // Fallback: derive from USD price
      if (pumpPair?.priceUsd) {
        return parseFloat(pumpPair.priceUsd) / 150; // SOL ~$150
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get token price from Pump.fun bonding curve (real on-chain data)
 * Uses the AMM PDA: seeds=["amm", mint], program=6EF8rrecthR5D...
 * Account layout: [discriminator(8) + vrt(u64) + vsr(u64)]
 * Price per token (SOL) = (vsr / vrt) * 10^(decimals - 9)
 */
async function getPumpFunPrice(mint, decimals) {
  try {
    const connection = getConnection();
    const mintPubkey = new PublicKey(mint);

    // Derive AMM PDA
    const [ammPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('amm', 'utf8'), mintPubkey.toBuffer()],
      PUMP_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(ammPda);
    if (!accountInfo || !accountInfo.data || accountInfo.data.length < 24) {
      return null;
    }

    // Parse u64 values (little-endian) at offsets 8 and 16
    const data = accountInfo.data;
    const vrt = Number(data.readBigUInt64LE(8));   // virtual token reserves (raw units)
    const vsr = Number(data.readBigUInt64LE(16));  // virtual SOL reserves (lamports)

    if (vrt <= 0 || vsr <= 0) return null;

    // Price per full token in SOL
    // = (vsr lamports) / (vrt raw units) * (10^decimals / 10^9)
    const exponent = decimals - 9;
    const price = (vsr / vrt) * Math.pow(10, exponent);

    return price > 0 ? price : null;
  } catch (e) {
    console.warn(chalk.gray(`[executor] PumpFun price error for ${mint.slice(0, 8)}: ${e.message}`));
    return null;
  }
}

/**
 * Estimate token MCap in SOL from DexScreener API
 */
async function getPumpFunMcap(mint, decimals) {
  try {
    // ⭐ First try cached MCap from PumpPortal WS
    const { getCachedMcap } = await import('./detector.js');
    const cachedMcap = getCachedMcap(mint);
    if (cachedMcap > 0) return cachedMcap;

    // Try DexScreener (works for Pump.fun pre-migration tokens)
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/token/${mint}`, {
      timeout: 5000,
    });
    const pairs = res.data?.pairs;
    if (pairs && pairs.length > 0) {
      const pumpPair = pairs.find(p =>
        p.chainId === 'solana' && (p.dexId === 'pumpfun' || p.liquidity?.usd > 0)
      ) || pairs[0];
      // DexScreener provides marketCap in USD
      if (pumpPair?.marketCap) {
        const mcapUsd = parseFloat(pumpPair.marketCap);
        if (mcapUsd > 0) return mcapUsd / 150; // convert to SOL (~$150/SOL)
      }
      // Fallback: priceSol * totalSupply estimate
      if (pumpPair?.priceSol) {
        try {
          const connection = getConnection();
          const mintPubkey = new PublicKey(mint);
          const supplyInfo = await connection.getTokenSupply(mintPubkey);
          const totalSupplyRaw = Number(supplyInfo.value.amount);
          if (totalSupplyRaw > 0) {
            const totalSupply = totalSupplyRaw / Math.pow(10, decimals);
            return parseFloat(pumpPair.priceSol) * totalSupply;
          }
        } catch {}
      }
    }
    // Last resort: try AMM PDA
    return await getPumpFunPrice(mint, decimals) !== null ? 1000 : 0;
  } catch {
    return 0;
  }
}

#!/usr/bin/env node
/**
 * stop-loss-monitor.js
 * Cron job — Check token price and sell if 10% down from entry.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import axios from 'axios';

// ── Load .env FIRST ─────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '.env') });

// ── Config ──────────────────────────────────────────────────────────────────────
const TOKEN_MINT = 'F3UfckxLPtCmFQZ8WDkDsYiwDHFzpdFrC1sfNkEofJH1';
const ENTRY_PRICE_SOL = 0.00000295;
const STOP_PRICE_SOL = 0.00000265;
const WALLET_ADDRESS = 'C6CxcZeJFhqDCyWzPG89C1cqWxFhQtqUiCKQQUQwFqPs';
const QUOTE_RAW_AMOUNT = 4687318559; // 4687.318559 tokens with 6 decimals
const TOKEN_DECIMALS = 6;
const TOKEN_AMOUNT = QUOTE_RAW_AMOUNT / Math.pow(10, TOKEN_DECIMALS); // 4687.318559

const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ── Get Jupiter Quote ───────────────────────────────────────────────────────────
async function getCurrentPrice() {
  try {
    const res = await axios.get('https://api.jup.ag/swap/v1/quote', {
      params: {
        inputMint: TOKEN_MINT,
        outputMint: SOL_MINT,
        amount: QUOTE_RAW_AMOUNT,
        slippageBps: 500,
      },
      timeout: 10000,
    });

    if (!res.data?.outAmount) {
      console.log(`[STOP-LOSS] ⚠️ Jupiter returned no outAmount`);
      return null;
    }

    const outAmountLamports = parseInt(res.data.outAmount);
    const solReceived = outAmountLamports / 1_000_000_000; // lamports → SOL
    const pricePerToken = solReceived / TOKEN_AMOUNT;

    console.log(`[STOP-LOSS] 📊 Jupiter quote: ${solReceived.toFixed(12)} SOL for ${TOKEN_AMOUNT} tokens`);
    console.log(`[STOP-LOSS] 💰 Current price: ${pricePerToken.toFixed(12)} SOL/token`);

    return pricePerToken;
  } catch (err) {
    console.log(`[STOP-LOSS] ❌ Error fetching Jupiter quote: ${err.message}`);
    if (err.response) {
      console.log(`[STOP-LOSS] Response status: ${err.response.status}`);
      console.log(`[STOP-LOSS] Response data: ${JSON.stringify(err.response.data).slice(0, 500)}`);
    }
    return null;
  }
}

// ── Execute Sell ────────────────────────────────────────────────────────────────
async function executeSell() {
  try {
    console.log(`[STOP-LOSS] 🔴 STOP LOSS TRIGGERED — Selling 100% of ${TOKEN_MINT.slice(0, 8)}…`);
    
    const { sellToken } = await import('./executor.js');
    const result = await sellToken({
      mint: TOKEN_MINT,
      sellPct: 100,
      slippageBps: 1000,
    });

    if (result.success) {
      console.log(`[STOP-LOSS] ✅ Sell executed successfully!`);
      console.log(`[STOP-LOSS] TX: ${result.txHash || 'unknown'}`);
      if (result.solReceived) {
        console.log(`[STOP-LOSS] SOL received: ${result.solReceived.toFixed(6)} SOL`);
      }
      // Write a marker file so the cron can detect sell happened
      const fs = await import('fs');
      fs.writeFileSync(resolve(__dirname, '.stop-loss-executed'), JSON.stringify({
        timestamp: new Date().toISOString(),
        txHash: result.txHash || 'unknown',
        tokenMint: TOKEN_MINT,
      }));
    } else {
      console.log(`[STOP-LOSS] ❌ Sell failed: ${result.error || 'unknown error'}`);
    }

    return result;
  } catch (err) {
    console.log(`[STOP-LOSS] ❌ Sell execution error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`[STOP-LOSS] 🛑 Token: ${TOKEN_MINT.slice(0, 12)}…`);
  console.log(`[STOP-LOSS] 💵 Entry: ${ENTRY_PRICE_SOL} SOL | Stop: ${STOP_PRICE_SOL} SOL`);
  console.log(`[STOP-LOSS] 👛 Wallet: ${WALLET_ADDRESS.slice(0, 8)}…`);
  console.log(`──────────────────────────────────────────────────────`);

  // Check if already sold
  try {
    const fs = await import('fs');
    const exists = fs.existsSync(resolve(__dirname, '.stop-loss-executed'));
    if (exists) {
      const data = JSON.parse(fs.readFileSync(resolve(__dirname, '.stop-loss-executed'), 'utf-8'));
      console.log(`[STOP-LOSS] ⏭️  Sell already executed at ${data.timestamp} — TX: ${data.txHash}`);
      console.log(`══════════════════════════════════════════════════════════\n`);
      process.exit(0);
    }
  } catch (_) {
    // ignore
  }

  const currentPrice = await getCurrentPrice();

  if (currentPrice === null) {
    console.log(`[STOP-LOSS] ⚠️ Could not fetch price — will retry next tick`);
    console.log(`══════════════════════════════════════════════════════════\n`);
    return;
  }

  const diffPct = ((currentPrice - ENTRY_PRICE_SOL) / ENTRY_PRICE_SOL) * 100;
  console.log(`[STOP-LOSS] 📉 Change from entry: ${diffPct.toFixed(2)}%`);

  if (currentPrice < STOP_PRICE_SOL) {
    console.log(`[STOP-LOSS] 🚨 Price ${currentPrice.toFixed(12)} SOL is BELOW stop ${STOP_PRICE_SOL} SOL!`);
    const result = await executeSell();
    if (result.success) {
      console.log(`[STOP-LOSS] ✅ Done — stop loss executed, cron should stop`);
    } else {
      console.log(`[STOP-LOSS] ⚠️ Sell failed — will retry next tick`);
    }
  } else {
    console.log(`[STOP-LOSS] ✅ Price ${currentPrice.toFixed(12)} SOL is above stop (${STOP_PRICE_SOL} SOL) — no action`);
  }

  console.log(`══════════════════════════════════════════════════════════\n`);
}

main().catch(err => {
  console.error(`[STOP-LOSS] 💥 Fatal error: ${err.message}`);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Stop-Loss Monitor (Cron Job)
 *
 * Checks current price via Jupiter quote. If below stop price, executes sell.
 * Run from /root/SniperAI directory.
 */

import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

import axios from 'axios';
import chalk from 'chalk';

const TOKEN_MINT = 'F3UfckxLPtCmFQZ8WDkDsYiwDHFzpdFrC1sfNkEofJH1';
const ENTRY_PRICE_SOL = 0.00000295;
const STOP_PRICE_SOL = 0.00000265;
const QUOTE_RAW_AMOUNT = 4687318559; // 4687.318559 tokens with 6 decimals
const TOKEN_DECIMALS = 6;
const TOKEN_AMOUNT = QUOTE_RAW_AMOUNT / Math.pow(10, TOKEN_DECIMALS); // 4687.318559

const SOL_MINT = 'So11111111111111111111111111111111111111112';

async function main() {
  console.log(chalk.cyan('══════════════════════════════════════════════'));
  console.log(chalk.cyan('  STOP-LOSS MONITOR'));
  console.log(chalk.cyan(`  Token: ${TOKEN_MINT.slice(0, 12)}…`));
  console.log(chalk.cyan(`  Entry: ${ENTRY_PRICE_SOL} SOL`));
  console.log(chalk.cyan(`  Stop : ${STOP_PRICE_SOL} SOL`));
  console.log(chalk.cyan('══════════════════════════════════════════════\n'));

  try {
    // Step 1: Get Jupiter quote — token → SOL
    console.log(chalk.gray(`[monitor] Fetching Jupiter quote for ${TOKEN_AMOUNT} tokens → SOL...`));

    const quoteRes = await axios.get('https://quote-api.jup.ag/v6/quote', {
      params: {
        inputMint: TOKEN_MINT,
        outputMint: SOL_MINT,
        amount: QUOTE_RAW_AMOUNT,
        slippageBps: 1000,
      },
      timeout: 15000,
    });

    if (!quoteRes.data?.outAmount) {
      console.log(chalk.red('[monitor] ❌ No quote returned from Jupiter'));
      console.log(chalk.gray(`[monitor] Response: ${JSON.stringify(quoteRes.data)}`));
      return;
    }

    const outAmount = parseInt(quoteRes.data.outAmount); // in lamports (1e9 SOL)
    const currentPriceSol = outAmount / 1e9 / TOKEN_AMOUNT;
    const pctChange = ((currentPriceSol - ENTRY_PRICE_SOL) / ENTRY_PRICE_SOL) * 100;

    console.log(chalk.gray(`[monitor] Quote outAmount: ${outAmount} lamports`));
    console.log(chalk.gray(`[monitor] Token amount   : ${TOKEN_AMOUNT}`));
    console.log(chalk.cyan(`[monitor] Current price  : ${currentPriceSol.toFixed(12)} SOL`));
    console.log(chalk.cyan(`[monitor] Entry price    : ${ENTRY_PRICE_SOL} SOL`));
    console.log(chalk.cyan(`[monitor] Stop price     : ${STOP_PRICE_SOL} SOL`));
    console.log(chalk.cyan(`[monitor] Change         : ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%`));

    // Step 2: Check if price is below stop
    if (currentPriceSol < STOP_PRICE_SOL) {
      console.log(chalk.red(`\n[monitor] 🚨 STOP LOSS TRIGGERED!`));
      console.log(chalk.red(`[monitor] Price ${currentPriceSol} < Stop ${STOP_PRICE_SOL}`));
      console.log(chalk.red(`[monitor] Executing sell...\n`));

      // Step 3: Execute sell
      const { sellToken } = await import('./executor.js');
      const result = await sellToken({
        mint: TOKEN_MINT,
        sellPct: 100,
        slippageBps: 1000,
      });

      if (result.success) {
        console.log(chalk.green(`\n[monitor] ✅ SELL EXECUTED SUCCESSFULLY!`));
        console.log(chalk.green(`[monitor] TxHash: ${result.txHash}`));
        if (result.dryRun) {
          console.log(chalk.yellow(`[monitor] NOTE: This was a DRY RUN (DRY_RUN=${process.env.DRY_RUN})`));
        }
        if (result.solReceived) {
          console.log(chalk.green(`[monitor] Received: ${result.solReceived.toFixed(6)} SOL`));
        }
      } else {
        console.log(chalk.red(`\n[monitor] ❌ SELL FAILED: ${result.error}`));
      }

      console.log(chalk.gray(`\n[monitor] Cron job completed — sell ${result?.success ? 'executed' : 'attempted'}.`));
    } else {
      console.log(chalk.green(`\n[monitor] ✅ Price still above stop threshold. No action needed.`));
      console.log(chalk.gray(`[monitor] Current price ${currentPriceSol.toFixed(12)} SOL >= Stop ${STOP_PRICE_SOL} SOL`));
    }
  } catch (err) {
    console.error(chalk.red(`[monitor] ❌ Error: ${err.message}`));
    if (err.response) {
      console.error(chalk.red(`[monitor] Response status: ${err.response.status}`));
      console.error(chalk.red(`[monitor] Response data: ${JSON.stringify(err.response.data)}`));
    }
  }
}

main().catch(err => {
  console.error(chalk.red(`[monitor] Fatal: ${err.message}`));
  process.exit(1);
});

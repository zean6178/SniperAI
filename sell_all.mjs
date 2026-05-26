/**
 * Sell all tokens in wallet
 * Dipanggil manual buat jual token dari buy sebelumnya yang gagal ke-track
 */
import { sellToken, getBalance } from './executor.js';
import { getConfig } from './config.js';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const TOKENS = [
  '4kPp9FjfVTtp46EmMzpfa357xgCzbQNPR3MFPFF5pump',
  '7sGdNQSvUGpahh6qyXB3g5gsdK9FAzZM299KyCXspump',
];

async function sellAll() {
  const config = getConfig();
  
  // Set dry run temporarily based on config
  console.log(chalk.cyan(`[sell] 🔄 LIVE SELL — Dry run: ${config.isDryRun}`));
  
  // Dapatkan balance dulu
  const bal = await getBalance();
  console.log(chalk.cyan(`[sell] 💰 Wallet: ${bal.address} | Balance: ${bal.solBalance.toFixed(6)} SOL\n`));

  for (const mint of TOKENS) {
    console.log(chalk.yellow(`\n[sell] 📦 Selling ${mint.slice(0, 8)}…`));
    
    const result = await sellToken({
      mint,
      sellPct: 100,  // Jual semua
      slippageBps: config.entry.slippageBps || 1000,
      // tradeValueSol not needed for sell — just sell everything
    });

    if (result.success) {
      console.log(chalk.green(`[sell] ✅ Sold! ${result.dryRun ? '(DRY RUN)' : `tx: ${result.txHash}`}`));
    } else {
      console.log(chalk.red(`[sell] ❌ Failed: ${result.error || 'Unknown'}`));
    }
  }

  // Final balance
  try {
    const finalBal = await getBalance();
    console.log(chalk.cyan(`\n[sell] 💰 Final balance: ${finalBal.solBalance.toFixed(6)} SOL`));
  } catch (_) {}
}

sellAll().catch(e => console.error(chalk.red(`[sell] 💥 Fatal: ${e.message}`)));

/**
 * Stuck Token Monitor — lightweight, cek Jupiter quote dulu (no tx)
 * Cek tiap 30 menit, auto-sell kalo bonding curve keisi lagi.
 */
import('dotenv/config');
import('./executor.js').then(async m => {
  const MINTS = [
    { mint: '8TqUi8LKJVuD8M4A1SVGf8o5AqqAcqPzYBuoxR6SitpC', label: 'HODL' },
    { mint: '589FDrxhp27UrsANrnX2pe8K6iXu7n3zFnrKNMoMFFj5', label: '589' },
  ];
  const results = [];

  for (const { mint, label } of MINTS) {
    try {
      const bal = await m.getTokenBalance(mint);
      if (!bal || bal <= 0) {
        results.push(`• ${label}: ✅ no tokens left`);
        continue;
      }
      results.push(`• ${label}: ${(bal/1e9).toFixed(1)}B tokens remaining`);

      // Lightweight check via Jupiter quote
      const quoteRes = await fetch(
        `https://api.jup.ag/swap/v1/quote?inputMint=${mint}&outputMint=So11111111111111111111111111111111111111112&amount=1&slippageBps=2500`,
        { signal: AbortSignal.timeout(8000) }
      );
      const quote = await quoteRes.json();

      if (quote.error || !quote.outAmount) {
        const errMsg = quote.error || 'no route';
        if (errMsg.includes('No route') || errMsg.includes('0x1788')) {
          results.push(`  ⏳ still stuck (bonding curve dry / no pool)`);
        } else {
          results.push(`  ❌ ${errMsg.slice(0, 60)}`);
        }
        continue;
      }

      // Quote works! There's liquidity now — sell!
      console.log(`[monitor] 🚀 ${label} has liquidity! Selling all…`);
      const sellResult = await m.sellToken({
        mint,
        sellPct: 100,
        slippageBps: 2500,
        tradeValueSol: 0.012,
      });

      if (sellResult.success) {
        results.push(`  ✅ SOLD! SOL received: ~${sellResult.solReceived || 'check wallet'}`);
      } else {
        results.push(`  ❌ sell failed: ${(sellResult.error || '').slice(0, 60)}`);
      }
    } catch (e) {
      results.push(`• ${label}: ⚠️ ${e.message?.slice(0, 60) || e}`);
    }
  }

  console.log('\n=== STUCK TOKEN MONITOR ===');
  results.forEach(r => console.log(r));
  console.log('============================');

  try {
    const sol = await m.getBalance();
    console.log(`Wallet: ${sol.solBalance.toFixed(4)} SOL (${sol.address.slice(0,12)}…)`);
  } catch (_) {}

  process.exit(0);
}).catch(e => { console.error('Fatal:', e.message); process.exit(1); });

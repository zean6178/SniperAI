// Sell remaining tokens in small batches
import('dotenv').then(d => d.default.config());
import('./executor.js').then(async m => {
  const mint = '8TqUi8LKJVuD8M4A1SVGf8o5AqqAcqPzYBuoxR6SitpC';
  const bal = await m.getTokenBalance(mint);
  console.log(`Sisa token: ${bal}`);

  if (bal <= 0) {
    console.log('✅ Gak ada sisa token.');
    process.exit(0);
  }

  // Try selling in increasing percentages
  const pcts = [0.5, 1, 2, 5, 10, 25, 50, 100];
  for (const pct of pcts) {
    console.log(`\n🔄 Coba sell ${pct}%...`);
    try {
      const result = await m.sellToken({
        mint,
        sellPct: pct,
        slippageBps: 1500,
        tradeValueSol: 0,
      });
      console.log(`✅ Sell ${pct}% berhasil:`, JSON.stringify(result));
    } catch (e) {
      console.log(`❌ Sell ${pct}% gagal: ${e.message}`);
      if (e.message.includes('0x1788') || e.message.includes('Overflow') || e.message.includes('insufficient')) {
        console.log('   → Bonding curve kering, skip sisa');
        break;
      }
    }
  }

  // Check final balance
  const finalBal = await m.getTokenBalance(mint);
  console.log(`\n📊 Final balance: ${finalBal} token`);
  if (finalBal > 0) {
    console.log('⚠️ Masih ada sisa token yang gak bisa dijual (bonding curve kering)');
  } else {
    console.log('✅ Semua token berhasil dijual!');
  }
  process.exit(0);
}).catch(e => {
  console.error('Fatal:', e.message, e.stack);
  process.exit(1);
});

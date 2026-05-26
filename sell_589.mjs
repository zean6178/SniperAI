import('dotenv/config');
import('./executor.js').then(async m => {
  const mint = '589FDrxhp27UrsANrnX2pe8K6iXu7n3zFnrKNMoMFFj5';
  const bal = await m.getTokenBalance(mint);
  console.log('Balance:', bal);

  if (!bal || bal <= 0) {
    console.log('No tokens');
    process.exit(0);
  }

  console.log('\nSelling 100% via PumpPortal...');
  const result = await m.sellToken({
    mint,
    sellPct: 100,
    slippageBps: 2500,
    tradeValueSol: 0.012,
  });
  console.log('Result:', JSON.stringify(result, null, 2));

  const finalBal = await m.getTokenBalance(mint);
  const sol = await m.getBalance();
  console.log('\nFinal token balance:', finalBal);
  console.log('Wallet SOL:', sol.solBalance);
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });

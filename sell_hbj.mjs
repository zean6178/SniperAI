// Sell all HBj5LB6e
import('dotenv/config');
import('./executor.js').then(async m => {
  const mint = 'HBj5LB6e242giHMrgdY5uF1ZHgbbm9F3oGHDrr4Hpump';
  const bal = await m.getTokenBalance(mint);
  console.log('Balance:', bal);

  if (!bal || bal <= 0) {
    console.log('No tokens to sell');
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
  console.log('\nFinal balance:', finalBal);
  process.exit(0);
}).catch(e => { console.error(e.message, e.stack); process.exit(1); });

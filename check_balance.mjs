import('dotenv/config');
import('./executor.js').then(async m => {
  const bal = await m.getTokenBalance('8TqUi8LKJVuD8M4A1SVGf8o5AqqAcqPzYBuoxR6SitpC');
  console.log('HODL sisa:', bal || 0);
  const sol = await m.getBalance();
  console.log('Wallet SOL:', sol.solBalance);
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });

/**
 * telegram-ui.js
 * Rich UI Builder — Inline Keyboard untuk SniperAI
 * 
 * Builds interactive Telegram messages dengan:
 * - Token info (name, mint, score, MC)
 * - External links (Pump, Scan — inline buttons)
 * - Buy buttons (3-3-3 layout: 3 top, 3 mid, 3 bottom)
 * - Action buttons (Monitor, Skip, Close)
 * - Sell buttons for active positions
 */

const BUY_AMOUNTS = [0.012, 0.1, 0.25, 0.5, 0.75];

/**
 * Build snipe alert message (the text part)
 */
export function buildSnipeAlertText(tokenData, screenResult) {
  const mint = tokenData.mint || '';
  const symbol = tokenData.symbol || '???';
  const name = tokenData.name || symbol;
  const score = screenResult?.score ?? tokenData._mergerScore ?? 0;
  const mcap = tokenData.marketCapSol || 0;
  const dev = tokenData.deployer || '';
  const reasons = screenResult?.reasons || [];
  const shortMint = mint.slice(0, 8);

  return (
    `📣 *SNIPE OPPORTUNITY* 🎯\n\n` +
    `*${symbol}* | ${name}\n` +
    `\`${shortMint}…\`\n\n` +
    `🎯 *Score:* ${score}/100\n` +
    `📊 *MCap:* $${(mcap * 150).toLocaleString()}\n` +
    `👤 *Dev:* \`${dev ? dev.slice(0, 12) + '…' : 'N/A'}\`\n\n` +
    `📋 *Alasan:*\n${reasons.slice(0, 3).map(r => `• ${r.replace(/\*/g, '')}`).join('\n')}\n\n` +
    `⏱️ ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB` +
    `${tokenData._mergerStrategy ? ` | Src: ${tokenData._mergerStrategy}` : ''}`
  );
}

/**
 * Build inline keyboard untuk snipe alert
 * Layout: 3-3-3
 * Row 1: Buy amounts (0.012, 0.1, 0.25)
 * Row 2: Buy amounts (0.5, 0.75, ✏️ Custom)
 * Row 3: Actions (📺 Monitor, ⏭️ Skip, ❌ Close)
 * Row 4: Links (💊 Pump, 🔍 Scan) — optional, inline buttons
 */
export function buildSnipeKeyboard(mint, score) {
  const callbackPrefix = `snipe:${mint}`;

  // Row 1: 3 buy amounts (small)
  const row1 = BUY_AMOUNTS.slice(0, 3).map(amt => ({
    text: `🟢 ${amt}`,
    callback_data: `${callbackPrefix}:buy:${amt}`,
  }));

  // Row 2: 2 buy amounts (large) + custom
  const row2 = BUY_AMOUNTS.slice(3).map(amt => ({
    text: `🟢 ${amt}`,
    callback_data: `${callbackPrefix}:buy:${amt}`,
  }));
  row2.push({
    text: '✏️ X/%',
    callback_data: `${callbackPrefix}:custom`,
  });

  // Row 3: Action buttons
  const row3 = [
    { text: '📺 Monitor', callback_data: `${callbackPrefix}:monitor` },
    { text: '⏭️ Skip',   callback_data: `${callbackPrefix}:skip` },
    { text: '❌ Close',  callback_data: `${callbackPrefix}:close` },
  ];

  // Row 4: Link buttons (clean, inline)
  const row4 = [
    { text: '💊 Pump',  url: `https://pump.fun/${mint}` },
    { text: '🔍 Scan',  url: `https://solscan.io/token/${mint}` },
    { text: '📊 DexS',  url: `https://dexscreener.com/solana/${mint}` },
  ];

  return {
    inline_keyboard: [row1, row2, row3, row4],
  };
}

/**
 * Parse callback data dari button click
 * Returns: { action, mint, value }
 */
export function parseCallbackData(callbackData) {
  if (!callbackData || !callbackData.startsWith('snipe:')) return null;

  const parts = callbackData.split(':');
  // Format: snipe:<mint>:<action>[:<value>]
  if (parts.length < 3) return null;

  return {
    mint: parts[1],
    action: parts[2],
    value: parts.length > 3 ? parts[3] : null,
  };
}

/**
 * Build confirmation message after buy execution
 */
export function buildBuyResultText(symbol, amountSol, txHash, isDry) {
  if (!txHash || txHash === 'DRY_RUN_BUY') {
    return (
      `✅ *BUY EXECUTED (Dry Run)*\n\n` +
      `Token: *${symbol}*\n` +
      `Amount: *${amountSol} SOL*\n` +
      `_No real transaction (dry run mode)_`
    );
  }
  return (
    `✅ *SNIPED!*\n\n` +
    `Token: *${symbol}*\n` +
    `Amount: *${amountSol} SOL*\n` +
    `Tx: \`${txHash}\`\n\n` +
    `_Monitoring started — TP/SL active_`
  );
}

/**
 * Build error message
 */
export function buildErrorText(symbol, error) {
  return `❌ *Buy Failed*\nToken: ${symbol}\nError: ${error}`;
}

/**
 * Format MCap SOL → USD string (contoh: 28.15 SOL → "$4.2K", 460 SOL → "$69K")
 * @param {number} mcapSol - Market cap in SOL
 * @param {number} solPrice - SOL/USD price (default: 150)
 */
export function formatMcapUsd(mcapSol, solPrice = 150) {
  if (!mcapSol || mcapSol <= 0) return 'N/A';
  const usd = mcapSol * solPrice;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

/**
 * Build position status text — buat monitor updates
 */
export function buildPositionStatusText(symbol, mint, entry, currentMultiple, pnlPct, pnlSol, duration, entryMcapSol = 0, peakMcapSol = 0, currentMcapSol = 0) {
  const emoji = pnlSol >= 0 ? '🟢' : '🔴';
  const currentMcapText = entryMcapSol > 0
    ? formatMcapUsd(currentMcapSol || (entryMcapSol * currentMultiple))
    : 'N/A';
  const mcapLine = entryMcapSol > 0
    ? `Entry: ${formatMcapUsd(entryMcapSol)} → Current: ${currentMcapText}${peakMcapSol > entryMcapSol ? ` · High: ${formatMcapUsd(peakMcapSol)}` : ''}\n`
    : '';
  return (
    `${emoji} *Position Update*\n\n` +
    `*${symbol}* | \`${mint.slice(0, 8)}…\`\n` +
    `Size: *${entry} SOL* · PnL: *${pnlPct.toFixed(1)}%* (${pnlSol >= 0 ? '+' : ''}${pnlSol.toFixed(4)} SOL)\n` +
    `${mcapLine}` +
    `Multiple: *${currentMultiple.toFixed(2)}x* · Duration: ${duration || 'N/A'}\n\n` +
    `_Actions below:_`
  );
}

/**
 * Build inline keyboard for position sell
 * Row 1: 25% | 50% | 75% | 100%
 * Row 2: 🔄 Refresh
 * Row 3: 🔗 Pump | Scan | DexS
 */
export function buildSellKeyboard(mint) {
  const prefix = `snipe:${mint}`;
  return {
    inline_keyboard: [
      [
        { text: '🔴 CLOSE', callback_data: `${prefix}:sell:100` },
        { text: '🔴 50%',   callback_data: `${prefix}:sell:50` },
        { text: '🔴 75%',   callback_data: `${prefix}:sell:75` },
      ],
      [
        { text: '📊 PNL',     callback_data: `${prefix}:refresh` },
        { text: '👁 MONITOR', callback_data: `${prefix}:refresh` },
      ],
      [
        { text: '💊 Pump', url: `https://pump.fun/${mint}` },
        { text: '🔍 Scan', url: `https://solscan.io/token/${mint}` },
        { text: '📊 DexS', url: `https://dexscreener.com/solana/${mint}` },
      ],
    ],
  };
}

/**
 * Build inline keyboard untuk SNIPED result (setelah buy sukses)
 * Alias dari buildSellKeyboard — layout identik:
 * Row 1: 🔴 CLOSE | 🔴 50% | 🔴 75%  — sell actions
 * Row 2: 📊 PNL   | 👁 MONITOR        — info actions
 * Row 3: 💊 Pump  | 🔍 Scan  | 📊 DexS — external links
 */
export const buildSnipeResultKeyboard = buildSellKeyboard;

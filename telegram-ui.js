/**
 * telegram-ui.js
 * Rich UI Builder — Elegant Inline Keyboards untuk SniperAI
 * 
 * v2.0 — Redesigned with:
 * • Visual score bars & bonding curve progress
 * • MCap tracking with growth indicators
 * • Card-style alerts with narrative tags
 * • Dashboard, history, stats, daily recap
 * • Enhanced inline keyboards
 */

const BUY_AMOUNTS = [0.012, 0.1, 0.25, 0.5, 0.75];

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Build a visual progress bar (10 blocks) */
function bar(value, max, filled, empty) {
  if (max === undefined) max = 100;
  if (filled === undefined) filled = '\u2588';
  if (empty === undefined) empty = '\u2591';
  var pct = Math.min(1, Math.max(0, value / max));
  var filledCount = Math.round(pct * 10);
  return filled.repeat(filledCount) + empty.repeat(10 - filledCount);
}

/** Build score bar with color emoji */
function scoreBar(score) {
  var blocks = bar(score, 100, '\uD83D\uDFE2', '\u26AB');
  return blocks + ' *' + score + '/100*';
}

/** Format PnL with emoji and sign */
function formatPnl(pnlSol, pnlPct) {
  var emoji = pnlSol >= 0 ? '\uD83D\uDFE2' : '\uD83D\uDD34';
  var sign = pnlSol >= 0 ? '+' : '';
  return emoji + ' *' + sign + pnlPct.toFixed(1) + '%* (' + sign + pnlSol.toFixed(4) + ' SOL)';
}

/** Format hold duration */
function formatDuration(openedAt) {
  if (!openedAt) return 'N/A';
  var ms = Date.now() - new Date(openedAt).getTime();
  var mins = Math.floor(ms / 60000);
  var secs = Math.floor((ms % 60000) / 1000);
  if (mins >= 60) {
    var h = Math.floor(mins / 60);
    return h + 'h ' + (mins % 60) + 'm';
  }
  return mins >= 1 ? mins + 'm ' + secs + 's' : secs + 's';
}

/** Format number with locale */
function fmt(n, decimals) {
  if (decimals === undefined) decimals = 2;
  if (n == null || isNaN(n)) return 'N/A';
  return Number(n).toFixed(decimals);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MCAP FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format MCap SOL -> USD string
 * @param {number} mcapSol - Market cap in SOL
 * @param {number} solPrice - SOL/USD price (default: 150)
 */
export function formatMcapUsd(mcapSol, solPrice) {
  if (solPrice === undefined) solPrice = 150;
  if (!mcapSol || mcapSol <= 0) return 'N/A';
  var usd = mcapSol * solPrice;
  if (usd >= 1000000) return '$' + (usd / 1000000).toFixed(2) + 'M';
  if (usd >= 1000) return '$' + (usd / 1000).toFixed(1) + 'K';
  return '$' + usd.toFixed(0);
}

/**
 * Format MCap with compact SOL + USD
 */
function formatMcapCompact(mcapSol) {
  return formatMcapUsd(mcapSol, 150);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SNIPE ALERT — Card-style token notification
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build elegant snipe alert card with rich visuals
 */
export function buildSnipeAlertText(tokenData, screenResult) {
  var mint = tokenData.mint || '';
  var symbol = tokenData.symbol || '???';
  var name = tokenData.name || symbol;
  var score = (screenResult && screenResult.score) ? screenResult.score : (tokenData._mergerScore || 0);
  var mcapSol = tokenData.marketCapSol || 0;
  var mcapUsd = formatMcapCompact(mcapSol);
  var dev = tokenData.deployer || '';
  var reasons = (screenResult && screenResult.reasons) ? screenResult.reasons : [];
  var mode = (screenResult && screenResult.mode) ? screenResult.mode : (tokenData._mergerStrategy || '');
  var initialBuySol = tokenData.initialBuySol || 0;
  var bondingPct = tokenData.bondingCurvePct;

  // Score indicator
  var scoreEmoji = score >= 80 ? '\uD83D\uDD25' : score >= 70 ? '\u2B50' : score >= 60 ? '\uD83D\uDCA1' : '\uD83D\uDC40';
  var scoreLine = scoreEmoji + ' Score: ' + scoreBar(score);

  // MCap line
  var mcapLine = mcapSol > 0
    ? '\uD83D\uDCB0 MCap: *' + mcapUsd + '* (' + mcapSol.toFixed(1) + ' SOL)'
    : '\uD83D\uDCB0 MCap: _fetching..._';

  // Initial buy line
  var initBuyLine = initialBuySol > 0
    ? '\uD83D\uDCE5 Initial Buy: *' + initialBuySol.toFixed(1) + ' SOL*'
    : '';

  // Bonding curve progress
  var bondingLine = '';
  if (bondingPct != null) {
    bondingLine = '\uD83D\uDCC8 Bonding: ' + bar(bondingPct) + ' *' + bondingPct.toFixed(0) + '%*';
  }

  // Mode tag
  var modeLabel = mode ? ' | \uD83C\uDFAF ' + mode.replace(/_/g, ' ') : '';

  // Top reasons (max 3)
  var topReasons = reasons
    .filter(function(r) { return !r.startsWith('\u23ED'); })
    .slice(0, 3)
    .map(function(r) { return '  ' + r.replace(/\*/g, ''); })
    .join('\n');

  var timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    '\uD83C\uDFAF *SNIPE ALERT* ' + modeLabel + '\n\n' +
    '*' + symbol + '*' + (name !== symbol ? ' \u2014 ' + name : '') + '\n' +
    '`' + mint.slice(0, 8) + '...pump`' + '\n\n' +
    scoreLine + '\n' +
    mcapLine + '\n' +
    initBuyLine + (initBuyLine ? '\n' : '') +
    bondingLine + (bondingLine ? '\n' : '') +
    '\n' +
    (topReasons ? '\uD83D\uDCCB *Signals:*\n' + topReasons + '\n\n' : '\n') +
    '\uD83D\uDC64 Dev: `' + (dev ? dev.slice(0, 8) + '...' : 'unknown') + '`' + '\n' +
    '\u23F1 ' + timeStr + ' WIB'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POSITION STATUS — Live monitoring card
// ═══════════════════════════════════════════════════════════════════════════════

export function buildPositionStatusText(symbol, mint, entry, currentMultiple, pnlPct, pnlSol, duration, entryMcapSol, peakMcapSol, currentMcapSol) {
  entryMcapSol = entryMcapSol || 0;
  peakMcapSol = peakMcapSol || 0;
  currentMcapSol = currentMcapSol || 0;

  var emoji = pnlSol >= 0 ? '\uD83D\uDFE2' : '\uD83D\uDD34';
  var sign = pnlSol >= 0 ? '+' : '';

  // MCap tracking
  var mcapSection = '';
  if (entryMcapSol > 0) {
    var entryMc = formatMcapCompact(entryMcapSol);
    var currMc = currentMcapSol > 0
      ? formatMcapCompact(currentMcapSol)
      : formatMcapCompact(entryMcapSol * currentMultiple);
    var peakMc = peakMcapSol > 0 ? formatMcapCompact(peakMcapSol) : '';

    mcapSection = '\uD83D\uDCCA MCap: ' + entryMc + ' \u2192 *' + currMc + '*';
    if (peakMc && peakMcapSol > entryMcapSol) {
      mcapSection += ' \u00B7 \uD83D\uDD1D ' + peakMc;
    }
    mcapSection += '\n';
  }

  return (
    emoji + ' *Position* \u00B7 ' + (duration || 'N/A') + '\n\n' +
    '\uD83D\uDCCD *' + symbol + '* | `' + mint.slice(0, 8) + '...`' + '\n' +
    '\uD83D\uDCB5 Size: *' + fmt(entry) + ' SOL* \u00B7 PnL: *' + sign + pnlPct.toFixed(1) + '%* (' + sign + pnlSol.toFixed(4) + ' SOL)\n' +
    mcapSection +
    '\uD83D\uDCC8 Multiple: *' + currentMultiple.toFixed(2) + 'x*\n\n' +
    '_Tap below to manage:_'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — Comprehensive overview
// ═══════════════════════════════════════════════════════════════════════════════

export function buildDashboardText(stats, config, positions, balance) {
  var posCount = positions ? Object.keys(positions).length : 0;
  var solBalance = (balance && balance.solBalance) ? balance.solBalance : 0;
  var totalTrades = stats.wins + stats.losses;
  var winRate = totalTrades > 0
    ? ((stats.wins / totalTrades) * 100).toFixed(1)
    : '0.0';

  var pnlEmoji = stats.totalPnlSol >= 0 ? '\uD83D\uDFE2' : '\uD83D\uDD34';
  var pnlSign = stats.totalPnlSol >= 0 ? '+' : '';

  // Active positions quick view
  var posSection = '';
  if (posCount > 0 && positions) {
    var posEntries = Object.entries(positions).slice(0, 5);
    var posList = posEntries.map(function(entry) {
      var m = entry[0];
      var p = entry[1];
      var sym = p.symbol || m.slice(0, 6);
      var pnl = p.pnlPct || 0;
      var pe = pnl >= 0 ? '\uD83D\uDFE2' : '\uD83D\uDD34';
      var age = formatDuration(p.openedAt);
      return '  ' + pe + ' ' + sym + ' \u00B7 ' + (pnl >= 0 ? '+' : '') + pnl.toFixed(1) + '% \u00B7 ' + age;
    }).join('\n');
    if (Object.keys(positions).length > 5) {
      posSection = '\uD83D\uDCC2 *' + posCount + ' Open Positions:*\n' + posList + '\n  ... +' + (posCount - 5) + ' more\n\n';
    } else {
      posSection = '\uD83D\uDCC2 *Open Positions:*\n' + posList + '\n\n';
    }
  } else {
    posSection = '\uD83D\uDCC2 *Open Positions:* _none_\n\n';
  }

  var mode = config.botMode || 'semi-auto';
  var preset = 'custom';
  var isDry = config.isDryRun ? ' \uD83E\uDDEA' : '';

  return (
    '\uD83C\uDFAF *SniperAI Dashboard*' + isDry + '\n\n' +
    '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n' +
    '\u2551 \uD83D\uDCB0 Balance: *' + solBalance.toFixed(4) + ' SOL*  \u2551\n' +
    '\u2551 \uD83D\uDCCA PnL: ' + pnlEmoji + ' ' + pnlSign + stats.totalPnlSol.toFixed(4) + ' SOL   \u2551\n' +
    '\u2551 \uD83C\uDFAF Win Rate: *' + winRate + '%*        \u2551\n' +
    '\u2551 \uD83D\uDD04 Trades: ' + stats.tradesCount + ' \u00B7 ' + stats.wins + 'W/' + stats.losses + 'L  \u2551\n' +
    '\u2551 \u2699 Mode: ' + mode + ' \u00B7 ' + preset + '   \u2551\n' +
    '\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\n' +
    posSection +
    '_/help for all commands_'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

export function buildHistoryText(trades, limit) {
  if (limit === undefined) limit = 10;
  if (!trades || trades.length === 0) {
    return '\uD83D\uDCDC *Trade History*\n\n_No trades yet._';
  }

  var recent = trades.slice(-limit).reverse();
  var lines = recent.map(function(t, i) {
    var sym = t.symbol || (t.tokenMint || '').slice(0, 6);
    var pnl = t.pnlSol || 0;
    var emoji = pnl >= 0 ? '\uD83D\uDFE2' : '\uD83D\uDD34';
    var sign = pnl >= 0 ? '+' : '';
    var reason = t.closeReason
      ? t.closeReason.replace(/_/g, ' ').slice(0, 20)
      : 'closed';
    var date = t.closedAt
      ? new Date(t.closedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '';
    return emoji + ' *' + sym + '* \u00B7 ' + sign + pnl.toFixed(4) + ' SOL \u00B7 ' + reason + ' \u00B7 ' + date;
  });

  return (
    '\uD83D\uDCDC *Trade History* (last ' + recent.length + ')\n\n' +
    lines.join('\n') +
    '\n\n_/stats for detailed analytics_'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS — Performance Analytics
// ═══════════════════════════════════════════════════════════════════════════════

export function buildStatsText(stats, tradeHistory, config) {
  var totalTrades = stats.wins + stats.losses;
  var winRate = totalTrades > 0
    ? ((stats.wins / totalTrades) * 100).toFixed(1)
    : '0.0';

  // Best & worst trades
  var bestPnl = -Infinity;
  var worstPnl = Infinity;
  var bestTrade = null;
  var worstTrade = null;

  if (tradeHistory && tradeHistory.length > 0) {
    for (var i = 0; i < tradeHistory.length; i++) {
      var t = tradeHistory[i];
      var p = t.pnlSol || 0;
      if (p > bestPnl) { bestPnl = p; bestTrade = t; }
      if (p < worstPnl) { worstPnl = p; worstTrade = t; }
    }
  }

  // Average hold time
  var avgHoldMin = 0;
  if (tradeHistory && tradeHistory.length > 0) {
    var holds = [];
    for (var j = 0; j < tradeHistory.length; j++) {
      var ht = tradeHistory[j];
      if (ht.openedAt && ht.closedAt) {
        holds.push((new Date(ht.closedAt) - new Date(ht.openedAt)) / 60000);
      }
    }
    if (holds.length > 0) {
      avgHoldMin = holds.reduce(function(a, b) { return a + b; }, 0) / holds.length;
    }
  }

  // Mode breakdown
  var modeStats = {};
  if (tradeHistory && tradeHistory.length > 0) {
    for (var k = 0; k < tradeHistory.length; k++) {
      var mt = tradeHistory[k];
      var mode = mt.tradeMode || 'unknown';
      if (!modeStats[mode]) modeStats[mode] = { wins: 0, losses: 0, pnl: 0, count: 0 };
      modeStats[mode].count++;
      modeStats[mode].pnl += (mt.pnlSol || 0);
      if ((mt.pnlSol || 0) > 0) modeStats[mode].wins++;
      else modeStats[mode].losses++;
    }
  }
  var modeLines = Object.entries(modeStats).map(function(entry) {
    var md = entry[0];
    var ms = entry[1];
    var wr = ms.count > 0 ? ((ms.wins / ms.count) * 100).toFixed(0) : '0';
    var emoji = ms.pnl >= 0 ? '\uD83D\uDFE2' : '\uD83D\uDD34';
    return '  ' + emoji + ' ' + md + ': ' + wr + '% WR \u00B7 ' + (ms.pnl >= 0 ? '+' : '') + ms.pnl.toFixed(4) + ' SOL';
  });

  var isDry = config.isDryRun ? ' \uD83E\uDDEA' : '';

  return (
    '\uD83D\uDCCA *Performance Stats*' + isDry + '\n\n' +
    '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n' +
    '\u2551 \uD83C\uDFAF Win Rate: *' + winRate + '%*      \u2551\n' +
    '\u2551 \uD83D\uDCCA Trades: ' + totalTrades + ' (' + stats.wins + 'W/' + stats.losses + 'L) \u2551\n' +
    '\u2551 \uD83D\uDCB0 PnL: ' + (stats.totalPnlSol >= 0 ? '+' : '') + stats.totalPnlSol.toFixed(4) + ' SOL \u2551\n' +
    '\u2551 \u23F1 Avg Hold: ' + avgHoldMin.toFixed(1) + ' min  \u2551\n' +
    '\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\n' +
    (bestTrade ? '\uD83C\uDFC6 Best: ' + (bestTrade.symbol || '?') + ' \u00B7 +' + bestPnl.toFixed(4) + ' SOL\n' : '') +
    (worstTrade ? '\uD83D\uDC80 Worst: ' + (worstTrade.symbol || '?') + ' \u00B7 ' + worstPnl.toFixed(4) + ' SOL\n' : '') +
    '\n\uD83D\uDCCB *By Mode:*\n' + (modeLines.length > 0 ? modeLines.join('\n') : '  _no data_') + '\n\n' +
    '_/history for trade list_'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY RECAP
// ═══════════════════════════════════════════════════════════════════════════════

export function buildDailyRecapText(stats, tradeHistory, config) {
  var totalTrades = stats.wins + stats.losses;
  var winRate = totalTrades > 0
    ? ((stats.wins / totalTrades) * 100).toFixed(1)
    : '0.0';
  var pnlEmoji = stats.totalPnlSol >= 0 ? '\uD83D\uDFE2' : '\uD83D\uDD34';
  var pnlSign = stats.totalPnlSol >= 0 ? '+' : '';

  // Recent exits
  var recentExits = '';
  if (tradeHistory && tradeHistory.length > 0) {
    var today = new Date().toLocaleDateString('id-ID');
    var todayTrades = tradeHistory.filter(function(t) {
      var d = new Date(t.closedAt || t.openedAt);
      return d.toLocaleDateString('id-ID') === today;
    }).slice(-5).reverse();

    if (todayTrades.length > 0) {
      recentExits = todayTrades.map(function(t) {
        var sym = t.symbol || (t.tokenMint || '').slice(0, 6);
        var pnl = t.pnlSol || 0;
        var emoji = pnl >= 0 ? '\u2705' : '\uD83D\uDD34';
        var pnlPct = t.entryAmountSol > 0
          ? ((pnl / t.entryAmountSol) * 100).toFixed(1)
          : '0.0';
        return emoji + ' ' + sym + ' \u00B7 ' + (pnl >= 0 ? '+' : '') + pnlPct + '%';
      }).join('\n');
      recentExits = '\uD83D\uDCCB *Recent Exits:*\n' + recentExits + '\n\n';
    }
  }

  var todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  var isDry = config.isDryRun ? ' \uD83E\uDDEA' : '';

  return (
    '\uD83D\uDCC5 *Daily Recap*' + isDry + '\n' +
    '_' + todayStr + '_\n\n' +
    '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n' +
    '\u2551 \uD83D\uDCB0 PnL: ' + pnlEmoji + ' ' + pnlSign + stats.totalPnlSol.toFixed(4) + ' SOL \u2551\n' +
    '\u2551 \uD83C\uDFAF Win Rate: *' + winRate + '%*      \u2551\n' +
    '\u2551 \uD83D\uDD04 Trades: ' + totalTrades + ' (' + stats.wins + 'W/' + stats.losses + 'L) \u2551\n' +
    '\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\n' +
    recentExits +
    '_/stats for detailed analytics_'
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXIT NOTIFICATION — Rich exit card
// ═══════════════════════════════════════════════════════════════════════════════

export function buildExitNotificationText(position, reason, exitMeta, posNumber, config) {
  var pnlSol = position.pnlSol || 0;
  var pnlPct = position.pnlPct || 0;
  var emoji = pnlSol >= 0 ? '\u2705' : '\uD83D\uDD34';

  var exitType = (exitMeta && exitMeta.type) ? exitMeta.type : 'manual';
  var exitLabel = exitType.replace(/_/g, ' ').toUpperCase();

  var entryMcap = position.entryMcapSol > 0
    ? formatMcapCompact(position.entryMcapSol)
    : 'N/A';
  var peakMcap = position.peakMcapSol > 0
    ? formatMcapCompact(position.peakMcapSol)
    : entryMcap;
  var exitMcap = position.exitMcap || 'N/A';

  var entryPrice = position.entryPriceSol > 0
    ? position.entryPriceSol.toFixed(8)
    : 'N/A';
  var exitPrice = position.currentPriceSol > 0
    ? position.currentPriceSol.toFixed(8)
    : 'N/A';

  var holdTime = formatDuration(position.openedAt);
  var symbol = position.symbol || '???';
  var mint = position.tokenMint || '';
  var size = position.entryAmountSol || 0;
  var multiple = position.currentMultiple || 1;

  var mode = position.tradeMode
    ? position.tradeMode.replace(/_/g, ' ')
    : 'default';

  var sign = pnlSol >= 0 ? '+' : '';

  // TP/SL info
  var firstTp = (config.exit.takeProfitLevels && config.exit.takeProfitLevels[0] && config.exit.takeProfitLevels[0].triggerMultiple)
    ? ((config.exit.takeProfitLevels[0].triggerMultiple - 1) * 100).toFixed(0) + '%'
    : 'N/A';
  var sl = position.tradeMode && config.screening && config.screening.tradeModes && config.screening.tradeModes[position.tradeMode] && config.screening.tradeModes[position.tradeMode].stopLossPct
    ? config.screening.tradeModes[position.tradeMode].stopLossPct
    : config.exit.stopLossPct;

  return (
    emoji + ' *' + exitLabel + '* #' + posNumber + '\n\n' +
    '\uD83D\uDCCD *' + symbol + '* | `' + mint.slice(0, 8) + '...`' + '\n' +
    '\uD83C\uDFAF Mode: ' + mode + ' \u00B7 Hold: ' + holdTime + '\n\n' +
    '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n' +
    '\u2551 \uD83D\uDCB5 Size: ' + size.toFixed(4) + ' SOL          \u2551\n' +
    '\u2551 \uD83D\uDCC8 ' + multiple.toFixed(2) + 'x \u00B7 PnL: ' + sign + pnlPct.toFixed(1) + '%   \u2551\n' +
    '\u2551 \uD83D\uDCB0 ' + sign + pnlSol.toFixed(4) + ' SOL          \u2551\n' +
    '\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n\n' +
    '\uD83D\uDCCA MCap: ' + entryMcap + ' \u2192 ' + exitMcap + ' \u00B7 \uD83D\uDD1D ' + peakMcap + '\n' +
    '\uD83D\uDCB2 Entry: ' + entryPrice + ' \u2192 Exit: ' + exitPrice + '\n' +
    '\u2699 TP: ' + firstTp + ' \u00B7 SL: ' + sl + '%\n\n' +
    '\uD83D\uDCCB *Reason:* ' + reason
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE KEYBOARDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build snipe alert keyboard
 * Row 1: Buy amounts (0.012, 0.1, 0.25)
 * Row 2: Buy amounts (0.5, 0.75, Custom)
 * Row 3: Monitor | Skip | Close
 * Row 4: Pump | Scan | DexS
 */
export function buildSnipeKeyboard(mint, score) {
  var callbackPrefix = 'snipe:' + mint;

  var row1 = BUY_AMOUNTS.slice(0, 3).map(function(amt) {
    return { text: '\uD83D\uDFE2 ' + amt, callback_data: callbackPrefix + ':buy:' + amt };
  });

  var row2 = BUY_AMOUNTS.slice(3).map(function(amt) {
    return { text: '\uD83D\uDFE2 ' + amt, callback_data: callbackPrefix + ':buy:' + amt };
  });
  row2.push({ text: '\u270F Custom', callback_data: callbackPrefix + ':custom' });

  var row3 = [
    { text: '\uD83D\uDCFA Monitor', callback_data: callbackPrefix + ':monitor' },
    { text: '\u23ED Skip', callback_data: callbackPrefix + ':skip' },
    { text: '\u274C Close', callback_data: callbackPrefix + ':close' },
  ];

  var row4 = [
    { text: '\uD83D\uDC8A Pump', url: 'https://pump.fun/' + mint },
    { text: '\uD83D\uDD0D Scan', url: 'https://solscan.io/token/' + mint },
    { text: '\uD83D\uDCCA DexS', url: 'https://dexscreener.com/solana/' + mint },
  ];

  return { inline_keyboard: [row1, row2, row3, row4] };
}

/**
 * Build sell keyboard for active positions
 * Row 1: CLOSE 100% | 75% | 50% | 25%
 * Row 2: Refresh | Detail
 * Row 3: Pump | Scan | DexS
 */
export function buildSellKeyboard(mint) {
  var prefix = 'snipe:' + mint;
  return {
    inline_keyboard: [
      [
        { text: '\uD83D\uDD34 CLOSE', callback_data: prefix + ':sell:100' },
        { text: '\uD83D\uDD34 75%', callback_data: prefix + ':sell:75' },
        { text: '\uD83D\uDD34 50%', callback_data: prefix + ':sell:50' },
        { text: '\uD83D\uDFE1 25%', callback_data: prefix + ':sell:25' },
      ],
      [
        { text: '\uD83D\uDD04 Refresh', callback_data: prefix + ':refresh' },
        { text: '\uD83D\uDCCA Detail', callback_data: prefix + ':refresh' },
      ],
      [
        { text: '\uD83D\uDC8A Pump', url: 'https://pump.fun/' + mint },
        { text: '\uD83D\uDD0D Scan', url: 'https://solscan.io/token/' + mint },
        { text: '\uD83D\uDCCA DexS', url: 'https://dexscreener.com/solana/' + mint },
      ],
    ],
  };
}

/**
 * Build snipe result keyboard (alias for sell keyboard — post-buy actions)
 */
export var buildSnipeResultKeyboard = buildSellKeyboard;

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE BUILDERS — Backward compatible
// ═══════════════════════════════════════════════════════════════════════════════

export function buildBuyResultText(symbol, amountSol, txHash, isDry) {
  if (!txHash || txHash === 'DRY_RUN_BUY') {
    return (
      '\u2705 *BUY EXECUTED (Dry Run)*\n\n' +
      'Token: *' + symbol + '*\n' +
      'Amount: *' + amountSol + ' SOL*\n' +
      '_No real transaction (dry run mode)_'
    );
  }
  return (
    '\u2705 *SNIPED!*\n\n' +
    'Token: *' + symbol + '*\n' +
    'Amount: *' + amountSol + ' SOL*\n' +
    'Tx: `' + txHash + '`\n\n' +
    '_Monitoring started — TP/SL active_'
  );
}

export function buildErrorText(symbol, error) {
  return '\u274C *Buy Failed*\nToken: ' + symbol + '\nError: ' + error;
}

/**
 * Parse callback data dari button click
 * Returns: { action, mint, value }
 */
export function parseCallbackData(callbackData) {
  if (!callbackData || !callbackData.startsWith('snipe:')) return null;
  var parts = callbackData.split(':');
  if (parts.length < 3) return null;
  return {
    mint: parts[1],
    action: parts[2],
    value: parts.length > 3 ? parts[3] : null,
  };
}
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const sharp = require('/opt/toolchains/.nvm/versions/node/v22.22.3/lib/node_modules/sharp');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Color palette
const C = {
  bg1: '#0F0F14', bg2: '#1A1A24', bg3: '#24243A',
  purple: '#8B5CF6', purpleVib: '#7C3AED',
  textW: '#FFFFFF', textSec: '#A0A0B8', textTert: '#6B6B80',
  success: '#4ADE80', danger: '#F87171', warning: '#FBBF24',
  border: '#1E1E30',
};

const W = 390; // phone width
const H = 844; // phone height
const PAD = 24;
const GAP = 32;

function phone(x, y, content, label) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${W}" height="${H}" rx="44" fill="${C.bg1}" stroke="#2a2a3a" stroke-width="3"/>
      <clipPath id="clip-${x}-${y}"><rect x="3" y="3" width="${W-6}" height="${H-6}" rx="42"/></clipPath>
      <g clip-path="url(#clip-${x}-${y})">${content}</g>
      <text x="${W/2}" y="${H+28}" text-anchor="middle" fill="${C.purple}" font-size="12" font-weight="700" letter-spacing="1">${label}</text>
    </g>`;
}

function homeContent() {
  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="${C.bg1}"/>
    <!-- Header -->
    <text x="20" y="72" fill="${C.textW}" font-size="20" font-weight="800">SniperAI</text>
    <!-- Status -->
    <line x1="0" y1="92" x2="${W}" y2="92" stroke="${C.border}" stroke-width="1"/>
    <circle cx="28" cy="108" r="4" fill="${C.success}"/>
    <text x="38" y="112" fill="${C.textTert}" font-size="11">Live</text>
    <text x="${W-60}" y="112" fill="${C.textTert}" font-size="11">4 tokens</text>
    <!-- Filters -->
    <rect x="20" y="124" width="50" height="28" rx="14" fill="${C.purpleVib}"/>
    <text x="45" y="142" text-anchor="middle" fill="#FFF" font-size="12" font-weight="600">All</text>
    <rect x="78" y="124" width="60" height="28" rx="14" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="108" y="142" text-anchor="middle" fill="${C.textTert}" font-size="12" font-weight="600">Snipe</text>
    <rect x="146" y="124" width="62" height="28" rx="14" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="177" y="142" text-anchor="middle" fill="${C.textTert}" font-size="12" font-weight="600">Watch</text>
    <!-- Token Card 1 -->
    ${tokenCard(20, 168, 'P', 'PEPE2', 'Pepe 2.0', 85, 'SNIPE', C.purple)}
    <!-- Token Card 2 -->
    ${tokenCard(20, 340, 'C', 'CHAD', 'GigaChad Token', 72, 'SNIPE', C.purple)}
    <!-- Token Card 3 -->
    ${tokenCard(20, 512, 'M', 'MOON', 'Moon Shot', 58, 'WATCH', C.warning)}
    <!-- Tab Bar -->
    ${tabBar(0)}
  `;
}

function tokenCard(x, y, initial, sym, name, score, decision, col) {
  const w = W - 40;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="156" rx="16" fill="${C.bg2}" stroke="${C.border}"/>
    <!-- Avatar -->
    <circle cx="${x+32}" cy="${y+36}" r="20" fill="${C.bg3}"/>
    <text x="${x+32}" y="${y+42}" text-anchor="middle" fill="${C.purple}" font-size="16" font-weight="700">${initial}</text>
    <!-- Name -->
    <text x="${x+60}" y="${y+32}" fill="${C.textW}" font-size="15" font-weight="700">${sym}</text>
    <text x="${x+60}" y="${y+48}" fill="${C.textTert}" font-size="11">${name}</text>
    <!-- Score Badge -->
    <circle cx="${x+w-30}" cy="${y+36}" r="20" fill="none" stroke="${col}" stroke-width="2"/>
    <text x="${x+w-30}" y="${y+41}" text-anchor="middle" fill="${col}" font-size="13" font-weight="800">${score}</text>
    <text x="${x+w-30}" y="${y+60}" text-anchor="middle" fill="${col}" font-size="9" font-weight="700">${decision}</text>
    <!-- Metrics divider -->
    <line x1="${x+16}" y1="${y+80}" x2="${x+w-16}" y2="${y+80}" stroke="${C.border}" stroke-width="1"/>
    <!-- Metrics -->
    <text x="${x+44}" y="${y+104}" text-anchor="middle" fill="${C.textTert}" font-size="9">MC</text>
    <text x="${x+44}" y="${y+122}" text-anchor="middle" fill="${C.textSec}" font-size="12" font-weight="600">18.5</text>
    <text x="${x+130}" y="${y+104}" text-anchor="middle" fill="${C.textTert}" font-size="9">VOL</text>
    <text x="${x+130}" y="${y+122}" text-anchor="middle" fill="${C.textSec}" font-size="12" font-weight="600">6.3</text>
    <text x="${x+216}" y="${y+104}" text-anchor="middle" fill="${C.textTert}" font-size="9">BUYS</text>
    <text x="${x+216}" y="${y+122}" text-anchor="middle" fill="${C.textSec}" font-size="12" font-weight="600">28</text>
    <text x="${x+302}" y="${y+104}" text-anchor="middle" fill="${C.textTert}" font-size="9">AGE</text>
    <text x="${x+302}" y="${y+122}" text-anchor="middle" fill="${C.textSec}" font-size="12" font-weight="600">2m</text>
  `;
}

function tabBar(active) {
  const icons = ['◎','◈','◉','◇'];
  const labels = ['Discover','Portfolio','AI','Settings'];
  const y = H - 60;
  let items = `<rect x="0" y="${y}" width="${W}" height="60" fill="${C.bg1}"/><line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${C.border}"/>`;
  for (let i = 0; i < 4; i++) {
    const cx = (W / 4) * i + (W / 8);
    const isAct = i === active;
    const col = isAct ? C.purple : C.textTert;
    if (isAct) items += `<circle cx="${cx}" cy="${y+22}" r="15" fill="rgba(139,92,246,0.15)"/>`;
    items += `<text x="${cx}" y="${y+27}" text-anchor="middle" fill="${col}" font-size="16">${icons[i]}</text>`;
    items += `<text x="${cx}" y="${y+46}" text-anchor="middle" fill="${col}" font-size="10" font-weight="600">${labels[i]}</text>`;
  }
  return items;
}

function portfolioContent() {
  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="${C.bg1}"/>
    <text x="20" y="72" fill="${C.textW}" font-size="20" font-weight="800">Portfolio</text>
    <!-- Summary Card -->
    <rect x="20" y="90" width="${W-40}" height="190" rx="20" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="36" y="118" fill="${C.textTert}" font-size="10" font-weight="600">TOTAL VALUE</text>
    <text x="36" y="150" fill="${C.textW}" font-size="26" font-weight="800" font-family="monospace">1.450 SOL</text>
    <rect x="36" y="162" width="160" height="24" rx="12" fill="rgba(74,222,128,0.12)"/>
    <text x="46" y="179" fill="${C.success}" font-size="12" font-weight="600">+0.450 SOL (+45.0%)</text>
    <!-- Stats row -->
    <line x1="36" y1="200" x2="${W-56}" y2="200" stroke="${C.border}"/>
    <text x="80" y="224" text-anchor="middle" fill="${C.textTert}" font-size="9">POSITIONS</text>
    <text x="80" y="244" text-anchor="middle" fill="${C.textW}" font-size="13" font-weight="600">2</text>
    <text x="195" y="224" text-anchor="middle" fill="${C.textTert}" font-size="9">INVESTED</text>
    <text x="195" y="244" text-anchor="middle" fill="${C.textW}" font-size="13" font-weight="600">1.00 SOL</text>
    <text x="310" y="224" text-anchor="middle" fill="${C.textTert}" font-size="9">WIN RATE</text>
    <text x="310" y="244" text-anchor="middle" fill="${C.textW}" font-size="13" font-weight="600">50%</text>
    <!-- Section header -->
    <text x="20" y="310" fill="${C.textW}" font-size="15" font-weight="600">Open Positions</text>
    <!-- Position 1 -->
    <rect x="20" y="326" width="${W-40}" height="100" rx="16" fill="${C.bg2}" stroke="${C.border}"/>
    <circle cx="52" cy="362" r="18" fill="${C.bg3}"/>
    <text x="52" y="367" text-anchor="middle" fill="${C.purple}" font-size="14" font-weight="700">P</text>
    <text x="78" y="357" fill="${C.textW}" font-size="14" font-weight="600">PEPE2</text>
    <text x="78" y="374" fill="${C.textTert}" font-size="11">0.50 SOL · 8m</text>
    <text x="${W-56}" y="362" text-anchor="end" fill="${C.success}" font-size="20" font-weight="800">2.10x</text>
    <rect x="${W-100}" y="370" width="44" height="18" rx="9" fill="rgba(74,222,128,0.1)"/>
    <text x="${W-78}" y="383" text-anchor="middle" fill="${C.success}" font-size="10" font-weight="600">+110%</text>
    <!-- Progress bar -->
    <rect x="36" y="400" width="${W-96}" height="3" rx="2" fill="${C.bg3}"/>
    <rect x="36" y="400" width="${(W-96)*0.91}" height="3" rx="2" fill="${C.success}"/>
    <text x="${W-56}" y="406" text-anchor="end" fill="${C.textTert}" font-size="9">Peak: 2.3x</text>
    <!-- Position 2 -->
    <rect x="20" y="440" width="${W-40}" height="100" rx="16" fill="${C.bg2}" stroke="${C.border}"/>
    <circle cx="52" cy="476" r="18" fill="${C.bg3}"/>
    <text x="52" y="481" text-anchor="middle" fill="${C.purple}" font-size="14" font-weight="700">C</text>
    <text x="78" y="471" fill="${C.textW}" font-size="14" font-weight="600">CHAD</text>
    <text x="78" y="488" fill="${C.textTert}" font-size="11">0.50 SOL · 22m</text>
    <text x="${W-56}" y="476" text-anchor="end" fill="${C.danger}" font-size="20" font-weight="800">0.80x</text>
    <rect x="${W-92}" y="484" width="36" height="18" rx="9" fill="rgba(248,113,113,0.1)"/>
    <text x="${W-74}" y="497" text-anchor="middle" fill="${C.danger}" font-size="10" font-weight="600">-20%</text>
    <rect x="36" y="514" width="${W-96}" height="3" rx="2" fill="${C.bg3}"/>
    <rect x="36" y="514" width="${(W-96)*0.62}" height="3" rx="2" fill="${C.danger}"/>
    <text x="${W-56}" y="520" text-anchor="end" fill="${C.textTert}" font-size="9">Peak: 1.3x</text>
    ${tabBar(1)}
  `;
}

function aiChatContent() {
  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="${C.bg1}"/>
    <text x="20" y="72" fill="${C.textW}" font-size="18" font-weight="700">AI</text>
    <line x1="0" y1="86" x2="${W}" y2="86" stroke="${C.border}"/>
    <!-- AI message 1 -->
    <circle cx="32" cy="118" r="14" fill="${C.purpleVib}"/>
    <text x="32" y="123" text-anchor="middle" fill="#FFF" font-size="12">◉</text>
    <rect x="52" y="100" width="260" height="120" rx="18" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="68" y="122" fill="${C.textSec}" font-size="12">Hey! I'm your AI trading</text>
    <text x="68" y="140" fill="${C.textSec}" font-size="12">copilot.</text>
    <text x="68" y="166" fill="${C.textSec}" font-size="12">I can help you with:</text>
    <text x="68" y="184" fill="${C.textSec}" font-size="12">• Finding high-score tokens</text>
    <text x="68" y="202" fill="${C.textSec}" font-size="12">• Trading strategies</text>
    <!-- User message -->
    <rect x="${W-210}" y="240" width="180" height="36" rx="18" fill="${C.purpleVib}"/>
    <text x="${W-120}" y="263" text-anchor="middle" fill="#FFF" font-size="13">What is bundling?</text>
    <!-- AI message 2 -->
    <circle cx="32" cy="308" r="14" fill="${C.purpleVib}"/>
    <text x="32" y="313" text-anchor="middle" fill="#FFF" font-size="12">◉</text>
    <rect x="52" y="290" width="280" height="80" rx="18" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="68" y="314" fill="${C.textSec}" font-size="11">Bundling is when a deployer uses</text>
    <text x="68" y="330" fill="${C.textSec}" font-size="11">multiple wallets to buy their own</text>
    <text x="68" y="346" fill="${C.textSec}" font-size="11">token at launch. SniperAI detects</text>
    <text x="68" y="362" fill="${C.textSec}" font-size="11">3+ wallets and auto-skips.</text>
    <!-- User message 2 -->
    <rect x="${W-220}" y="390" width="190" height="36" rx="18" fill="${C.purpleVib}"/>
    <text x="${W-125}" y="413" text-anchor="middle" fill="#FFF" font-size="13">Show trending tokens</text>
    <!-- AI with token suggestions -->
    <circle cx="32" cy="458" r="14" fill="${C.purpleVib}"/>
    <text x="32" y="463" text-anchor="middle" fill="#FFF" font-size="12">◉</text>
    <rect x="52" y="440" width="280" height="130" rx="18" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="68" y="464" fill="${C.textSec}" font-size="12">Here are top tokens:</text>
    <rect x="66" y="476" width="250" height="36" rx="10" fill="${C.bg3}"/>
    <text x="82" y="499" fill="${C.textW}" font-size="12" font-weight="600">PEPE2</text>
    <rect x="260" y="484" width="40" height="20" rx="10" fill="rgba(139,92,246,0.2)"/>
    <text x="280" y="498" text-anchor="middle" fill="${C.purple}" font-size="11" font-weight="600">85</text>
    <rect x="66" y="518" width="250" height="36" rx="10" fill="${C.bg3}"/>
    <text x="82" y="541" fill="${C.textW}" font-size="12" font-weight="600">CHAD</text>
    <rect x="260" y="526" width="40" height="20" rx="10" fill="rgba(139,92,246,0.2)"/>
    <text x="280" y="540" text-anchor="middle" fill="${C.purple}" font-size="11" font-weight="600">72</text>
    <!-- Input bar -->
    <line x1="0" y1="${H-80}" x2="${W}" y2="${H-80}" stroke="${C.border}"/>
    <rect x="12" y="${H-70}" width="${W-68}" height="40" rx="20" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="28" y="${H-45}" fill="${C.textTert}" font-size="13">Ask anything about tokens...</text>
    <circle cx="${W-32}" cy="${H-50}" r="19" fill="${C.purpleVib}"/>
    <text x="${W-32}" y="${H-44}" text-anchor="middle" fill="#FFF" font-size="16" font-weight="800">↑</text>
    ${tabBar(2)}
  `;
}

function settingsContent() {
  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="${C.bg1}"/>
    <text x="20" y="72" fill="${C.textW}" font-size="18" font-weight="700">Settings</text>
    <line x1="0" y1="86" x2="${W}" y2="86" stroke="${C.border}"/>
    <!-- Wallet Card -->
    <rect x="16" y="100" width="${W-32}" height="160" rx="16" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="32" y="124" fill="${C.purple}" font-size="11" font-weight="700">WALLET</text>
    <circle cx="48" cy="156" r="20" fill="${C.bg3}"/>
    <text x="48" y="162" text-anchor="middle" fill="${C.purple}" font-size="16">◈</text>
    <text x="76" y="152" fill="${C.textW}" font-size="13" font-weight="600" font-family="monospace">7xK9...mP4z</text>
    <text x="76" y="168" fill="${C.success}" font-size="9">Connected via Seed Vault</text>
    <!-- Genesis Badge -->
    <rect x="32" y="186" width="200" height="22" rx="11" fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.4)"/>
    <text x="42" y="201" fill="#A66DFF" font-size="10" font-weight="600">✦ Seeker Genesis Holder · 50% Off</text>
    <text x="${W/2}" y="240" text-anchor="middle" fill="${C.purple}" font-size="13" font-weight="600">Disconnect</text>
    <!-- SKR Card -->
    <rect x="16" y="272" width="${W-32}" height="90" rx="16" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="32" y="296" fill="${C.purple}" font-size="11" font-weight="700">SKR REWARDS</text>
    <text x="32" y="336" fill="${C.textW}" font-size="24" font-weight="800" font-family="monospace">125.0</text>
    <text x="32" y="352" fill="${C.textTert}" font-size="9">SKR Balance</text>
    <rect x="${W-128}" y="316" width="96" height="32" rx="10" fill="none" stroke="${C.purple}" stroke-width="1.5"/>
    <text x="${W-80}" y="337" text-anchor="middle" fill="${C.purple}" font-size="12" font-weight="700">Claim Daily</text>
    <!-- Notifications Card -->
    <rect x="16" y="376" width="${W-32}" height="160" rx="16" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="32" y="400" fill="${C.purple}" font-size="11" font-weight="700">NOTIFICATIONS</text>
    <text x="32" y="426" fill="${C.textW}" font-size="13">Push Alerts</text>
    <text x="32" y="441" fill="${C.textTert}" font-size="9">Get notified on high-score tokens</text>
    <!-- Toggle ON -->
    <rect x="${W-72}" y="416" width="40" height="22" rx="11" fill="${C.purpleVib}"/>
    <circle cx="${W-44}" cy="427" r="8" fill="#FFF"/>
    <line x1="32" y1="454" x2="${W-48}" y2="454" stroke="${C.border}"/>
    <text x="32" y="476" fill="${C.textSec}" font-size="12">Min Score for Alert</text>
    <text x="${W-48}" y="476" text-anchor="end" fill="${C.textW}" font-size="12" font-weight="600">75</text>
    <line x1="32" y1="490" x2="${W-48}" y2="490" stroke="${C.border}"/>
    <text x="32" y="512" fill="${C.textSec}" font-size="12">Alert on Rug Detected</text>
    <text x="${W-48}" y="512" text-anchor="end" fill="${C.textW}" font-size="12" font-weight="600">On</text>
    <line x1="32" y1="526" x2="${W-48}" y2="526" stroke="${C.border}"/>
    <!-- Risk Card -->
    <rect x="16" y="550" width="${W-32}" height="160" rx="16" fill="${C.bg2}" stroke="${C.border}"/>
    <text x="32" y="574" fill="${C.purple}" font-size="11" font-weight="700">RISK MANAGEMENT</text>
    <text x="32" y="600" fill="${C.textW}" font-size="13">Auto-Trade</text>
    <text x="32" y="615" fill="${C.textTert}" font-size="9">Auto execute on high scores</text>
    <!-- Toggle OFF -->
    <rect x="${W-72}" y="590" width="40" height="22" rx="11" fill="${C.bg3}"/>
    <circle cx="${W-61}" cy="601" r="8" fill="${C.textTert}"/>
    <line x1="32" y1="628" x2="${W-48}" y2="628" stroke="${C.border}"/>
    <text x="32" y="650" fill="${C.textSec}" font-size="12">Buy Amount</text>
    <text x="${W-48}" y="650" text-anchor="end" fill="${C.textW}" font-size="12" font-weight="600">0.5 SOL</text>
    <line x1="32" y1="664" x2="${W-48}" y2="664" stroke="${C.border}"/>
    <text x="32" y="686" fill="${C.textSec}" font-size="12">Stop Loss</text>
    <text x="${W-48}" y="686" text-anchor="end" fill="${C.textW}" font-size="12" font-weight="600">-40%</text>
    <line x1="32" y1="700" x2="${W-48}" y2="700" stroke="${C.border}"/>
    ${tabBar(3)}
  `;
}

// Build full SVG
const totalW = (W + GAP) * 5 + PAD * 2 - GAP;
const totalH = H + 80;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <rect width="${totalW}" height="${totalH}" fill="#0a0a0f"/>
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; }</style>
  ${phone(PAD, PAD, homeContent(), 'DISCOVER FEED')}
  ${phone(PAD + W + GAP, PAD, portfolioContent(), 'PORTFOLIO')}
  ${phone(PAD + (W + GAP)*2, PAD, aiChatContent(), 'AI CHAT')}
  ${phone(PAD + (W + GAP)*3, PAD, settingsContent(), 'SETTINGS')}
</svg>`;

const outPath = path.resolve(__dirname, 'sniperai-ui-preview.png');
await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log('Done:', outPath);

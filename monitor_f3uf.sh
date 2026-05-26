#!/usr/bin/env bash
# Monitor token price — sell if -10% from entry
set -e
cd /root/SniperAI

MINT="F3UfckxLPtCmFQZ8WDkDsYiwDHFzpdFrC1sfNkEofJH1"
ENTRY_PRICE=0.00000295
STOP_PRICE=0.00000265
TOKEN_DECIMALS=6
RAW_AMOUNT=4687318559  # 4687.318559 tokens * 10^6

source <(grep -E '^(RPC_URL|WALLET_PRIVATE_KEY)' .env)

# Dapatkan quote via Jupiter
QUOTE=$(curl -s --max-time 10 \
  "https://api.jup.ag/swap/v1/quote?inputMint=${MINT}&outputMint=So11111111111111111111111111111111111111112&amount=${RAW_AMOUNT}&slippageBps=1000" 2>&1)

OUT_AMOUNT=$(echo "$QUOTE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('outAmount','0'))" 2>/dev/null || echo "0")

if [ "$OUT_AMOUNT" = "0" ] || [ "$OUT_AMOUNT" = "null" ]; then
  >&2 echo "[monitor] ⚠️ Gagal dapet harga"
  exit 0
fi

CURRENT_PRICE=$(echo "scale=10; $OUT_AMOUNT / 1000000000 / 4687.318559" | bc -l 2>/dev/null || echo "0")
NOW_SOL=$(echo "scale=10; $OUT_AMOUNT / 1000000000" | bc -l)
CMP=$(echo "$CURRENT_PRICE < $STOP_PRICE" | bc -l)

if [ "$CMP" -eq 1 ]; then
  echo "[monitor] 📊 Harga: ${CURRENT_PRICE} SOL | Nilai: ${NOW_SOL} SOL | Entry: ${ENTRY_PRICE} | Stop: ${STOP_PRICE}"
  echo "[monitor] 🔴 Harga ${CURRENT_PRICE} < ${STOP_PRICE} STOP — JUAL!"
  node -e "
    import('dotenv').then(d=>d.default.config());
    import('./executor.js').then(async e=>{
      const r = await e.sellToken({mint:'${MINT}', sellPct:100, slippageBps:1000});
      console.log(JSON.stringify(r));
    });
  " 2>&1
  echo "[monitor] ✅ Token dijual — cron job akan distop"
  # Hapus file cron — will be stopped externally
else
  # Silent — no news is good news
  exit 0
fi

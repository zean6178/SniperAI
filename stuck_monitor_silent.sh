#!/usr/bin/env bash
# Silent stuck token monitor — output cuma kalo ada aksi nyata (sell)
set -euo pipefail

cd /root/SniperAI || exit 1

# Trap output — kumpulin dulu, baru print kalo ada signal
OUT=$(node stuck_monitor.mjs 2>/dev/null) || true

# Filter: cuma kasih tau kalo beneran ada SOLD or ERROR yang berarti
if echo "$OUT" | grep -qE '(SOLD|🚀|liquidity)'; then
  echo "=== STUCK TOKEN MONITOR ==="
  echo "$OUT"
  echo "==========================="
# else — silent, no output at all
fi

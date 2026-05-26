/**
 * Mayhem mode detection for Pump.fun tokens
 * API: https://frontend-api-v3.pump.fun/coins/{mint}
 * Returns { mayhem: bool, reason: string }
 */
let _mayhemCache = new Map();
const MAYHEM_CACHE_TTL = 120_000; // 2 menit

export async function checkMayhemState(mint) {
  if (!mint) return { isMayhem: false, reason: '' };

  // Cek cache
  const cached = _mayhemCache.get(mint);
  if (cached && (Date.now() - cached.ts) < MAYHEM_CACHE_TTL) {
    return cached.result;
  }

  try {
    const res = await fetch(
      `https://frontend-api-v3.pump.fun/coins/${mint}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { isMayhem: false, reason: `API ${res.status}` };

    const data = await res.json();
    const state = data.mayhem_state || data.mayhem?.state || '';
    const isMayhem =
      state === 'paused' ||
      state === 'active' ||
      state === 'mayhem' ||
      !!data.mayhem;

    // Hitung bonding curve progress kalo ada
    const bondingPct = data.virtual_sol_reserves && data.virtual_token_reserves && data.total_supply
      ? Math.min(100, ((data.real_sol_reserves || 0) / (data.virtual_sol_reserves || 1)) * 100)
      : null;

    const result = {
      isMayhem,
      reason: data.mayhem?.pause_reason || (isMayhem ? state : ''),
      mayhemState: state,
      bondingCurve: data.bonding_curve || '',
      bondingCurvePct: bondingPct,
      complete: data.complete || false,
      creator: data.creator || '',
    };

    _mayhemCache.set(mint, { ts: Date.now(), result });
    return result;
  } catch (e) {
    // Timeout / network error — skip mayhem check
    return { isMayhem: false, reason: '' };
  }
}

// Export juga buat bonding curve progress (lebih akurat dari on-chain)
export { checkMayhemState as getMayhemBondingCurve };

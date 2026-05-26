/**
 * concurrency.js
 * Position-Level Lock Guard — Mencegah dual-sell pada posisi yang sama
 * 
 * Setiap modul (monitor, IL protection, rebalance) harus acquire lock
 * sebelum execute sell. Lock auto-release setelah timeout.
 */

const _locks = new Map();
const LOCK_TIMEOUT_MS = 30_000; // 30 detik max hold

/**
 * Acquire lock untuk suatu mint
 * @param {string} mint 
 * @returns {boolean} true if lock acquired, false if already locked
 */
export function acquireLock(mint) {
  const existing = _locks.get(mint);
  if (existing) {
    // Cek timeout — kalo expired, force release
    if (Date.now() - existing > LOCK_TIMEOUT_MS) {
      _locks.set(mint, Date.now());
      return true;
    }
    return false;
  }

  _locks.set(mint, Date.now());
  return true;
}

/**
 * Release lock untuk suatu mint
 */
export function releaseLock(mint) {
  _locks.delete(mint);
}

/**
 * Check apakah mint terkunci
 */
export function isLocked(mint) {
  const existing = _locks.get(mint);
  if (!existing) return false;

  // Auto-release kalo expired
  if (Date.now() - existing > LOCK_TIMEOUT_MS) {
    _locks.delete(mint);
    return false;
  }

  return true;
}

/**
 * Execute a function with lock acquired
 * @param {string} mint
 * @param {Function} fn — async function
 * @returns {Promise<{executed: boolean, result: any}>}
 */
export async function withLock(mint, fn) {
  if (!acquireLock(mint)) {
    return { executed: false, result: null, reason: 'LOCKED' };
  }

  try {
    const result = await fn();
    return { executed: true, result };
  } finally {
    releaseLock(mint);
  }
}

/**
 * Get all active locks (for debugging)
 */
export function getActiveLocks() {
  const now = Date.now();
  const active = {};
  for (const [mint, ts] of _locks) {
    if (now - ts < LOCK_TIMEOUT_MS) {
      active[mint] = { heldFor: now - ts };
    }
  }
  return active;
}

/**
 * Clear all expired locks (cleanup)
 */
export function cleanupLocks() {
  const now = Date.now();
  for (const [mint, ts] of _locks) {
    if (now - ts >= LOCK_TIMEOUT_MS) {
      _locks.delete(mint);
    }
  }
}

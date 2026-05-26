/**
 * concurrency.test.js
 * Tests for position-level lock guard
 * 
 * Run: node --test concurrency.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const {
  acquireLock,
  releaseLock,
  isLocked,
  withLock,
  getActiveLocks,
  cleanupLocks,
} = await import('./concurrency.js');

describe('acquireLock()', () => {
  test('acquires lock for a new mint', () => {
    const result = acquireLock('mint_a');
    assert.equal(result, true);
    releaseLock('mint_a');
  });

  test('returns false for already locked mint', () => {
    acquireLock('mint_b');
    const result = acquireLock('mint_b');
    assert.equal(result, false);
    releaseLock('mint_b');
  });

  test('returns true for different mints', () => {
    acquireLock('mint_c1');
    const result = acquireLock('mint_c2');
    assert.equal(result, true);
    releaseLock('mint_c1');
    releaseLock('mint_c2');
  });
});

describe('releaseLock()', () => {
  test('releases lock so it can be acquired again', () => {
    acquireLock('mint_d');
    releaseLock('mint_d');
    const result = acquireLock('mint_d');
    assert.equal(result, true);
    releaseLock('mint_d');
  });
});

describe('isLocked()', () => {
  test('returns false for unlocked mint', () => {
    assert.equal(isLocked('unlocked'), false);
  });

  test('returns true for locked mint', () => {
    acquireLock('locked_mint');
    const result = isLocked('locked_mint');
    assert.equal(result, true);
    releaseLock('locked_mint');
  });

  test('returns false after release', () => {
    acquireLock('release_test');
    releaseLock('release_test');
    assert.equal(isLocked('release_test'), false);
  });
});

describe('withLock()', () => {
  test('executes function when lock acquired', async () => {
    const { executed, result } = await withLock('exec_mint', async () => {
      return 'done';
    });
    assert.equal(executed, true);
    assert.equal(result, 'done');
  });

  test('skips execution when already locked', async () => {
    acquireLock('skip_mint');
    const { executed, reason } = await withLock('skip_mint', async () => {
      return 'should not run';
    });
    assert.equal(executed, false);
    assert.equal(reason, 'LOCKED');
    releaseLock('skip_mint');
  });

  test('releases lock after execution', async () => {
    await withLock('auto_release', async () => 'ok');
    assert.equal(isLocked('auto_release'), false);
  });

  test('releases lock even on error', async () => {
    try {
      await withLock('error_mint', async () => {
        throw new Error('test error');
      });
    } catch (e) {
      // Expected
    }
    assert.equal(isLocked('error_mint'), false);
  });
});

describe('getActiveLocks()', () => {
  test('returns empty object when no locks', () => {
    const locks = getActiveLocks();
    assert.equal(Object.keys(locks).length, 0);
  });

  test('shows active locks', () => {
    acquireLock('active_test');
    const locks = getActiveLocks();
    assert.ok('active_test' in locks);
    releaseLock('active_test');
  });
});

describe('cleanupLocks()', () => {
  test('has no active locks after normal flow', async () => {
    await withLock('clean_mint', async () => 'ok');
    assert.equal(isLocked('clean_mint'), false);
    assert.equal(Object.keys(getActiveLocks()).length, 0);
  });
});

// ─── Solana web3.js v1 Polyfills for React Native ──────────────────────────────
// MUST be imported before anything else (before App.tsx)
//
// @solana/web3.js v1 depends on Node.js builtins that don't exist in RN.
// This shim injects them into the global scope so the library works.

import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import EventEmitter from 'events';

// Inject Buffer globally
global.Buffer = Buffer;

// Inject EventEmitter (used by readable-stream)
if (typeof global.EventEmitter === 'undefined') {
  global.EventEmitter = EventEmitter;
}

// Polyfill process.nextTick (used by stream/events)
if (typeof process.nextTick !== 'function') {
  process.nextTick = (fn, ...args) => {
    setTimeout(() => fn(...args), 0);
  };
}
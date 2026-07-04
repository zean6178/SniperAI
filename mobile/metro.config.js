const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ─── Polyfill Node.js builtins for @solana/web3.js v1 ──────────────────────
// React Native doesn't have Node.js builtins (crypto, buffer, stream, etc.)
// @solana/web3.js v1 requires these. Metro's resolver maps them to polyfills.

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
  events: require.resolve('events'),
  path: require.resolve('path-browserify'),
  os: require.resolve('os-browserify/browser'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  url: require.resolve('url'),
  assert: require.resolve('assert'),
  util: require.resolve('util'),
};

module.exports = config;
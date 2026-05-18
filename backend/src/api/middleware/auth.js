/**
 * Auth Middleware — Wallet-based JWT authentication
 * 
 * Flow:
 * 1. User signs a message with their wallet (Seed Vault)
 * 2. POST /auth/login verifies signature → returns JWT
 * 3. All subsequent requests include JWT in Authorization header
 */

import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sniperai-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate JWT for authenticated wallet
 */
export function generateToken(walletAddress) {
  return jwt.sign(
    { wallet: walletAddress, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify wallet signature
 * @param {string} walletAddress - Base58 public key
 * @param {string} message - The message that was signed
 * @param {string} signature - Base58 encoded signature
 * @returns {boolean}
 */
export function verifyWalletSignature(walletAddress, message, signature) {
  try {
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
  } catch (e) {
    return false;
  }
}

/**
 * Decode and verify JWT token
 * @param {string} token
 * @returns {{ wallet: string } | null}
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Fastify auth hook — attach to routes that need authentication
 */
export async function authGuard(request, reply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      error: true,
      code: 'AUTH_REQUIRED',
      message: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return reply.code(401).send({
      error: true,
      code: 'AUTH_EXPIRED',
      message: 'Token expired or invalid — please re-authenticate',
    });
  }

  // Attach wallet to request
  request.wallet = decoded.wallet;
}

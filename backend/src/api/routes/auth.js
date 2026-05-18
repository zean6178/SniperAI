/**
 * Auth Routes — Wallet-based authentication
 */

import { generateToken, verifyWalletSignature, authGuard } from '../middleware/auth.js';

export default async function authRoutes(fastify) {

  /**
   * POST /auth/login
   * Authenticate with wallet signature
   */
  fastify.post('/login', async (request, reply) => {
    const { walletAddress, signature, message } = request.body || {};

    if (!walletAddress || !signature || !message) {
      return reply.code(400).send({
        error: true,
        code: 'INVALID_REQUEST',
        message: 'Missing walletAddress, signature, or message',
      });
    }

    // Verify the message is a valid auth message
    const expectedPrefix = 'SniperAI Auth:';
    if (!message.startsWith(expectedPrefix)) {
      return reply.code(400).send({
        error: true,
        code: 'INVALID_MESSAGE',
        message: 'Message must start with "SniperAI Auth:"',
      });
    }

    // Check timestamp in message to prevent replay attacks (5 min window)
    const timestampMatch = message.match(/timestamp:(\d+)/);
    if (timestampMatch) {
      const msgTimestamp = parseInt(timestampMatch[1]);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - msgTimestamp) > 300) {
        return reply.code(400).send({
          error: true,
          code: 'MESSAGE_EXPIRED',
          message: 'Auth message expired (>5 min old)',
        });
      }
    }

    // Verify signature
    const isValid = verifyWalletSignature(walletAddress, message, signature);

    if (!isValid) {
      return reply.code(401).send({
        error: true,
        code: 'INVALID_SIGNATURE',
        message: 'Wallet signature verification failed',
      });
    }

    // Generate JWT
    const token = generateToken(walletAddress);

    return {
      token,
      wallet: walletAddress,
      expiresIn: '7d',
    };
  });

  /**
   * GET /auth/me
   * Get current authenticated wallet
   */
  fastify.get('/me', {
    preHandler: [authGuard],
  }, async (request) => {
    return { wallet: request.wallet };
  });
}

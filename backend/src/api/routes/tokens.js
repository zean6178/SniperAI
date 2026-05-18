/**
 * Token Routes — Feed, detail, trending
 */

import { authGuard } from '../middleware/auth.js';
import { getTokenFeed, getTokenDetail, getTrendingTokens, getTokenHistory } from '../../services/detector-service.js';

export default async function tokenRoutes(fastify) {

  /**
   * GET /tokens/feed
   * Real-time scored token feed
   */
  fastify.get('/feed', { preHandler: [authGuard] }, async (request) => {
    const { minScore = 0, limit = 20, offset = 0, sortBy = 'time' } = request.query;

    const tokens = getTokenFeed({
      minScore: parseInt(minScore),
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
    });

    return {
      tokens,
      total: tokens.length,
      hasMore: tokens.length === parseInt(limit),
    };
  });

  /**
   * GET /tokens/trending
   * Top trending tokens right now
   */
  fastify.get('/trending', { preHandler: [authGuard] }, async (request) => {
    const { timeframe = '5m', limit = 10 } = request.query;

    const tokens = getTrendingTokens({
      timeframe,
      limit: parseInt(limit),
    });

    return {
      tokens,
      updatedAt: new Date().toISOString(),
    };
  });

  /**
   * GET /tokens/history
   * Historical token detections with outcomes
   */
  fastify.get('/history', { preHandler: [authGuard] }, async (request) => {
    const { date, minScore = 0, outcome = 'all', limit = 50 } = request.query;

    const tokens = getTokenHistory({
      date,
      minScore: parseInt(minScore),
      outcome,
      limit: parseInt(limit),
    });

    return { tokens };
  });

  /**
   * GET /tokens/:mint
   * Detailed token info + live data
   */
  fastify.get('/:mint', { preHandler: [authGuard] }, async (request, reply) => {
    const { mint } = request.params;

    if (!mint || mint.length < 32) {
      return reply.code(400).send({
        error: true,
        code: 'INVALID_MINT',
        message: 'Invalid token mint address',
      });
    }

    const detail = await getTokenDetail(mint);

    if (!detail) {
      return reply.code(404).send({
        error: true,
        code: 'TOKEN_NOT_FOUND',
        message: 'Token not found in our database',
      });
    }

    return detail;
  });
}

/**
 * Rate Limiting Middleware
 */

const requestCounts = new Map(); // wallet → { count, resetAt }

const TIERS = {
  free: { maxPerMinute: 30 },
  premium: { maxPerMinute: 120 },
};

/**
 * Simple in-memory rate limiter (replace with Redis in production)
 */
export async function rateLimiter(request, reply) {
  const wallet = request.wallet || request.ip;
  const tier = 'free'; // TODO: lookup user tier
  const limit = TIERS[tier].maxPerMinute;

  const now = Date.now();
  const entry = requestCounts.get(wallet);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(wallet, { count: 1, resetAt: now + 60000 });
    return;
  }

  entry.count++;
  if (entry.count > limit) {
    return reply.code(429).send({
      error: true,
      code: 'RATE_LIMITED',
      message: `Rate limit exceeded: ${limit} requests/min`,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }
}

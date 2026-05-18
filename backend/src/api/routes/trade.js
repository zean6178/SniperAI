/**
 * Trade Routes — Buy/sell execution
 * 
 * Flow:
 * 1. Mobile app calls prepare-buy → gets unsigned transaction
 * 2. Mobile signs with Seed Vault
 * 3. Mobile calls submit → backend broadcasts to network
 */

import { authGuard } from '../middleware/auth.js';
import { prepareBuyTransaction, prepareSellTransaction, submitTransaction } from '../../services/trade-service.js';
import { preTradeRiskCheck, calculateBuyAmount } from '../../../../risk.js';
// Path: backend/src/api/routes/ → ../../../../ = SniperAI root ✓

export default async function tradeRoutes(fastify) {

  /**
   * POST /trade/prepare-buy
   * Construct unsigned buy transaction for mobile signing
   */
  fastify.post('/prepare-buy', { preHandler: [authGuard] }, async (request, reply) => {
    const { mint, amountSol, slippageBps = 1500 } = request.body || {};

    if (!mint || !amountSol) {
      return reply.code(400).send({
        error: true,
        code: 'INVALID_REQUEST',
        message: 'Missing mint or amountSol',
      });
    }

    if (amountSol <= 0 || amountSol > 10) {
      return reply.code(400).send({
        error: true,
        code: 'INVALID_AMOUNT',
        message: 'Amount must be between 0 and 10 SOL',
      });
    }

    // Risk check
    const riskCheck = await preTradeRiskCheck();
    if (!riskCheck.canTrade) {
      return reply.code(403).send({
        error: true,
        code: 'RISK_BLOCKED',
        message: 'Trade blocked by risk management',
        details: { reasons: riskCheck.reasons },
      });
    }

    try {
      const result = await prepareBuyTransaction({
        wallet: request.wallet,
        mint,
        amountSol: parseFloat(amountSol),
        slippageBps: parseInt(slippageBps),
      });

      return {
        transaction: result.transaction, // base64 unsigned tx
        estimatedTokens: result.estimatedTokens,
        estimatedPriceImpact: result.priceImpact,
        fee: result.fee,
        expiresAt: new Date(Date.now() + 30000).toISOString(), // 30s expiry
      };
    } catch (e) {
      return reply.code(500).send({
        error: true,
        code: 'TX_FAILED',
        message: `Failed to prepare transaction: ${e.message}`,
      });
    }
  });

  /**
   * POST /trade/submit
   * Submit signed buy transaction to blockchain
   */
  fastify.post('/submit', { preHandler: [authGuard] }, async (request, reply) => {
    const { signedTransaction, mint, amountSol } = request.body || {};

    if (!signedTransaction || !mint) {
      return reply.code(400).send({
        error: true,
        code: 'INVALID_REQUEST',
        message: 'Missing signedTransaction or mint',
      });
    }

    try {
      const result = await submitTransaction({
        signedTransaction,
        mint,
        amountSol: parseFloat(amountSol || 0),
        wallet: request.wallet,
        type: 'buy',
      });

      return {
        success: true,
        txHash: result.txHash,
        position: result.position,
      };
    } catch (e) {
      return reply.code(500).send({
        error: true,
        code: 'TX_FAILED',
        message: `Transaction failed: ${e.message}`,
      });
    }
  });

  /**
   * POST /trade/prepare-sell
   * Construct unsigned sell transaction
   */
  fastify.post('/prepare-sell', { preHandler: [authGuard] }, async (request, reply) => {
    const { mint, sellPct = 100, slippageBps = 1500 } = request.body || {};

    if (!mint) {
      return reply.code(400).send({
        error: true,
        code: 'INVALID_REQUEST',
        message: 'Missing mint',
      });
    }

    if (sellPct <= 0 || sellPct > 100) {
      return reply.code(400).send({
        error: true,
        code: 'INVALID_AMOUNT',
        message: 'sellPct must be between 1 and 100',
      });
    }

    try {
      const result = await prepareSellTransaction({
        wallet: request.wallet,
        mint,
        sellPct: parseInt(sellPct),
        slippageBps: parseInt(slippageBps),
      });

      return {
        transaction: result.transaction,
        estimatedSolReceived: result.estimatedSolReceived,
        estimatedPnl: result.estimatedPnl,
        expiresAt: new Date(Date.now() + 30000).toISOString(),
      };
    } catch (e) {
      return reply.code(500).send({
        error: true,
        code: 'TX_FAILED',
        message: `Failed to prepare sell: ${e.message}`,
      });
    }
  });

  /**
   * POST /trade/submit-sell
   * Submit signed sell transaction
   */
  fastify.post('/submit-sell', { preHandler: [authGuard] }, async (request, reply) => {
    const { signedTransaction, mint, sellPct } = request.body || {};

    if (!signedTransaction || !mint) {
      return reply.code(400).send({
        error: true,
        code: 'INVALID_REQUEST',
        message: 'Missing signedTransaction or mint',
      });
    }

    try {
      const result = await submitTransaction({
        signedTransaction,
        mint,
        sellPct: parseInt(sellPct || 100),
        wallet: request.wallet,
        type: 'sell',
      });

      return {
        success: true,
        txHash: result.txHash,
        solReceived: result.solReceived,
        pnlSol: result.pnlSol,
        remainingPct: result.remainingPct,
      };
    } catch (e) {
      return reply.code(500).send({
        error: true,
        code: 'TX_FAILED',
        message: `Sell transaction failed: ${e.message}`,
      });
    }
  });
}

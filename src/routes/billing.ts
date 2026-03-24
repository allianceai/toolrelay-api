import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { requireApiKey } from '../middleware/auth';
import { logger } from '../services/logger';

const router = Router();

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2023-10-16' as any,
  });
}

const PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
};

/**
 * POST /v1/billing/checkout
 * Creates a Stripe Checkout session for upgrading to a paid tier.
 * Body: { tier: 'starter' | 'pro' | 'enterprise', successUrl: string, cancelUrl: string }
 */
router.post('/checkout', requireApiKey, async (req: Request, res: Response) => {
  const { tier, successUrl, cancelUrl } = req.body as {
    tier?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!tier || !PRICE_IDS[tier]) {
    res.status(400).json({
      error: 'Invalid tier. Must be one of: starter, pro, enterprise',
      code: 'INVALID_TIER',
    });
    return;
  }

  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    res.status(503).json({
      error: 'Billing not configured on this server',
      code: 'BILLING_NOT_CONFIGURED',
    });
    return;
  }

  try {
    const stripe = getStripe();
    const apiKey = req.apiKey!;

    // Get or create a Stripe customer tied to this API key owner
    let customerId = apiKey.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { ownerId: apiKey.ownerId, keyId: apiKey.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl ?? `${process.env.APP_URL ?? 'https://toolrelay.dev'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${process.env.APP_URL ?? 'https://toolrelay.dev'}/billing/cancel`,
      metadata: { keyId: apiKey.id, ownerId: apiKey.ownerId, tier },
      subscription_data: {
        metadata: { keyId: apiKey.id, ownerId: apiKey.ownerId },
      },
    });

    logger.info('Checkout session created', {
      sessionId: session.id,
      tier,
      keyId: apiKey.id,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error('Failed to create checkout session', { err });
    res.status(500).json({ error: 'Failed to create checkout session', code: 'STRIPE_ERROR' });
  }
});

/**
 * GET /v1/billing/portal
 * Returns a Stripe Customer Portal URL for self-serve billing management.
 */
router.get('/portal', requireApiKey, async (req: Request, res: Response) => {
  const apiKey = req.apiKey!;

  if (!apiKey.stripeCustomerId) {
    res.status(404).json({
      error: 'No billing account found. Create a subscription first.',
      code: 'NO_BILLING_ACCOUNT',
    });
    return;
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: apiKey.stripeCustomerId,
      return_url: `${process.env.APP_URL ?? 'https://toolrelay.dev'}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error('Failed to create billing portal session', { err });
    res.status(500).json({ error: 'Failed to open billing portal', code: 'STRIPE_ERROR' });
  }
});

/**
 * GET /v1/billing/plans
 * Returns available plans (public, no auth required).
 */
router.get('/plans', (_req: Request, res: Response) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'usd',
        interval: null,
        executions: 1000,
        rateLimit: '10 req/min',
        concurrentSessions: 2,
        features: ['1,000 executions/month', 'Community support', '2 concurrent sessions'],
      },
      {
        id: 'starter',
        name: 'Starter',
        price: 2900,
        currency: 'usd',
        interval: 'month',
        priceId: process.env.STRIPE_STARTER_PRICE_ID,
        executions: 10000,
        rateLimit: '60 req/min',
        concurrentSessions: 5,
        features: ['10,000 executions/month', 'Email support', '5 concurrent sessions', 'Usage analytics'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 9900,
        currency: 'usd',
        interval: 'month',
        priceId: process.env.STRIPE_PRO_PRICE_ID,
        executions: 100000,
        rateLimit: '300 req/min',
        concurrentSessions: 20,
        features: ['100,000 executions/month', 'Priority support', '20 concurrent sessions', 'Advanced analytics', 'Webhook delivery'],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 49900,
        currency: 'usd',
        interval: 'month',
        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
        executions: -1,
        rateLimit: 'Unlimited',
        concurrentSessions: -1,
        features: ['Unlimited executions', 'Dedicated support', 'Unlimited concurrency', 'SLA guarantee', 'Custom integrations'],
      },
    ],
  });
});

export default router;

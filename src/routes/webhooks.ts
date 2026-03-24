import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { updateKeyTier } from '../services/keyService';
import { logger } from '../services/logger';
import { Tier } from '../types';

const router = Router();

// Map Stripe price IDs to tiers
const PRICE_TO_TIER: Record<string, Tier> = {
  [process.env.STRIPE_STARTER_PRICE_ID ?? 'price_starter']: 'starter',
  [process.env.STRIPE_PRO_PRICE_ID ?? 'price_pro']: 'pro',
  [process.env.STRIPE_ENTERPRISE_PRICE_ID ?? 'price_enterprise']: 'enterprise',
};

function getTierFromSubscription(subscription: Stripe.Subscription): Tier {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  return PRICE_TO_TIER[priceId] ?? 'free';
}

// POST /v1/webhooks/stripe
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (!webhookSecret || !sig) {
    // In dev mode, parse body directly
    event = req.body as Stripe.Event;
  } else {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
        apiVersion: '2023-10-16' as any,
      });
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody ?? JSON.stringify(req.body),
        sig,
        webhookSecret
      );
    } catch (err) {
      logger.error('Stripe webhook signature verification failed', { err });
      res.status(400).json({ error: 'Webhook signature invalid' });
      return;
    }
  }

  logger.info('Stripe webhook received', { type: event.type, id: event.id });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      logger.info('Checkout completed', {
        customerId: session.customer,
        subscriptionId: session.subscription,
      });
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const tier = getTierFromSubscription(subscription);
      const customerId = subscription.customer as string;
      await updateKeyTier(customerId, tier);
      logger.info('Subscription updated', { customerId, tier });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      await updateKeyTier(customerId, 'free');
      logger.info('Subscription cancelled, downgraded to free', { customerId });
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      // Quota resets automatically each month via the usage:keyId:YYYY-MM key pattern.
      // Here we just log the renewal for audit purposes.
      logger.info('Invoice paid — monthly quota renewed', {
        customerId,
        invoiceId: invoice.id,
        amount: invoice.amount_paid,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      logger.warn('Payment failed — consider downgrading after grace period', {
        customerId,
        amount: invoice.amount_due,
        attemptCount: invoice.attempt_count,
      });
      // After 3 failures Stripe will cancel the subscription → triggers customer.subscription.deleted
      break;
    }

    default:
      logger.debug('Unhandled webhook event', { type: event.type });
  }

  res.json({ received: true });
});

export default router;

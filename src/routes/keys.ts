import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireApiKey } from '../middleware/auth';
import { createKey, listKeys, revokeKey } from '../services/keyService';
import { Tier } from '../types';

const router = Router();

const CreateKeySchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(['free', 'starter', 'pro', 'enterprise']).default('free'),
  ownerId: z.string().min(1),
});

// POST /v1/keys — create new API key
// Note: In production this would be authenticated via a session/admin token.
// For simplicity the caller provides their ownerId.
router.post('/', async (req: Request, res: Response) => {
  const parsed = CreateKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { name, tier, ownerId } = parsed.data;
  const stripeCustomerId = req.body.stripeCustomerId as string | undefined;

  const { key, rawKey } = await createKey(name, tier as Tier, ownerId, stripeCustomerId);

  // Return the raw key only once
  res.status(201).json({
    id: key.id,
    name: key.name,
    tier: key.tier,
    keyPrefix: key.keyPrefix,
    apiKey: rawKey, // shown only once — store it securely
    createdAt: key.createdAt,
    message: 'Store this API key securely — it will not be shown again.',
  });
});

// GET /v1/keys — list keys for an owner
router.get('/', requireApiKey, async (req: Request, res: Response) => {
  const ownerId = req.apiKey!.ownerId;
  const keys = await listKeys(ownerId);
  res.json({ keys });
});

// DELETE /v1/keys/:keyId — revoke a key
router.delete('/:keyId', requireApiKey, async (req: Request, res: Response) => {
  try {
    const revoked = await revokeKey(req.params.keyId, req.apiKey!.ownerId);
    if (!revoked) {
      res.status(404).json({ error: 'Key not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    if ((err as Error).message === 'Forbidden') {
      res.status(403).json({ error: 'You do not own this key', code: 'FORBIDDEN' });
      return;
    }
    throw err;
  }
});

export default router;

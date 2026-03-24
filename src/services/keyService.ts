import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { APIKey, Tier } from '../types';
import { storeGet, storeSet, storeDel, storeKeys } from './store';
import { activeKeys } from './metricsService';

const KEY_PREFIX = 'apikey:';

function generateRawKey(): string {
  // Format: tr_<tier_initial><random>
  const rand = uuidv4().replace(/-/g, '');
  return `tr_${rand}`;
}

export async function createKey(name: string, tier: Tier, ownerId: string, stripeCustomerId?: string): Promise<{ key: APIKey; rawKey: string }> {
  const rawKey = generateRawKey();
  const keyHash = await bcrypt.hash(rawKey, 10);

  const apiKey: APIKey = {
    id: uuidv4(),
    name,
    keyHash,
    keyPrefix: rawKey.slice(0, 8),
    tier,
    stripeCustomerId,
    ownerId,
    createdAt: new Date().toISOString(),
  };

  await storeSet(`${KEY_PREFIX}${apiKey.id}`, JSON.stringify(apiKey));
  // Also index by prefix for fast lookup
  await storeSet(`keypfx:${apiKey.keyPrefix}`, apiKey.id);

  activeKeys.inc({ tier });

  return { key: apiKey, rawKey };
}

export async function validateKey(rawKey: string): Promise<APIKey | null> {
  if (!rawKey || !rawKey.startsWith('tr_')) return null;

  const prefix = rawKey.slice(0, 8);
  const keyId = await storeGet(`keypfx:${prefix}`);
  if (!keyId) return null;

  const raw = await storeGet(`${KEY_PREFIX}${keyId}`);
  if (!raw) return null;

  const apiKey = JSON.parse(raw) as APIKey;
  if (apiKey.revokedAt) return null;

  const valid = await bcrypt.compare(rawKey, apiKey.keyHash);
  if (!valid) return null;

  // Update lastUsedAt
  apiKey.lastUsedAt = new Date().toISOString();
  await storeSet(`${KEY_PREFIX}${apiKey.id}`, JSON.stringify(apiKey));

  return apiKey;
}

export async function listKeys(ownerId: string): Promise<Omit<APIKey, 'keyHash'>[]> {
  const keys = await storeKeys(`${KEY_PREFIX}*`);
  const result: Omit<APIKey, 'keyHash'>[] = [];

  for (const k of keys) {
    const raw = await storeGet(k);
    if (raw) {
      const apiKey = JSON.parse(raw) as APIKey;
      if (apiKey.ownerId === ownerId && !apiKey.revokedAt) {
        const { keyHash: _, ...safe } = apiKey;
        result.push(safe);
      }
    }
  }

  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function revokeKey(keyId: string, requesterId: string): Promise<boolean> {
  const raw = await storeGet(`${KEY_PREFIX}${keyId}`);
  if (!raw) return false;

  const apiKey = JSON.parse(raw) as APIKey;
  if (apiKey.ownerId !== requesterId) throw new Error('Forbidden');

  apiKey.revokedAt = new Date().toISOString();
  await storeSet(`${KEY_PREFIX}${keyId}`, JSON.stringify(apiKey));
  await storeDel(`keypfx:${apiKey.keyPrefix}`);

  activeKeys.dec({ tier: apiKey.tier });

  return true;
}

export async function updateKeyTier(stripeCustomerId: string, newTier: Tier): Promise<void> {
  const keys = await storeKeys(`${KEY_PREFIX}*`);
  for (const k of keys) {
    const raw = await storeGet(k);
    if (raw) {
      const apiKey = JSON.parse(raw) as APIKey;
      if (apiKey.stripeCustomerId === stripeCustomerId && !apiKey.revokedAt) {
        const oldTier = apiKey.tier;
        apiKey.tier = newTier;
        await storeSet(k, JSON.stringify(apiKey));
        activeKeys.dec({ tier: oldTier });
        activeKeys.inc({ tier: newTier });
      }
    }
  }
}

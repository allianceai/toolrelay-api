import { TierConfig, Tier } from '../types';

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    executions: 1_000,
    rateLimit: 10,
    price: 0,
    concurrentConnections: 2,
  },
  starter: {
    executions: 10_000,
    rateLimit: 60,
    price: 2900,
    concurrentConnections: 5,
  },
  pro: {
    executions: 100_000,
    rateLimit: 300,
    price: 9900,
    concurrentConnections: 20,
  },
  enterprise: {
    executions: -1,
    rateLimit: -1,
    price: 49900,
    concurrentConnections: -1,
  },
};

export function getTierLimit(tier: Tier): TierConfig {
  return TIERS[tier] ?? TIERS.free;
}

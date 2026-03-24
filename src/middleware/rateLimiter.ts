import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { checkQuota } from '../services/usageService';
import { TIERS } from '../config/tiers';
import { errorsTotal } from '../services/metricsService';

// IP-based rate limit for unauthenticated requests
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});

// Per-tier rate limiter based on API key
export async function tierRateLimit(req: Request, res: Response, next: Function): Promise<void> {
  const apiKey = req.apiKey;
  if (!apiKey) {
    next();
    return;
  }

  const tierConfig = TIERS[apiKey.tier];

  // Check monthly quota
  const quota = await checkQuota(apiKey.id, apiKey.tier);
  if (!quota.allowed) {
    errorsTotal.inc({ error_type: 'quota_exceeded' });
    res.status(429).json({
      error: 'Monthly execution quota exceeded',
      code: 'QUOTA_EXCEEDED',
      used: quota.used,
      limit: quota.limit,
      upgrade: 'https://toolrelay.dev/upgrade',
    });
    return;
  }

  // Add quota headers
  res.setHeader('X-RateLimit-Tier', apiKey.tier);
  if (quota.limit !== -1) {
    res.setHeader('X-RateLimit-Limit', quota.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, quota.limit - quota.used));
  }

  next();
}

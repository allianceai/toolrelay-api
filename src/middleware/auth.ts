import { Request, Response, NextFunction } from 'express';
import { validateKey } from '../services/keyService';
import { errorsTotal } from '../services/metricsService';

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers['x-api-key'] ?? req.headers['authorization'];
  if (!header) {
    res.status(401).json({ error: 'Missing API key', code: 'UNAUTHORIZED' });
    return;
  }

  const rawKey = typeof header === 'string'
    ? header.replace(/^Bearer\s+/i, '')
    : '';

  const apiKey = await validateKey(rawKey);
  if (!apiKey) {
    errorsTotal.inc({ error_type: 'invalid_api_key' });
    res.status(401).json({ error: 'Invalid or revoked API key', code: 'UNAUTHORIZED' });
    return;
  }

  req.apiKey = apiKey;
  next();
}

// Relaxed auth for read-only endpoints (public tools list)
export async function optionalApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers['x-api-key'] ?? req.headers['authorization'];
  if (header) {
    const rawKey = typeof header === 'string'
      ? header.replace(/^Bearer\s+/i, '')
      : '';
    const apiKey = await validateKey(rawKey);
    if (apiKey) req.apiKey = apiKey;
  }
  next();
}

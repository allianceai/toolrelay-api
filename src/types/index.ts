export type Tier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface Tool {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  version: string;
  tags: string[];
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface APIKey {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  tier: Tier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  ownerId: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface ExecutionLog {
  id: string;
  keyId: string;
  toolId: string;
  durationMs: number;
  status: 'success' | 'error' | 'timeout';
  errorCode?: string;
  timestamp: string;
}

export interface UsageStats {
  keyId: string;
  period: { start: string; end: string };
  totalExecutions: number;
  successCount: number;
  errorCount: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  byTool: Record<string, { count: number; errorCount: number }>;
  byDay: Record<string, number>;
}

export interface TierConfig {
  executions: number;   // -1 = unlimited
  rateLimit: number;    // requests per minute, -1 = unlimited
  price: number;        // cents/month
  concurrentConnections: number;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

// Express augmentation
declare global {
  namespace Express {
    interface Request {
      apiKey?: APIKey;
    }
  }
}

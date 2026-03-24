import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { globalRateLimit } from './middleware/rateLimiter';
import { logger } from './services/logger';
import { initRedis } from './services/store';
import { seedBuiltinTools } from './services/toolRegistry';
import { getMetrics, getContentType } from './services/metricsService';

// Routes
import toolsRouter from './routes/tools';
import executeRouter from './routes/execute';
import keysRouter from './routes/keys';
import usageRouter from './routes/usage';
import webhooksRouter from './routes/webhooks';
import billingRouter from './routes/billing';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Stripe-Signature'],
}));

// ── Body parsing ─────────────────────────────────────────────────────────────
// Store rawBody for Stripe webhook signature verification
app.use('/v1/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(globalRateLimit);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: process.env.npm_package_version ?? '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Prometheus metrics ────────────────────────────────────────────────────────
app.get('/metrics', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', getContentType());
  res.send(await getMetrics());
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/v1/tools', toolsRouter);
app.use('/v1/execute', executeRouter);
app.use('/v1/keys', keysRouter);
app.use('/v1/usage', usageRouter);
app.use('/v1/webhooks', webhooksRouter);
app.use('/v1/billing', billingRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

// ── Startup ────────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await initRedis();
  await seedBuiltinTools();

  const server = app.listen(PORT, () => {
    logger.info(`🚀 ToolRelay API running on port ${PORT}`, {
      env: process.env.NODE_ENV ?? 'development',
      port: PORT,
    });
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});

export default app;

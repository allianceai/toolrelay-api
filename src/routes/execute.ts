import { Router, Request, Response } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { requireApiKey } from '../middleware/auth';
import { tierRateLimit } from '../middleware/rateLimiter';
import { getTool } from '../services/toolRegistry';
import { recordExecution } from '../services/usageService';
import { executionsTotal, executionDurationMs, errorsTotal } from '../services/metricsService';

const router = Router();

const EXECUTION_TIMEOUT_MS = 30_000;

router.use(requireApiKey);
router.use(tierRateLimit as any);

// POST /v1/execute/:toolId — execute a single tool
router.post('/:toolId', async (req: Request, res: Response) => {
  const { toolId } = req.params;
  const apiKey = req.apiKey!;
  const startTime = Date.now();

  const tool = await getTool(toolId);
  if (!tool) {
    res.status(404).json({ error: 'Tool not found', code: 'NOT_FOUND' });
    return;
  }

  try {
    const response = await axios.post(tool.endpoint, req.body, {
      timeout: EXECUTION_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'X-ToolRelay-Key': apiKey.id,
        'X-ToolRelay-Tool': toolId,
      },
    });

    const durationMs = Date.now() - startTime;

    await recordExecution(apiKey.id, toolId, durationMs, 'success');
    executionsTotal.inc({ tool_id: toolId, status: 'success', tier: apiKey.tier });
    executionDurationMs.observe({ tool_id: toolId, tier: apiKey.tier }, durationMs);

    res.json({
      toolId,
      result: response.data,
      meta: {
        durationMs,
        tier: apiKey.tier,
      },
    });
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const isTimeout = axios.isAxiosError(err) && err.code === 'ECONNABORTED';
    const status = isTimeout ? 'timeout' : 'error';
    const errorCode = isTimeout ? 'TOOL_TIMEOUT' : 'TOOL_ERROR';

    await recordExecution(apiKey.id, toolId, durationMs, status, errorCode);
    executionsTotal.inc({ tool_id: toolId, status, tier: apiKey.tier });
    errorsTotal.inc({ error_type: errorCode });

    res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'Tool execution timed out' : 'Tool execution failed',
      code: errorCode,
      durationMs,
    });
  }
});

// POST /v1/execute/batch — execute multiple tools in parallel
const BatchSchema = z.object({
  executions: z.array(
    z.object({
      toolId: z.string(),
      input: z.record(z.unknown()),
    })
  ).min(1).max(10),
});

router.post('/batch', async (req: Request, res: Response) => {
  const parsed = BatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const apiKey = req.apiKey!;

  const results = await Promise.allSettled(
    parsed.data.executions.map(async ({ toolId, input }) => {
      const startTime = Date.now();
      const tool = await getTool(toolId);
      if (!tool) throw { code: 'NOT_FOUND', toolId };

      const response = await axios.post(tool.endpoint, input, {
        timeout: EXECUTION_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      });

      const durationMs = Date.now() - startTime;
      await recordExecution(apiKey.id, toolId, durationMs, 'success');
      executionsTotal.inc({ tool_id: toolId, status: 'success', tier: apiKey.tier });

      return { toolId, result: response.data, durationMs };
    })
  );

  const response = results.map((r, i) => {
    if (r.status === 'fulfilled') return { ...r.value, status: 'success' };
    return {
      toolId: parsed.data.executions[i].toolId,
      status: 'error',
      error: String(r.reason),
    };
  });

  res.json({ results: response });
});

export default router;

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireApiKey, optionalApiKey } from '../middleware/auth';
import { registerTool, getTool, listTools, deleteTool } from '../services/toolRegistry';
import { registeredTools } from '../services/metricsService';

const router = Router();

const RegisterToolSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(500),
  endpoint: z.string().url(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional().default({}),
  version: z.string().default('1.0.0'),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
});

// GET /v1/tools — list available tools
router.get('/', optionalApiKey, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string ?? '1', 10);
  const limit = Math.min(parseInt(req.query.limit as string ?? '20', 10), 100);
  const tag = req.query.tag as string | undefined;

  const { tools, total } = await listTools(page, limit, tag);

  res.json({
    tools,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// GET /v1/tools/:toolId — get tool schema
router.get('/:toolId', optionalApiKey, async (req: Request, res: Response) => {
  const tool = await getTool(req.params.toolId);
  if (!tool) {
    res.status(404).json({ error: 'Tool not found', code: 'NOT_FOUND' });
    return;
  }
  res.json(tool);
});

// POST /v1/tools/register — register a new tool
router.post('/register', requireApiKey, async (req: Request, res: Response) => {
  const parsed = RegisterToolSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const tool = await registerTool({
    ...parsed.data,
    outputSchema: parsed.data.outputSchema ?? {},
    ownerId: req.apiKey!.ownerId,
  });

  registeredTools.inc();

  res.status(201).json(tool);
});

// DELETE /v1/tools/:toolId — unregister a tool
router.delete('/:toolId', requireApiKey, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteTool(req.params.toolId, req.apiKey!.ownerId);
    if (!deleted) {
      res.status(404).json({ error: 'Tool not found', code: 'NOT_FOUND' });
      return;
    }
    registeredTools.dec();
    res.status(204).send();
  } catch (err) {
    if ((err as Error).message === 'Forbidden') {
      res.status(403).json({ error: 'You do not own this tool', code: 'FORBIDDEN' });
      return;
    }
    throw err;
  }
});

export default router;

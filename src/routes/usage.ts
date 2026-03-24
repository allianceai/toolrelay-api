import { Router, Request, Response } from 'express';
import { requireApiKey } from '../middleware/auth';
import { getUsageStats, exportLogsCSV } from '../services/usageService';

const router = Router();

router.use(requireApiKey);

// GET /v1/usage — get usage stats
router.get('/', async (req: Request, res: Response) => {
  const apiKey = req.apiKey!;

  // Default: current month
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const startDate = (req.query.start as string) ?? defaultStart;
  const endDate = (req.query.end as string) ?? defaultEnd;

  const stats = await getUsageStats(apiKey.id, startDate, endDate);

  res.json({
    ...stats,
    tier: apiKey.tier,
  });
});

// GET /v1/usage/export — export CSV
router.get('/export', async (req: Request, res: Response) => {
  const csv = exportLogsCSV(req.apiKey!.id);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="toolrelay-usage.csv"');
  res.send(csv);
});

export default router;

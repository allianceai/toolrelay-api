import { v4 as uuidv4 } from 'uuid';
import { ExecutionLog, UsageStats, Tier } from '../types';
import { storeGet, storeSet } from './store';
import { TIERS } from '../config/tiers';

// In-memory execution log (rings at 100k entries)
const executionLogs: ExecutionLog[] = [];
const MAX_LOGS = 100_000;

export async function recordExecution(
  keyId: string,
  toolId: string,
  durationMs: number,
  status: ExecutionLog['status'],
  errorCode?: string
): Promise<void> {
  const log: ExecutionLog = {
    id: uuidv4(),
    keyId,
    toolId,
    durationMs,
    status,
    errorCode,
    timestamp: new Date().toISOString(),
  };

  executionLogs.push(log);
  if (executionLogs.length > MAX_LOGS) executionLogs.shift();

  // Increment monthly counter in store
  const monthKey = `usage:${keyId}:${new Date().toISOString().slice(0, 7)}`;
  const current = parseInt((await storeGet(monthKey)) ?? '0', 10);
  await storeSet(monthKey, String(current + 1));
}

export async function getUsageStats(
  keyId: string,
  startDate: string,
  endDate: string
): Promise<UsageStats> {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  const relevant = executionLogs.filter((l) => {
    const t = new Date(l.timestamp).getTime();
    return l.keyId === keyId && t >= start && t <= end;
  });

  const durations = relevant
    .filter((l) => l.status === 'success')
    .map((l) => l.durationMs)
    .sort((a, b) => a - b);

  const p = (pct: number) => {
    if (!durations.length) return 0;
    const idx = Math.floor(durations.length * pct);
    return durations[Math.min(idx, durations.length - 1)];
  };

  const byTool: Record<string, { count: number; errorCount: number }> = {};
  const byDay: Record<string, number> = {};

  for (const log of relevant) {
    if (!byTool[log.toolId]) byTool[log.toolId] = { count: 0, errorCount: 0 };
    byTool[log.toolId].count++;
    if (log.status === 'error') byTool[log.toolId].errorCount++;

    const day = log.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  return {
    keyId,
    period: { start: startDate, end: endDate },
    totalExecutions: relevant.length,
    successCount: relevant.filter((l) => l.status === 'success').length,
    errorCount: relevant.filter((l) => l.status === 'error').length,
    p50LatencyMs: p(0.5),
    p95LatencyMs: p(0.95),
    byTool,
    byDay,
  };
}

export async function checkQuota(keyId: string, tier: Tier): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = TIERS[tier].executions;
  if (limit === -1) return { allowed: true, used: 0, limit: -1 };

  const monthKey = `usage:${keyId}:${new Date().toISOString().slice(0, 7)}`;
  const used = parseInt((await storeGet(monthKey)) ?? '0', 10);

  return { allowed: used < limit, used, limit };
}

export function exportLogsCSV(keyId: string): string {
  const relevant = executionLogs.filter((l) => l.keyId === keyId);
  const header = 'id,toolId,durationMs,status,errorCode,timestamp';
  const rows = relevant.map(
    (l) => `${l.id},${l.toolId},${l.durationMs},${l.status},${l.errorCode ?? ''},${l.timestamp}`
  );
  return [header, ...rows].join('\n');
}

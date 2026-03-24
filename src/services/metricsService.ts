import client from 'prom-client';

// Enable default Node.js metrics
client.collectDefaultMetrics({ prefix: 'toolrelay_node_' });

// Custom metrics
export const executionsTotal = new client.Counter({
  name: 'toolrelay_executions_total',
  help: 'Total number of tool executions',
  labelNames: ['tool_id', 'status', 'tier'] as const,
});

export const executionDurationMs = new client.Histogram({
  name: 'toolrelay_execution_duration_ms',
  help: 'Tool execution duration in milliseconds',
  labelNames: ['tool_id', 'tier'] as const,
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

export const activeKeys = new client.Gauge({
  name: 'toolrelay_active_keys',
  help: 'Number of active API keys',
  labelNames: ['tier'] as const,
});

export const errorsTotal = new client.Counter({
  name: 'toolrelay_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type'] as const,
});

export const registeredTools = new client.Gauge({
  name: 'toolrelay_registered_tools',
  help: 'Number of registered tools',
});

export async function getMetrics(): Promise<string> {
  return client.register.metrics();
}

export function getContentType(): string {
  return client.register.contentType;
}

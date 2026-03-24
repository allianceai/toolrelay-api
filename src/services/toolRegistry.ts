import { v4 as uuidv4 } from 'uuid';
import { Tool } from '../types';
import { storeGet, storeSet, storeDel, storeKeys } from './store';

const TOOL_PREFIX = 'tool:';

export async function registerTool(data: Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tool> {
  const tool: Tool = {
    ...data,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await storeSet(`${TOOL_PREFIX}${tool.id}`, JSON.stringify(tool));
  return tool;
}

export async function getTool(toolId: string): Promise<Tool | null> {
  const raw = await storeGet(`${TOOL_PREFIX}${toolId}`);
  return raw ? (JSON.parse(raw) as Tool) : null;
}

export async function listTools(page = 1, limit = 20, tag?: string): Promise<{ tools: Tool[]; total: number }> {
  const keys = await storeKeys(`${TOOL_PREFIX}*`);
  const all: Tool[] = [];

  for (const key of keys) {
    const raw = await storeGet(key);
    if (raw) {
      const tool = JSON.parse(raw) as Tool;
      if (!tag || tool.tags.includes(tag)) all.push(tool);
    }
  }

  all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const start = (page - 1) * limit;
  return {
    tools: all.slice(start, start + limit),
    total: all.length,
  };
}

export async function deleteTool(toolId: string, requesterId: string): Promise<boolean> {
  const tool = await getTool(toolId);
  if (!tool) return false;
  if (tool.ownerId !== requesterId) throw new Error('Forbidden');
  await storeDel(`${TOOL_PREFIX}${toolId}`);
  return true;
}

// Seed a few built-in demo tools on startup
export async function seedBuiltinTools(): Promise<void> {
  const builtins: Array<Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>> = [
    {
      name: 'web-search',
      description: 'Search the web and return summarized results',
      endpoint: 'https://api.toolrelay.dev/builtins/web-search',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, numResults: { type: 'number', default: 5 } },
        required: ['query'],
      },
      outputSchema: { type: 'object', properties: { results: { type: 'array' } } },
      version: '1.0.0',
      tags: ['search', 'web', 'builtin'],
      ownerId: 'system',
      isPublic: true,
    },
    {
      name: 'code-executor',
      description: 'Execute Python code in a sandboxed environment',
      endpoint: 'https://api.toolrelay.dev/builtins/code-executor',
      inputSchema: {
        type: 'object',
        properties: { code: { type: 'string' }, timeout: { type: 'number', default: 10 } },
        required: ['code'],
      },
      outputSchema: { type: 'object', properties: { stdout: { type: 'string' }, stderr: { type: 'string' }, exitCode: { type: 'number' } } },
      version: '1.0.0',
      tags: ['code', 'python', 'builtin'],
      ownerId: 'system',
      isPublic: true,
    },
    {
      name: 'url-scraper',
      description: 'Scrape and extract text content from a URL',
      endpoint: 'https://api.toolrelay.dev/builtins/url-scraper',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' }, selector: { type: 'string' } },
        required: ['url'],
      },
      outputSchema: { type: 'object', properties: { text: { type: 'string' }, title: { type: 'string' } } },
      version: '1.0.0',
      tags: ['scraping', 'web', 'builtin'],
      ownerId: 'system',
      isPublic: true,
    },
  ];

  for (const tool of builtins) {
    await registerTool(tool);
  }
}

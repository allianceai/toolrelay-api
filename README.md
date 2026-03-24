# ToolRelay API

> Universal tool-execution proxy and registry for AI agent developers.

ToolRelay is the **picks-and-shovels** infrastructure layer for the AI agent economy. Instead of hard-coding tool integrations into every agent, register tools once and call them from any agent via a single, unified API.

---

## Quickstart

### 1. Get an API key

```bash
curl -X POST https://api.toolrelay.dev/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "tier": "free", "ownerId": "your-user-id"}'
```

Response:
```json
{
  "id": "key_...",
  "apiKey": "tr_abc123...",
  "tier": "free",
  "message": "Store this API key securely — it will not be shown again."
}
```

### 2. List available tools

```bash
curl https://api.toolrelay.dev/v1/tools \
  -H "X-API-Key: tr_abc123..."
```

### 3. Execute a tool

```bash
curl -X POST https://api.toolrelay.dev/v1/execute/web-search \
  -H "X-API-Key: tr_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"query": "latest AI agent frameworks 2026"}'
```

### 4. Batch execute (up to 10 tools in parallel)

```bash
curl -X POST https://api.toolrelay.dev/v1/execute/batch \
  -H "X-API-Key: tr_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "executions": [
      {"toolId": "web-search", "input": {"query": "OpenAI news"}},
      {"toolId": "url-scraper", "input": {"url": "https://example.com"}}
    ]
  }'
```

### 5. Register your own tool

```bash
curl -X POST https://api.toolrelay.dev/v1/tools/register \
  -H "X-API-Key: tr_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-custom-tool",
    "description": "Does something useful for my agents",
    "endpoint": "https://my-service.com/execute",
    "inputSchema": {"type": "object", "properties": {"input": {"type": "string"}}, "required": ["input"]},
    "tags": ["custom"],
    "isPublic": false
  }'
```

---

## API Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/health` | Health check | None |
| `GET` | `/metrics` | Prometheus metrics | None |
| `GET` | `/v1/tools` | List tools | Optional |
| `GET` | `/v1/tools/:id` | Get tool schema | Optional |
| `POST` | `/v1/tools/register` | Register a tool | Required |
| `DELETE` | `/v1/tools/:id` | Unregister a tool | Required |
| `POST` | `/v1/execute/:toolId` | Execute a tool | Required |
| `POST` | `/v1/execute/batch` | Batch execute tools | Required |
| `POST` | `/v1/keys` | Create API key | None |
| `GET` | `/v1/keys` | List your keys | Required |
| `DELETE` | `/v1/keys/:id` | Revoke a key | Required |
| `GET` | `/v1/usage` | Usage statistics | Required |
| `GET` | `/v1/usage/export` | Export usage CSV | Required |
| `GET` | `/v1/billing/plans` | View pricing plans | None |
| `POST` | `/v1/billing/checkout` | Start a subscription | Required |
| `GET` | `/v1/billing/portal` | Manage billing (portal) | Required |
| `POST` | `/v1/webhooks/stripe` | Stripe billing events | Stripe sig |

---

## Pricing

| Tier | Executions/mo | Rate Limit | Price |
|------|--------------|------------|-------|
| **Free** | 1,000 | 10 req/min | $0 |
| **Starter** | 10,000 | 60 req/min | $29/mo |
| **Pro** | 100,000 | 300 req/min | $99/mo |
| **Enterprise** | Unlimited | Unlimited | $499/mo |

Response headers include `X-RateLimit-Tier`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining`.

---

## Self-Hosting

### Docker Compose (recommended)

```bash
git clone https://github.com/your-org/toolrelay-api
cd toolrelay-api
cp .env.example .env
# Fill in STRIPE_SECRET_KEY etc.
docker compose up -d
```

The API will be available at `http://localhost:3000`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `production` or `development` |
| `STRIPE_SECRET_KEY` | Yes (billing) | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes (billing) | Stripe webhook signing secret |
| `STRIPE_STARTER_PRICE_ID` | Yes (billing) | Stripe price ID for Starter tier |
| `STRIPE_PRO_PRICE_ID` | Yes (billing) | Stripe price ID for Pro tier |
| `REDIS_URL` | No | Redis connection URL (in-memory fallback if unset) |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, `error` |

---

## Monitoring

- **Health**: `GET /health` — returns `{"status":"ok"}`
- **Metrics**: `GET /metrics` — Prometheus format
  - `toolrelay_executions_total` — by tool, status, tier
  - `toolrelay_execution_duration_ms` — histogram
  - `toolrelay_active_keys` — by tier
  - `toolrelay_errors_total` — by error type
  - `toolrelay_registered_tools` — gauge

Connect Grafana to the `/metrics` endpoint for dashboards.

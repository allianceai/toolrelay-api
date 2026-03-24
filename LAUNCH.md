# ToolRelay API — Launch Checklist

## Current Status ✅

| Item | Status |
|------|--------|
| API code built and tested | ✅ |
| GitHub repo pushed | ✅ `github.com/allianceai/toolrelay-api` |
| CI pipeline (GitHub Actions) | ✅ build + tests pass |
| Docker + docker-compose | ✅ ready |
| Render blueprint (render.yaml) | ✅ ready |
| Monitoring stack (Prometheus + Grafana) | ✅ ready |
| Billing routes coded | ✅ `/v1/billing/plans`, `/v1/billing/checkout`, `/v1/billing/portal` |
| Stripe setup script | ✅ `scripts/setup-stripe.sh` |

## Step 1 — Create Stripe Products (5 min)

```bash
cd toolrelay-api
STRIPE_SECRET_KEY=sk_live_YOUR_KEY bash scripts/setup-stripe.sh
```

This prints three price IDs. Copy them for Step 2.

## Step 2 — Deploy to Render (3 min)

1. Go to [render.com/dashboard](https://render.com/dashboard) → **New → Blueprint**
2. Connect `github.com/allianceai/toolrelay-api`
3. Render auto-detects `render.yaml` and creates:
   - Web service: `toolrelay-api`
   - Redis: `toolrelay-redis`
4. In the Render dashboard, set these environment variables:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_STARTER_PRICE_ID=price_...  (from Step 1)
   STRIPE_PRO_PRICE_ID=price_...      (from Step 1)
   STRIPE_ENTERPRISE_PRICE_ID=price_... (from Step 1)
   ```

## Step 3 — Wire up Stripe Webhooks (2 min)

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://toolrelay-api.onrender.com/v1/webhooks/stripe`
3. Events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the `whsec_...` signing secret → set as `STRIPE_WEBHOOK_SECRET` in Render

## Step 4 — Enable Auto-Deploy (1 min)

1. Render Dashboard → your service → **Copy Deploy Hook URL**
2. GitHub repo → **Settings → Secrets → Actions** → add:
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Value: the URL from Render

Future pushes to `master` will automatically deploy.

## Step 5 — Verify

```bash
# Health check
curl https://toolrelay-api.onrender.com/health
# → {"status":"ok","version":"1.0.0"}

# Billing plans
curl https://toolrelay-api.onrender.com/v1/billing/plans

# Create an API key
curl -X POST https://toolrelay-api.onrender.com/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"my-agent","ownerId":"user_123"}'
```

## Monitoring

| Service | URL |
|---------|-----|
| Health | `GET /health` |
| Prometheus metrics | `GET /metrics` |
| Grafana (local) | `docker compose -f docker-compose.monitoring.yml up` → `localhost:3001` |

Import Grafana dashboard ID `1860` (Node.js) + connect Prometheus source to `/metrics`.

## Pricing Tiers

| Plan | Price | Executions | Rate Limit |
|------|-------|-----------|------------|
| Free | $0 | 1,000/mo | 10 req/min |
| Starter | $29/mo | 10,000/mo | 60 req/min |
| Pro | $99/mo | 100,000/mo | 300 req/min |
| Enterprise | $499/mo | Unlimited | Unlimited |

# ToolRelay API — Deployment Status

## Build & Test Status
| Check | Status |
|-------|--------|
| TypeScript compile (`npm run build`) | ✅ PASS |
| Test suite (`npm test`) | ✅ PASS |
| Docker build ready | ✅ |
| Render Blueprint (render.yaml) | ✅ |

## GitHub Repository
**URL:** https://github.com/allianceai/toolrelay-api
**Branch:** master
**Auto-deploy:** Via GitHub Actions → `RENDER_DEPLOY_HOOK_URL` secret

---

## Billing Tiers

| Tier | Price | Executions/mo | Rate Limit | Concurrency |
|------|-------|---------------|------------|-------------|
| Free | $0 | 1,000 | 10 req/min | 2 sessions |
| Starter | $29/mo | 10,000 | 60 req/min | 5 sessions |
| Pro | $99/mo | 100,000 | 300 req/min | 20 sessions |
| Enterprise | $499/mo | Unlimited | Unlimited | Unlimited |

---

## Deployment Steps (One-Time Setup)

### Step 1 — Create Stripe Products (5 min)
```bash
cd /home/cameron/toolrelay-api
STRIPE_SECRET_KEY=sk_live_YOUR_KEY bash scripts/setup-stripe.sh
```
Copy the three `price_...` IDs printed at the end.

### Step 2 — Deploy to Render via Blueprint (3 min)
1. Go to https://render.com/dashboard → **New → Blueprint**
2. Connect `github.com/allianceai/toolrelay-api`
3. Render auto-detects `render.yaml` and provisions:
   - Web service: `toolrelay-api` (Node 20, Oregon)
   - Redis: `toolrelay-redis` (auto-connected)
4. Set these env vars in the Render dashboard:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...        (from Step 3)
   STRIPE_STARTER_PRICE_ID=price_...      (from Step 1)
   STRIPE_PRO_PRICE_ID=price_...          (from Step 1)
   STRIPE_ENTERPRISE_PRICE_ID=price_...   (from Step 1)
   APP_URL=https://toolrelay-api.onrender.com
   ```

### Step 3 — Wire Stripe Webhooks (2 min)
1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://toolrelay-api.onrender.com/v1/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the `whsec_...` signing secret → set as `STRIPE_WEBHOOK_SECRET` in Render

### Step 4 — Enable Auto-Deploy via GitHub Actions (1 min)
1. Render Dashboard → your service → **Settings → Deploy Hook** → copy URL
2. GitHub repo → **Settings → Secrets → Actions** → add:
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Value: the Render deploy hook URL

Now every push to `master` triggers: CI → TypeScript build → tests → Render deploy.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /metrics | Prometheus metrics |
| GET | /v1/tools | List tool registry |
| POST | /v1/tools | Register a tool |
| POST | /v1/execute | Execute a tool |
| GET | /v1/keys | List API keys |
| POST | /v1/keys | Create API key |
| DELETE | /v1/keys/:id | Revoke API key |
| GET | /v1/usage | Usage analytics |
| GET | /v1/billing/plans | List plans (public) |
| POST | /v1/billing/checkout | Create Stripe checkout session |
| GET | /v1/billing/portal | Open billing portal |
| POST | /v1/webhooks/stripe | Stripe event webhook |

---

## Monitoring

The `/metrics` endpoint exposes Prometheus-compatible metrics.
A full Grafana + Prometheus stack is available via:
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

---

## Local Development
```bash
cp .env.example .env  # fill in values
npm run dev           # starts on port 3000 with hot reload
```

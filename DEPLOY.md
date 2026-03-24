# ToolRelay API — Deployment Checklist

## 1. Create Stripe Products

Go to [dashboard.stripe.com/products](https://dashboard.stripe.com/products) and create:

| Product | Price | Billing |
|---------|-------|---------|
| ToolRelay Starter | $29.00 | Monthly recurring |
| ToolRelay Pro | $99.00 | Monthly recurring |
| ToolRelay Enterprise | $499.00 | Monthly recurring |

Copy each **Price ID** (format: `price_xxxxxxxx`) — you'll need them below.

---

## 2. Configure Stripe Webhook

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. URL: `https://your-app.onrender.com/v1/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (`whsec_...`)

---

## 3. Deploy to Render

### Option A: One-click via render.yaml
1. Push this repo to GitHub
2. Go to [render.com/deploy](https://render.com/deploy)
3. Connect your GitHub repository
4. Render reads `render.yaml` and creates:
   - Web service: `toolrelay-api` (Node, Oregon region)
   - Redis: `toolrelay-redis` (linked automatically)

### Option B: Manual
```bash
# Install Render CLI
npm install -g @render-cli/render

# Deploy
render deploy --service toolrelay-api
```

---

## 4. Set Environment Variables in Render

In your Render dashboard → Service → Environment:

| Variable | Value |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_STARTER_PRICE_ID` | `price_...` |
| `STRIPE_PRO_PRICE_ID` | `price_...` |
| `STRIPE_ENTERPRISE_PRICE_ID` | `price_...` |
| `APP_URL` | `https://your-app.onrender.com` |

> `JWT_SECRET` and `REDIS_URL` are auto-managed by Render (see render.yaml).

---

## 5. Post-Deploy Verification

```bash
BASE=https://your-app.onrender.com

# Health check
curl $BASE/health

# Create a test key
curl -X POST $BASE/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-test","tier":"free","ownerId":"test_owner"}'

# View pricing plans
curl $BASE/v1/billing/plans

# Prometheus metrics
curl $BASE/metrics | head -20
```

---

## 6. Monitoring Setup

### Render Built-in
- **Logs**: Dashboard → Service → Logs (real-time streaming)
- **Metrics**: Dashboard → Service → Metrics (CPU, memory, response time)
- **Alerts**: Dashboard → Service → Notifications (set up PagerDuty/Slack)

### External (optional)
- **UptimeRobot** (free): Monitor `/health` every 5 min, alert on downtime
- **Grafana Cloud** (free tier): Scrape `/metrics` every 15s for full Prometheus dashboards
  - Add scrape config: `job_name: toolrelay`, `targets: [your-app.onrender.com:443]`

### Key Metrics to Watch
| Metric | Alert Threshold |
|--------|----------------|
| `http_request_duration_seconds p99` | > 2s |
| `toolrelay_quota_exceeded_total` | > 100/hr |
| `toolrelay_execution_errors_total` | > 5% error rate |
| Health check | Any non-200 |

---

## 7. Upgrade Plan

| Stage | Action |
|-------|--------|
| 0–100 users | Render Starter ($7/mo) + Redis Starter ($10/mo) |
| 100–1k users | Render Standard ($25/mo), add Redis replicas |
| 1k+ users | Render Pro or migrate to AWS ECS + ElastiCache |

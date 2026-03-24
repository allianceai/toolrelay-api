# ToolRelay API — Deployment Guide

---

## Option 1: Render.com (Recommended — Free tier available)

1. **Push to GitHub**
   ```bash
   cd toolrelay-api
   git init && git add . && git commit -m "Initial commit"
   gh repo create toolrelay-api --public --push
   ```

2. **Connect to Render**
   - Go to [render.com](https://render.com) → New → Blueprint
   - Point to your repo — Render will detect `render.yaml` automatically
   - It will create both the web service and Redis

3. **Set environment variables in Render dashboard:**
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_STARTER_PRICE_ID`
   - `STRIPE_PRO_PRICE_ID`
   - `STRIPE_ENTERPRISE_PRICE_ID`

4. **Set up Stripe webhook**
   - Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://toolrelay-api.onrender.com/v1/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET`

5. **Verify deployment**
   ```bash
   curl https://toolrelay-api.onrender.com/health
   ```

---

## Option 2: Railway.app

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Set env vars:
```bash
railway variables set STRIPE_SECRET_KEY=sk_live_...
railway variables set NODE_ENV=production
```

---

## Option 3: Self-Hosted Docker

### Prerequisites
- Docker + Docker Compose
- A domain with SSL (use Caddy or nginx for TLS)

```bash
# 1. Clone & configure
git clone https://github.com/your-org/toolrelay-api
cd toolrelay-api
cp .env.example .env
nano .env  # Fill in all values

# 2. Start
docker compose up -d

# 3. Check logs
docker compose logs -f api

# 4. Verify
curl http://localhost:3000/health
```

### With Caddy (TLS)

```caddyfile
api.yourdomain.com {
  reverse_proxy localhost:3000
}
```

---

## Stripe Billing Setup

### Create Products & Prices

```bash
# Starter — $29/mo
stripe products create --name="ToolRelay Starter" --description="10k executions/mo"
stripe prices create \
  --product=prod_xxx \
  --unit-amount=2900 \
  --currency=usd \
  --recurring[interval]=month

# Pro — $99/mo
stripe products create --name="ToolRelay Pro" --description="100k executions/mo"
stripe prices create \
  --product=prod_yyy \
  --unit-amount=9900 \
  --currency=usd \
  --recurring[interval]=month

# Enterprise — $499/mo
stripe products create --name="ToolRelay Enterprise" --description="Unlimited executions"
stripe prices create \
  --product=prod_zzz \
  --unit-amount=49900 \
  --currency=usd \
  --recurring[interval]=month
```

Copy the `price_xxx` IDs into your `.env` file.

---

## Environment Variables Checklist

- [ ] `PORT` (default: 3000)
- [ ] `NODE_ENV=production`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_STARTER_PRICE_ID`
- [ ] `STRIPE_PRO_PRICE_ID`
- [ ] `STRIPE_ENTERPRISE_PRICE_ID`
- [ ] `REDIS_URL` (optional but recommended for production)
- [ ] `LOG_LEVEL=info`

---

## Monitoring

### Health endpoint
```
GET /health
→ {"status":"ok","version":"1.0.0","timestamp":"..."}
```

### Prometheus metrics
```
GET /metrics
```

Connect to Grafana Cloud (free tier):
1. Add Prometheus data source → URL: `https://your-api.com/metrics`
2. Import dashboard ID `1860` (Node.js dashboard)
3. Add ToolRelay-specific panels for:
   - `toolrelay_executions_total`
   - `rate(toolrelay_executions_total[5m])`
   - `histogram_quantile(0.95, toolrelay_execution_duration_ms_bucket)`

### Alerts to configure
- Error rate > 5% → PagerDuty/email
- p95 latency > 5s → Slack notification
- Active keys drop to 0 → immediate alert

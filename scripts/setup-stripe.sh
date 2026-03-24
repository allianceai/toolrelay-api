#!/usr/bin/env bash
# ============================================================
# ToolRelay API — Stripe Product & Price Setup
# Run once to create all billing tiers in your Stripe account.
# Usage: STRIPE_SECRET_KEY=sk_live_xxx bash scripts/setup-stripe.sh
# ============================================================
set -euo pipefail

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "ERROR: STRIPE_SECRET_KEY is not set."
  echo "Usage: STRIPE_SECRET_KEY=sk_live_xxx bash scripts/setup-stripe.sh"
  exit 1
fi

BASE="https://api.stripe.com/v1"
AUTH="-u ${STRIPE_SECRET_KEY}:"

echo "Creating Stripe products and prices for ToolRelay API..."

# ── Free tier (no Stripe product needed, handled in-app) ────────────────────

# ── Starter — $29/mo ────────────────────────────────────────────────────────
echo ""
echo "→ Creating Starter product..."
STARTER_PRODUCT=$(curl -s -X POST "${BASE}/products" ${AUTH} \
  -d "name=ToolRelay API — Starter" \
  -d "description=10,000 tool executions/month. Email support. 60 req/min rate limit.")
STARTER_PRODUCT_ID=$(echo $STARTER_PRODUCT | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "  Product ID: ${STARTER_PRODUCT_ID}"

STARTER_PRICE=$(curl -s -X POST "${BASE}/prices" ${AUTH} \
  -d "product=${STARTER_PRODUCT_ID}" \
  -d "unit_amount=2900" \
  -d "currency=usd" \
  -d "recurring[interval]=month" \
  -d "nickname=Starter Monthly")
STARTER_PRICE_ID=$(echo $STARTER_PRICE | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "  Price ID: ${STARTER_PRICE_ID}"

# ── Pro — $99/mo ─────────────────────────────────────────────────────────────
echo ""
echo "→ Creating Pro product..."
PRO_PRODUCT=$(curl -s -X POST "${BASE}/products" ${AUTH} \
  -d "name=ToolRelay API — Pro" \
  -d "description=100,000 tool executions/month. Priority support. 300 req/min rate limit. Webhooks.")
PRO_PRODUCT_ID=$(echo $PRO_PRODUCT | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "  Product ID: ${PRO_PRODUCT_ID}"

PRO_PRICE=$(curl -s -X POST "${BASE}/prices" ${AUTH} \
  -d "product=${PRO_PRODUCT_ID}" \
  -d "unit_amount=9900" \
  -d "currency=usd" \
  -d "recurring[interval]=month" \
  -d "nickname=Pro Monthly")
PRO_PRICE_ID=$(echo $PRO_PRICE | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "  Price ID: ${PRO_PRICE_ID}"

# ── Enterprise — $499/mo ─────────────────────────────────────────────────────
echo ""
echo "→ Creating Enterprise product..."
ENT_PRODUCT=$(curl -s -X POST "${BASE}/products" ${AUTH} \
  -d "name=ToolRelay API — Enterprise" \
  -d "description=Unlimited executions. Dedicated support. SLA guarantee. Custom integrations.")
ENT_PRODUCT_ID=$(echo $ENT_PRODUCT | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "  Product ID: ${ENT_PRODUCT_ID}"

ENT_PRICE=$(curl -s -X POST "${BASE}/prices" ${AUTH} \
  -d "product=${ENT_PRODUCT_ID}" \
  -d "unit_amount=49900" \
  -d "currency=usd" \
  -d "recurring[interval]=month" \
  -d "nickname=Enterprise Monthly")
ENT_PRICE_ID=$(echo $ENT_PRICE | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")
echo "  Price ID: ${ENT_PRICE_ID}"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "✅ Stripe setup complete! Add these to your .env / Render:"
echo "============================================================"
echo ""
echo "STRIPE_STARTER_PRICE_ID=${STARTER_PRICE_ID}"
echo "STRIPE_PRO_PRICE_ID=${PRO_PRICE_ID}"
echo "STRIPE_ENTERPRISE_PRICE_ID=${ENT_PRICE_ID}"
echo ""
echo "Next: set STRIPE_WEBHOOK_SECRET by running:"
echo "  stripe listen --forward-to https://your-app.onrender.com/v1/webhooks/stripe"
echo "  (use the whsec_... printed by that command)"
echo ""

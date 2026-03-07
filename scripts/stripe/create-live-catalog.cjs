#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const DEFAULT_CATALOG_PATH = 'scripts/stripe/verijob-catalog-live-v2.json';
const REQUIRED_KEYS = [
  'candidate_starter_monthly',
  'candidate_starter_yearly',
  'candidate_pro_monthly',
  'candidate_pro_yearly',
  'candidate_proplus_monthly',
  'candidate_proplus_yearly',
  'company_access_monthly',
  'company_access_yearly',
  'company_hiring_monthly',
  'company_hiring_yearly',
  'company_team_monthly',
  'company_team_yearly',
  'company_single_cv',
  'company_pack_5',
];

function loadCatalog(filePath) {
  const abs = path.resolve(process.cwd(), filePath || DEFAULT_CATALOG_PATH);
  const raw = fs.readFileSync(abs, 'utf8');
  const parsed = JSON.parse(raw);
  return { abs, catalog: parsed };
}

function hasValidAmount(product) {
  return Number.isInteger(product.unit_amount) && product.unit_amount > 0;
}

function validateCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object') throw new Error('Invalid catalog root');
  if (catalog.currency !== 'eur') throw new Error('Catalog currency must be eur for LIVE');
  if (!Array.isArray(catalog.products)) throw new Error('Catalog products must be an array');

  const byKey = new Map(catalog.products.map((p) => [p.key, p]));
  const missingKeys = REQUIRED_KEYS.filter((k) => !byKey.has(k));
  if (missingKeys.length) {
    throw new Error(`Catalog missing required keys: ${missingKeys.join(', ')}`);
  }

  const missingAmounts = REQUIRED_KEYS
    .map((k) => byKey.get(k))
    .filter((p) => !hasValidAmount(p))
    .map((p) => p.key);

  return { missingAmounts };
}

function getSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY_LIVE (or STRIPE_SECRET_KEY)');
  if (!String(key).startsWith('sk_live_')) {
    throw new Error('Refusing to run with non-live key. Use STRIPE_SECRET_KEY_LIVE=sk_live_...');
  }
  return key;
}

async function listAllProducts(stripe) {
  const out = [];
  let starting_after = undefined;
  while (true) {
    const page = await stripe.products.list({ limit: 100, active: true, starting_after });
    out.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return out;
}

async function listAllPricesByProduct(stripe, productId) {
  const out = [];
  let starting_after = undefined;
  while (true) {
    const page = await stripe.prices.list({ product: productId, active: true, limit: 100, starting_after });
    out.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return out;
}

function isMatchingPrice(price, item, currency) {
  if (price.currency !== currency) return false;
  if (price.unit_amount !== item.unit_amount) return false;

  if (item.mode === 'subscription') {
    if (price.type !== 'recurring' || !price.recurring || !item.recurring) return false;
    return (
      price.recurring.interval === item.recurring.interval &&
      (price.recurring.interval_count || 1) === (item.recurring.interval_count || 1)
    );
  }

  return price.type === 'one_time';
}

async function findOrCreateProduct(stripe, allProducts, item) {
  const found = allProducts.find(
    (p) => p.metadata && p.metadata.slug === item.key && p.metadata.environment === 'live'
  );
  if (found) return found;

  const metadata = {
    app: 'verijob',
    slug: item.key,
    audience: item.metadata?.audience || 'unknown',
    billing_type: item.mode === 'subscription' ? 'recurring' : 'one_time',
    environment: 'live',
    ...item.metadata,
  };

  return stripe.products.create({
    name: item.name,
    description: item.description,
    metadata,
  });
}

async function findOrCreatePrice(stripe, productId, item, currency) {
  const existing = await listAllPricesByProduct(stripe, productId);
  const found = existing.find((price) => isMatchingPrice(price, item, currency));
  if (found) return found;

  const metadata = {
    app: 'verijob',
    slug: item.key,
    audience: item.metadata?.audience || 'unknown',
    billing_type: item.mode === 'subscription' ? 'recurring' : 'one_time',
    environment: 'live',
    ...item.metadata,
  };

  const payload = {
    product: productId,
    currency,
    unit_amount: item.unit_amount,
    metadata,
  };

  if (item.mode === 'subscription') {
    payload.recurring = {
      interval: item.recurring.interval,
      interval_count: item.recurring.interval_count || 1,
    };
  }

  return stripe.prices.create(payload);
}

async function run() {
  const catalogPath = process.argv[2] || DEFAULT_CATALOG_PATH;
  const { abs, catalog } = loadCatalog(catalogPath);
  const { missingAmounts } = validateCatalog(catalog);

  if (missingAmounts.length) {
    console.log(
      JSON.stringify(
        {
          status: 'blocked_missing_amounts',
          catalog: abs,
          missing_amounts: missingAmounts,
          message: 'Complete unit_amount for all required products before LIVE execution.',
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const stripe = new Stripe(getSecretKey());
  const allProducts = await listAllProducts(stripe);
  const summary = [];

  for (const item of catalog.products.filter((p) => REQUIRED_KEYS.includes(p.key))) {
    const product = await findOrCreateProduct(stripe, allProducts, item);
    const price = await findOrCreatePrice(stripe, product.id, item, catalog.currency);

    summary.push({
      key: item.key,
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      mode: item.mode,
      interval: item.mode === 'subscription' ? item.recurring?.interval || null : null,
    });
  }

  const output = {
    status: 'ok',
    environment: 'live',
    catalog: abs,
    generated_at: new Date().toISOString(),
    prices: summary,
  };

  console.log(JSON.stringify(output, null, 2));
}

run().catch((err) => {
  console.error(
    JSON.stringify(
      {
        status: 'error',
        message: err?.message || String(err),
      },
      null,
      2
    )
  );
  process.exit(1);
});

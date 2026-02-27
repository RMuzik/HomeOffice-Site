/**
 * update-prices.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches current Amazon prices via the official Amazon Product Advertising
 * API v5 (PA-API) and updates the price fields in the Astro product pages.
 *
 * PA-API is FREE for all Amazon Associates — no extra subscription needed.
 *
 * Setup (one-time, ~5 minutes):
 *   1. Go to: https://affiliate-program.amazon.fr
 *      → Tools → Product Advertising API → Manage Your Credentials
 *   2. Click "Add credentials" → copy Access Key ID + Secret Access Key
 *   3. Add 4 secrets to GitHub repo:
 *      Settings → Secrets and variables → Actions → New repository secret
 *        AMAZON_ACCESS_KEY  = your Access Key ID
 *        AMAZON_SECRET_KEY  = your Secret Access Key
 *        AMAZON_TAG_FR      = zeroalc-21
 *        AMAZON_TAG_EN      = your .com associate tag (or same tag)
 *
 * Run manually:
 *   AMAZON_ACCESS_KEY=xxx AMAZON_SECRET_KEY=yyy AMAZON_TAG_FR=zeroalc-21 \
 *   AMAZON_TAG_EN=zeroalc-21 node scripts/update-prices.mjs
 */

import { createHmac, createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────

const ACCESS_KEY = process.env.AMAZON_ACCESS_KEY;
const SECRET_KEY = process.env.AMAZON_SECRET_KEY;
const TAG_FR     = process.env.AMAZON_TAG_FR || 'zeroalc-21';
const TAG_EN     = process.env.AMAZON_TAG_EN || 'zeroalc-21';

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error('❌  AMAZON_ACCESS_KEY or AMAZON_SECRET_KEY not set.');
  console.error('    1. Go to: https://affiliate-program.amazon.fr');
  console.error('       → Tools → Product Advertising API → Manage Your Credentials');
  console.error('    2. Add AMAZON_ACCESS_KEY + AMAZON_SECRET_KEY to GitHub Secrets.');
  process.exit(1);
}

/** Ignore price changes smaller than this percentage (avoids noise) */
const MIN_CHANGE_PCT = 3;

// ── Products to track ─────────────────────────────────────────────────────────

// FR ASINs (Amazon.fr, EUR)
const FR_ASINS = {
  'B09TD87W1J': ['src/pages/best-standing-desks.astro', 'src/pages/home-office-setup.astro', 'src/pages/index.astro'],
  'B0BHTQRLXS': ['src/pages/best-standing-desks.astro'],
  'B087JF3B5S': ['src/pages/best-standing-desks.astro', 'src/pages/home-office-setup.astro'],
  'B087M4278G': ['src/pages/best-standing-desks.astro'],
  'B0F32CK158': ['src/pages/best-standing-desks.astro'],
  'B0BGZB6VZM': ['src/pages/best-ergonomic-chairs.astro', 'src/pages/home-office-setup.astro', 'src/pages/index.astro'],
  'B0GFMQMJ47': ['src/pages/best-ergonomic-chairs.astro', 'src/pages/home-office-setup.astro'],
  'B0FR981Z25': ['src/pages/best-ergonomic-chairs.astro'],
  'B0F371HFBT': ['src/pages/best-ergonomic-chairs.astro'],
  'B0D9GWQF84': ['src/pages/best-ergonomic-chairs.astro', 'src/pages/budget-home-office-setup.astro'],
  'B0DK51HDGB': ['src/pages/budget-home-office-setup.astro'],
  'B0CFR34FDB': ['src/pages/budget-home-office-setup.astro'],
  'B004ELA7TA': ['src/pages/budget-home-office-setup.astro'],
  'B0DTQ9SKYF': ['src/pages/home-office-setup.astro', 'src/pages/index.astro'],
  'B096K7YHPW': ['src/pages/home-office-setup.astro'],
  'B0FHHV6YR5': ['src/pages/home-office-setup.astro'],
  'B07L755X9G': ['src/pages/home-office-setup.astro'],
};

// EN ASINs (Amazon.com, USD)
const EN_ASINS = {
  'B09TD87W1J': ['src/pages/en/best-standing-desks.astro', 'src/pages/en/home-office-setup.astro', 'src/pages/en/index.astro'],
  'B087JF3B5S': ['src/pages/en/best-standing-desks.astro', 'src/pages/en/home-office-setup.astro'],
  'B0BGZB6VZM': ['src/pages/en/best-ergonomic-chairs.astro', 'src/pages/en/home-office-setup.astro', 'src/pages/en/index.astro'],
  'B0GFMQMJ47': ['src/pages/en/best-ergonomic-chairs.astro'],
  'B0DTQ9SKYF': ['src/pages/en/home-office-setup.astro', 'src/pages/en/index.astro'],
  'B096K7YHPW': ['src/pages/en/home-office-setup.astro'],
  'B0FHHV6YR5': ['src/pages/en/home-office-setup.astro'],
  'B07L755X9G': ['src/pages/en/home-office-setup.astro'],
};

// ── Amazon PA-API v5 — AWS SigV4 signing ─────────────────────────────────────

const PA_API = {
  fr:  { host: 'webservices.amazon.fr',  region: 'eu-west-1', tag: TAG_FR, marketplace: 'www.amazon.fr'  },
  com: { host: 'webservices.amazon.com', region: 'us-east-1', tag: TAG_EN, marketplace: 'www.amazon.com' },
};
const PA_PATH   = '/paapi5/getitems';
const PA_TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems';
const PA_SVC    = 'ProductAdvertisingAPI';

function hmac(key, data, enc) {
  return createHmac('sha256', key).update(data, 'utf8').digest(enc);
}
function sha256(data, enc) {
  return createHash('sha256').update(data, 'utf8').digest(enc);
}
function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), 'aws4_request');
}

/**
 * Fetch prices for up to 10 ASINs in one PA-API request.
 * Returns { ASIN: priceNumber, ... }
 */
async function fetchPAAIPrices(asins, market) {
  const cfg = PA_API[market];

  const body = JSON.stringify({
    ItemIds:     asins,
    PartnerTag:  cfg.tag,
    PartnerType: 'Associates',
    Marketplace: cfg.marketplace,
    Resources:   ['Offers.Listings.Price'],
  });

  const now       = new Date();
  const amzDate   = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').replace('T', 'T').slice(0, 16) + '00Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256(body, 'hex');

  const canonHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${cfg.host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${PA_TARGET}\n`;

  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';

  const canonRequest =
    `POST\n${PA_PATH}\n\n${canonHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credScope  = `${dateStamp}/${cfg.region}/${PA_SVC}/aws4_request`;
  const strToSign  = `AWS4-HMAC-SHA256\n${amzDate}\n${credScope}\n${sha256(canonRequest, 'hex')}`;
  const signature  = hmac(signingKey(SECRET_KEY, dateStamp, cfg.region, PA_SVC), strToSign, 'hex');

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${cfg.host}${PA_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'amz-1.0',
      'Content-Type':     'application/json; charset=utf-8',
      'Host':             cfg.host,
      'X-Amz-Date':      amzDate,
      'X-Amz-Target':    PA_TARGET,
      'Authorization':   authHeader,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PA-API ${res.status} (${market}): ${txt.slice(0, 300)}`);
  }

  const data = await res.json();
  const prices = {};

  for (const item of data.ItemsResult?.Items ?? []) {
    const price = item.Offers?.Listings?.[0]?.Price?.Amount;
    if (price != null) prices[item.ASIN] = price;
  }

  // Log items with no price (out of stock / errors)
  for (const err of data.Errors ?? []) {
    console.warn(`    ⚠️  PA-API error for ${err.Code}: ${err.Message}`);
  }

  return prices;
}

// ── File updater ──────────────────────────────────────────────────────────────

function updateFilePrice(filePath, asin, newPrice, currency) {
  const absPath = join(ROOT, filePath);
  if (!existsSync(absPath)) {
    console.warn(`    ⚠️  File not found: ${filePath}`);
    return false;
  }

  const lines   = readFileSync(absPath, 'utf-8').split('\n');
  let changed   = false;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].match(/asin\s*:/) || !lines[i].includes(asin)) continue;

    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const m = lines[j].match(/^(\s*price\s*:\s*['"`])([^'"`]+)(['"`].*)$/);
      if (!m) {
        if (lines[j].match(/asin\s*:/)) break; // next product
        continue;
      }

      const currentStr = m[2];
      const currentNum = parseFloat(currentStr.replace(/[^0-9.]/g, ''));
      if (!currentNum || isNaN(currentNum)) break;

      const changePct = (Math.abs(newPrice - currentNum) / currentNum) * 100;

      if (changePct < MIN_CHANGE_PCT) {
        console.log(`    — ${asin} (${filePath}): ${currentStr} inchangé (Δ ${changePct.toFixed(1)}%)`);
        break;
      }

      const rounded   = Math.round(newPrice);
      const formatted = currency === '$' ? `$${rounded}` : `${rounded}€`;
      lines[j]        = `${m[1]}${formatted}${m[3]}`;
      changed         = true;
      console.log(`    ✅ ${asin} (${filePath}): ${currentStr} → ${formatted}  (Δ ${changePct.toFixed(0)}%)`);
      break;
    }
  }

  if (changed) writeFileSync(absPath, lines.join('\n'), 'utf-8');
  return changed;
}

// ── Batch helper ──────────────────────────────────────────────────────────────

/** Chunk an array into groups of at most `size` elements */
function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function processMarket(asinMap, market, currency) {
  const asins   = Object.keys(asinMap);
  const batches = chunks(asins, 10); // PA-API max 10 ASINs per request
  let filesUpdated = 0;

  for (const batch of batches) {
    console.log(`\n  Batch [${batch.join(', ')}]`);

    let prices;
    try {
      prices = await fetchPAAIPrices(batch, market);
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
      continue;
    }

    for (const asin of batch) {
      const price = prices[asin];
      if (price == null) {
        console.warn(`    ⚠️  ${asin}: pas de prix disponible`);
        continue;
      }
      console.log(`    📦 ${asin}: ${currency === '$' ? '$' : ''}${price.toFixed(2)}${currency === '€' ? '€' : ''}`);

      for (const file of asinMap[asin]) {
        if (updateFilePrice(file, asin, price, currency)) filesUpdated++;
      }
    }

    // Polite delay between batches
    if (batches.length > 1) await new Promise((r) => setTimeout(r, 1000));
  }

  return filesUpdated;
}

async function main() {
  console.log('🔄  HomeOffice Price Updater — Amazon PA-API v5');
  console.log(`    Seuil min de changement : ${MIN_CHANGE_PCT}%`);
  console.log(`    Date                    : ${new Date().toISOString().split('T')[0]}\n`);

  let total = 0;

  console.log('🇫🇷  Amazon.fr (EUR)');
  total += await processMarket(FR_ASINS, 'fr', '€');

  await new Promise((r) => setTimeout(r, 1000));

  console.log('\n🇺🇸  Amazon.com (USD)');
  total += await processMarket(EN_ASINS, 'com', '$');

  console.log('\n─────────────────────────────────────────────');
  console.log(`✅  Terminé. ${total} fichier(s) mis à jour.`);
  if (total > 0) console.log('    Vercel va auto-redéployer après le git push.');
  else console.log('    Aucun changement de prix — rien à committer.');
}

main().catch((err) => {
  console.error('\n💥 Erreur fatale:', err);
  process.exit(1);
});

/**
 * update-prices.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches current Amazon prices via the Amazon Creators API and updates the
 * price fields in the Astro product pages.
 *
 * The Creators API replaces PA-API (deprecated April 30, 2026).
 * Auth uses OAuth2 client_credentials — no AWS SigV4 needed.
 *
 * Setup (one-time, ~5 minutes):
 *   1. Go to: https://affiliate-program.amazon.fr
 *      → Tools → Creators API → Manage Your Credentials
 *   2. Copy Client ID (amzn1.application-oa2-client.3...) + Client Secret
 *   3. Add 4 secrets to GitHub repo:
 *      Settings → Secrets and variables → Actions → New repository secret
 *        AMAZON_CLIENT_ID     = amzn1.application-oa2-client.3...
 *        AMAZON_CLIENT_SECRET = your Client Secret
 *        AMAZON_TAG_FR        = zeroalc-21
 *        AMAZON_TAG_EN        = your .com associate tag (or same tag)
 *
 * Run manually:
 *   AMAZON_CLIENT_ID=amzn1.application-oa2-client.3... AMAZON_CLIENT_SECRET=xxx \
 *   AMAZON_TAG_FR=zeroalc-21 AMAZON_TAG_EN=zeroalc-21 node scripts/update-prices.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────

const CLIENT_ID     = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const TAG_FR        = process.env.AMAZON_TAG_FR || 'zeroalc-21';
const TAG_EN        = process.env.AMAZON_TAG_EN || 'zeroalc-21';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌  AMAZON_CLIENT_ID or AMAZON_CLIENT_SECRET not set.');
  console.error('    1. Go to: https://affiliate-program.amazon.fr');
  console.error('       → Tools → Creators API → Manage Your Credentials');
  console.error('    2. Add AMAZON_CLIENT_ID + AMAZON_CLIENT_SECRET to GitHub Secrets.');
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
  'B0DTQ9SKYF': ['src/pages/home-office-setup.astro', 'src/pages/index.astro', 'src/pages/best-monitors-home-office.astro'],
  'B096K7YHPW': ['src/pages/home-office-setup.astro'],
  'B0FHHV6YR5': ['src/pages/home-office-setup.astro'],
  'B07L755X9G': ['src/pages/home-office-setup.astro'],
  // Monitors
  'B0BY2R4BHW': ['src/pages/best-monitors-home-office.astro'],
  'B0DPHFHRJM': ['src/pages/best-monitors-home-office.astro'],
  'B096B3PBFZ': ['src/pages/best-monitors-home-office.astro'],
  'B08ZS4SX1J': ['src/pages/best-monitors-home-office.astro'],
  // Headsets
  'B086M9KHY3': ['src/pages/best-headsets-home-office.astro'],
  'B000UXZQ42': ['src/pages/best-headsets-home-office.astro'],
  'B09XS7JWHH': ['src/pages/best-headsets-home-office.astro'],
  'B071L1F3HM': ['src/pages/best-headsets-home-office.astro'],
  'B01K6TU90U': ['src/pages/best-headsets-home-office.astro'],
  // Desk lamps
  'B0CZ9P1QW9': ['src/pages/best-desk-lamps.astro'],
  'B0DK59YKRS': ['src/pages/best-desk-lamps.astro'],
  'B082QHRZFW': ['src/pages/best-desk-lamps.astro'],
  'B08WT889V3': ['src/pages/best-desk-lamps.astro'],
  'B0FD9MQF5R': ['src/pages/best-desk-lamps.astro'],
  // Webcams
  'B07MM4V7NR': ['src/pages/best-webcams-home-office.astro'],
  'B01N5UOYC4': ['src/pages/best-webcams-home-office.astro'],
  'B07W6HPP3T': ['src/pages/best-webcams-home-office.astro'],
  'B08PKBZ428': ['src/pages/best-webcams-home-office.astro'],
  'B006RHJUM4': ['src/pages/best-webcams-home-office.astro'],
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
  // Webcams
  'B07MM4V7NR': ['src/pages/en/best-webcams-home-office.astro'],
  'B01N5UOYC4': ['src/pages/en/best-webcams-home-office.astro'],
  'B085TFF7M1': ['src/pages/en/best-webcams-home-office.astro'],
  'B08PKBZ428': ['src/pages/en/best-webcams-home-office.astro'],
  'B006RHJUM4': ['src/pages/en/best-webcams-home-office.astro'],
};

// ── Amazon Creators API — OAuth2 ──────────────────────────────────────────────

const CREATORS_API = {
  fr: {
    // v3.x EU credentials → token via api.amazon.co.uk
    tokenUrl:    'https://api.amazon.co.uk/auth/o2/token',
    apiUrl:      'https://creatorsapi.amazon/catalog/v1/getItems',
    marketplace: 'www.amazon.fr',
    tag:         TAG_FR,
  },
  com: {
    // For Amazon.com — try US token endpoint
    // Note: if your credentials are EU-only, .com market may be skipped automatically
    tokenUrl:    'https://api.amazon.com/auth/o2/token',
    apiUrl:      'https://creatorsapi.amazon/catalog/v1/getItems',
    marketplace: 'www.amazon.com',
    tag:         TAG_EN,
  },
};

/** Token cache: { market → { token, expiresAt } } */
const tokenCache = {};

/**
 * Get an OAuth2 Bearer token for the given market.
 * Caches the token for its lifetime (3600s), refreshes 1 min before expiry.
 * Returns null if auth fails (allows graceful skip of that market).
 */
async function getBearerToken(market) {
  const cfg = CREATORS_API[market];
  const now = Date.now();

  if (tokenCache[market] && tokenCache[market].expiresAt > now + 60_000) {
    return tokenCache[market].token;
  }

  const res = await fetch(cfg.tokenUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         'creatorsapi::default',
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Auth failed (${market}): HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  tokenCache[market] = {
    token:     data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return tokenCache[market].token;
}

/**
 * Fetch prices for up to 10 ASINs in one Creators API request.
 * Returns { ASIN: priceNumber, ... }
 */
async function fetchCreatorsPrices(asins, market) {
  const cfg   = CREATORS_API[market];
  const token = await getBearerToken(market);

  const res = await fetch(cfg.apiUrl, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
      'x-marketplace': cfg.marketplace,
    },
    body: JSON.stringify({
      itemIds:     asins,
      itemIdType:  'ASIN',
      marketplace: cfg.marketplace,
      partnerTag:  cfg.tag,
      resources:   ['offersV2.listings.price'],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Creators API ${res.status} (${market}): ${txt.slice(0, 300)}`);
  }

  const data   = await res.json();
  const prices = {};

  for (const item of data.itemsResult?.items ?? []) {
    const price = item.offersV2?.listings?.[0]?.price?.amount;
    if (price != null) prices[item.asin] = price;
  }

  // Log items with errors (out of stock, invalid ASIN, etc.)
  for (const err of data.errors ?? []) {
    console.warn(`    ⚠️  API error ${err.code}: ${err.message}`);
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
        if (lines[j].match(/asin\s*:/)) break; // next product block
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
  const batches = chunks(asins, 10); // Creators API max 10 ASINs per request
  let filesUpdated = 0;

  for (const batch of batches) {
    console.log(`\n  Batch [${batch.join(', ')}]`);

    let prices;
    try {
      prices = await fetchCreatorsPrices(batch, market);
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
  console.log('🔄  HomeOffice Price Updater — Amazon Creators API');
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

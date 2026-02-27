/**
 * update-prices.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches current Amazon buy-box prices via the Keepa API and updates the
 * price fields in the Astro product pages.
 *
 * Keepa free tier  : 100 tokens / day  — 1 token per ASIN request
 * This script uses : ~25 tokens / run  — well within the free limit
 *
 * Setup (one-time):
 *   1. Sign up free at https://keepa.com → Account → API key
 *   2. Add KEEPA_API_KEY to GitHub repo:
 *      Settings → Secrets and variables → Actions → New repository secret
 *
 * Run manually:
 *   KEEPA_API_KEY=xxx node scripts/update-prices.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Config ────────────────────────────────────────────────────────────────────

const KEEPA_KEY = process.env.KEEPA_API_KEY;
if (!KEEPA_KEY) {
  console.error('❌  KEEPA_API_KEY environment variable not set.');
  console.error('    Get a free key at https://keepa.com → Account → API key');
  console.error('    Then add it to GitHub: Settings → Secrets → Actions → KEEPA_API_KEY');
  process.exit(1);
}

/** Ignore price changes smaller than this percentage (avoids noise / minor fluctuations) */
const MIN_CHANGE_PCT = 3;

/** Delay between Keepa requests (ms) — polite rate limiting for the free tier */
const KEEPA_DELAY_MS = 1500;

// ── Products to track ─────────────────────────────────────────────────────────
//
// domain:  4 = Amazon.fr  (EUR)
//          1 = Amazon.com (USD)
//
// files[]: all .astro files containing this ASIN+price pair

const PRODUCTS = [
  // ── FR pages (€) ────────────────────────────────────────────────────────────
  {
    asin: 'B09TD87W1J', domain: 4, currency: '€',
    files: [
      'src/pages/best-standing-desks.astro',
      'src/pages/home-office-setup.astro',
      'src/pages/index.astro',
    ],
  },
  {
    asin: 'B0BHTQRLXS', domain: 4, currency: '€',
    files: ['src/pages/best-standing-desks.astro'],
  },
  {
    asin: 'B087JF3B5S', domain: 4, currency: '€',
    files: [
      'src/pages/best-standing-desks.astro',
      'src/pages/home-office-setup.astro',
    ],
  },
  {
    asin: 'B087M4278G', domain: 4, currency: '€',
    files: ['src/pages/best-standing-desks.astro'],
  },
  {
    asin: 'B0F32CK158', domain: 4, currency: '€',
    files: ['src/pages/best-standing-desks.astro'],
  },
  {
    asin: 'B0BGZB6VZM', domain: 4, currency: '€',
    files: [
      'src/pages/best-ergonomic-chairs.astro',
      'src/pages/home-office-setup.astro',
      'src/pages/index.astro',
    ],
  },
  {
    asin: 'B0GFMQMJ47', domain: 4, currency: '€',
    files: [
      'src/pages/best-ergonomic-chairs.astro',
      'src/pages/home-office-setup.astro',
    ],
  },
  {
    asin: 'B0FR981Z25', domain: 4, currency: '€',
    files: ['src/pages/best-ergonomic-chairs.astro'],
  },
  {
    asin: 'B0F371HFBT', domain: 4, currency: '€',
    files: ['src/pages/best-ergonomic-chairs.astro'],
  },
  {
    asin: 'B0D9GWQF84', domain: 4, currency: '€',
    files: [
      'src/pages/best-ergonomic-chairs.astro',
      'src/pages/budget-home-office-setup.astro',
    ],
  },
  {
    asin: 'B0DK51HDGB', domain: 4, currency: '€',
    files: ['src/pages/budget-home-office-setup.astro'],
  },
  {
    asin: 'B0CFR34FDB', domain: 4, currency: '€',
    files: ['src/pages/budget-home-office-setup.astro'],
  },
  {
    asin: 'B004ELA7TA', domain: 4, currency: '€',
    files: ['src/pages/budget-home-office-setup.astro'],
  },
  {
    asin: 'B0DTQ9SKYF', domain: 4, currency: '€',
    files: [
      'src/pages/home-office-setup.astro',
      'src/pages/index.astro',
    ],
  },
  {
    asin: 'B096K7YHPW', domain: 4, currency: '€',
    files: ['src/pages/home-office-setup.astro'],
  },
  {
    asin: 'B0FHHV6YR5', domain: 4, currency: '€',
    files: ['src/pages/home-office-setup.astro'],
  },
  {
    asin: 'B07L755X9G', domain: 4, currency: '€',
    files: ['src/pages/home-office-setup.astro'],
  },

  // ── EN pages ($) ────────────────────────────────────────────────────────────
  {
    asin: 'B09TD87W1J', domain: 1, currency: '$',
    files: [
      'src/pages/en/best-standing-desks.astro',
      'src/pages/en/home-office-setup.astro',
      'src/pages/en/index.astro',
    ],
  },
  {
    asin: 'B087JF3B5S', domain: 1, currency: '$',
    files: [
      'src/pages/en/best-standing-desks.astro',
      'src/pages/en/home-office-setup.astro',
    ],
  },
  {
    asin: 'B0BGZB6VZM', domain: 1, currency: '$',
    files: [
      'src/pages/en/best-ergonomic-chairs.astro',
      'src/pages/en/home-office-setup.astro',
      'src/pages/en/index.astro',
    ],
  },
  {
    asin: 'B0GFMQMJ47', domain: 1, currency: '$',
    files: ['src/pages/en/best-ergonomic-chairs.astro'],
  },
  {
    asin: 'B0DTQ9SKYF', domain: 1, currency: '$',
    files: [
      'src/pages/en/home-office-setup.astro',
      'src/pages/en/index.astro',
    ],
  },
  {
    asin: 'B096K7YHPW', domain: 1, currency: '$',
    files: ['src/pages/en/home-office-setup.astro'],
  },
  {
    asin: 'B0FHHV6YR5', domain: 1, currency: '$',
    files: ['src/pages/en/home-office-setup.astro'],
  },
  {
    asin: 'B07L755X9G', domain: 1, currency: '$',
    files: ['src/pages/en/home-office-setup.astro'],
  },
];

// ── Keepa API ─────────────────────────────────────────────────────────────────

/**
 * Fetch the current buy-box price for an ASIN from Keepa.
 * Returns price in local currency (EUR or USD), or null if unavailable.
 */
async function fetchKeepaPrice(asin, domain) {
  const url =
    `https://api.keepa.com/product` +
    `?key=${KEEPA_KEY}` +
    `&domain=${domain}` +
    `&asin=${asin}` +
    `&stats=1` +
    `&offers=20`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Keepa HTTP ${res.status} for ASIN ${asin}`);
  }

  const data = await res.json();

  if (!data.products?.length) return null;

  const stats = data.products[0].stats;
  if (!stats) return null;

  // Keepa price types in stats.current[]:
  //  [0]  = Amazon (direct)
  //  [1]  = Marketplace New (3rd party)
  //  [10] = Buy Box (what customers actually pay — preferred)
  // Values are in Keepa units (cents × 10 for most currencies → divide by 100)
  // -1 or undefined means "not available"

  const candidates = [
    stats.current?.[10],  // Buy Box ← preferred
    stats.current?.[0],   // Amazon direct
    stats.current?.[1],   // Marketplace New
  ];

  const raw = candidates.find((v) => v != null && v > 0);
  if (!raw) return null;

  return raw / 100; // Convert Keepa units → currency
}

// ── File updater ──────────────────────────────────────────────────────────────

/**
 * Update the `price:` field for a given ASIN in a .astro file.
 * Uses a line-by-line scan: finds the `asin:` line, then looks forward
 * up to 10 lines for the matching `price:` field.
 *
 * Returns true if the file was modified.
 */
function updateFilePrice(filePath, asin, newPrice, currency) {
  const absPath = join(ROOT, filePath);

  if (!existsSync(absPath)) {
    console.warn(`    ⚠️  File not found, skipping: ${filePath}`);
    return false;
  }

  const lines = readFileSync(absPath, 'utf-8').split('\n');
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match: asin: 'XXXXXXXXXX',  or  asin: "XXXXXXXXXX",
    if (!line.match(/asin\s*:/) || !line.includes(asin)) continue;

    // Look forward up to 10 lines for the price field
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      // Match:   price: '464€',   or   price: "$489",
      const m = lines[j].match(/^(\s*price\s*:\s*['"`])([^'"`]+)(['"`].*)$/);
      if (!m) {
        // Stop if we hit another product's asin line (different object)
        if (lines[j].match(/asin\s*:/)) break;
        continue;
      }

      const currentStr = m[2];                             // e.g. "464€" or "$489"
      const currentNum = parseFloat(currentStr.replace(/[^0-9.]/g, ''));

      if (!currentNum || isNaN(currentNum)) break;

      const changePct = (Math.abs(newPrice - currentNum) / currentNum) * 100;

      if (changePct < MIN_CHANGE_PCT) {
        console.log(`    — ${asin} (${filePath}): ${currentStr} unchanged (Δ ${changePct.toFixed(1)}%)`);
        break;
      }

      // Format the new price to match the existing style
      const rounded = Math.round(newPrice);
      const formatted = currency === '$' ? `$${rounded}` : `${rounded}€`;

      lines[j] = `${m[1]}${formatted}${m[3]}`;
      changed = true;
      console.log(`    ✅ ${asin} (${filePath}): ${currentStr} → ${formatted}  (+${changePct.toFixed(0)}%)`);
      break;
    }
  }

  if (changed) {
    writeFileSync(absPath, lines.join('\n'), 'utf-8');
  }

  return changed;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄  HomeOffice Price Updater — Keepa API');
  console.log(`    Min change threshold : ${MIN_CHANGE_PCT}%`);
  console.log(`    Date                 : ${new Date().toISOString().split('T')[0]}\n`);

  // Deduplicate: same ASIN+domain is fetched only once, then applied to all its files
  const byKey = new Map();
  for (const p of PRODUCTS) {
    const key = `${p.asin}-${p.domain}`;
    if (!byKey.has(key)) {
      byKey.set(key, { ...p, files: [...p.files] });
    } else {
      // Merge file lists (shouldn't happen with the current PRODUCTS array, but safe)
      for (const f of p.files) {
        if (!byKey.get(key).files.includes(f)) {
          byKey.get(key).files.push(f);
        }
      }
    }
  }

  let filesUpdated = 0;
  let asinsChecked = 0;
  const errors = [];

  for (const [key, { asin, domain, currency, files }] of byKey) {
    asinsChecked++;
    const domainLabel = domain === 4 ? 'amazon.fr' : 'amazon.com';
    console.log(`📦  ${asin}  (${domainLabel}, ${currency})`);

    let price;
    try {
      price = await fetchKeepaPrice(asin, domain);
    } catch (err) {
      console.error(`    ❌ Keepa error: ${err.message}`);
      errors.push(`${asin} (${domainLabel}): ${err.message}`);
      await new Promise((r) => setTimeout(r, KEEPA_DELAY_MS));
      continue;
    }

    if (price == null) {
      console.warn(`    ⚠️  No price available (out of stock or unlisted on ${domainLabel})`);
      await new Promise((r) => setTimeout(r, KEEPA_DELAY_MS));
      continue;
    }

    console.log(`    Keepa price: ${currency === '$' ? '$' : ''}${price.toFixed(2)}${currency === '€' ? '€' : ''}`);

    const uniqueFiles = [...new Set(files)];
    for (const file of uniqueFiles) {
      if (updateFilePrice(file, asin, price, currency)) {
        filesUpdated++;
      }
    }

    // Polite delay between requests
    await new Promise((r) => setTimeout(r, KEEPA_DELAY_MS));
  }

  console.log('\n─────────────────────────────────────────────');
  console.log(`✅  Done.`);
  console.log(`    ASINs checked  : ${asinsChecked}`);
  console.log(`    Files updated  : ${filesUpdated}`);

  if (errors.length) {
    console.warn(`\n⚠️  Errors (${errors.length}):`);
    errors.forEach((e) => console.warn(`    • ${e}`));
  }

  if (filesUpdated === 0) {
    console.log('\n    No price changes — nothing to commit.');
  } else {
    console.log(`\n    Vercel will auto-deploy after the git push.`);
  }
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});

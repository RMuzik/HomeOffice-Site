#!/usr/bin/env node
/**
 * download-product-images.js
 * Télécharge les images produits Amazon et les héberge en local
 * Usage: node scripts/download-product-images.js
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const OUTPUT_DIR = path.join(__dirname, '../public/products');

// Tous les ASINs du site avec leurs pages
const ASINS = [
  'B004ELA7TA',
  'B07L755X9G',
  'B087JF3B5S',
  'B087M4278G',
  'B096K7YHPW',
  'B09TD87W1J',
  'B0BGZB6VZM',
  'B0BHTQRLXS',
  'B0CFR34FDB',
  'B0D9GWQF84',
  'B0DK51HDGB',
  'B0DTQ9SKYF',
  'B0F32CK158',
  'B0F371HFBT',
  'B0FHHV6YR5',
  'B0FR981Z25',
  'B0GFMQMJ47',
];

// Formats à essayer dans l'ordre (du plus grand au plus petit)
const IMAGE_FORMATS = [
  (asin) => `https://m.media-amazon.com/images/P/${asin}.01._SL500_.jpg`,
  (asin) => `https://m.media-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`,
  (asin) => `https://m.media-amazon.com/images/P/${asin}.01._AC_SL500_.jpg`,
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    const req = proto.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.amazon.fr/',
      },
      timeout: 15000,
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        // Vérifier que le fichier n'est pas vide
        const stat = fs.statSync(dest);
        if (stat.size < 1000) {
          fs.unlinkSync(dest);
          reject(new Error(`Fichier trop petit (${stat.size} bytes)`));
        } else {
          resolve(stat.size);
        }
      });
    });

    req.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(new Error('Timeout'));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadAsin(asin) {
  const dest = path.join(OUTPUT_DIR, `${asin}.jpg`);

  // Déjà téléchargé ?
  if (fs.existsSync(dest)) {
    const stat = fs.statSync(dest);
    if (stat.size > 5000) {
      console.log(`  ⏭️  ${asin} — déjà présent (${Math.round(stat.size / 1024)}KB)`);
      return { asin, status: 'cached', size: stat.size };
    }
  }

  for (const formatFn of IMAGE_FORMATS) {
    const url = formatFn(asin);
    try {
      const size = await downloadFile(url, dest);
      console.log(`  ✅ ${asin} — ${Math.round(size / 1024)}KB`);
      return { asin, status: 'downloaded', size, url };
    } catch (err) {
      // Essayer le format suivant
    }
  }

  console.log(`  ❌ ${asin} — impossible de télécharger`);
  return { asin, status: 'failed' };
}

async function main() {
  console.log('📦 Téléchargement des images produits Amazon...\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Dossier créé: ${OUTPUT_DIR}\n`);
  }

  const results = [];

  for (const asin of ASINS) {
    const result = await downloadAsin(asin);
    results.push(result);
    await sleep(500); // Respecter le rate limiting Amazon
  }

  // Résumé
  const ok      = results.filter(r => r.status !== 'failed');
  const failed  = results.filter(r => r.status === 'failed');

  console.log(`\n📊 Résultat: ${ok.length}/${ASINS.length} images téléchargées`);

  if (failed.length > 0) {
    console.log(`❌ Échecs: ${failed.map(r => r.asin).join(', ')}`);
  }

  // Générer le mapping ASIN → URL locale
  const mapping = {};
  for (const asin of ASINS) {
    const dest = path.join(OUTPUT_DIR, `${asin}.jpg`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
      mapping[asin] = `/products/${asin}.jpg`;
    }
  }

  const mappingPath = path.join(__dirname, '../src/data/product-images.json');
  if (!fs.existsSync(path.dirname(mappingPath))) {
    fs.mkdirSync(path.dirname(mappingPath), { recursive: true });
  }
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`\n💾 Mapping sauvegardé: src/data/product-images.json`);
  console.log(`   ${Object.keys(mapping).length} images locales disponibles`);

  console.log('\n✅ Terminé ! Prochaine étape : git add public/products/ && git push');
}

main().catch(console.error);

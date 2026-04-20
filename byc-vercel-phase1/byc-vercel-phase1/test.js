/**
 * Test parsers locally.
 * 
 * Usage:
 *   cp .env.example .env.local   (điền credentials vào)
 *   npm install
 *   node test.js
 */
import 'dotenv/config';
import { readAdsOverview } from './lib/parsers/ads.js';
import { readProducts } from './lib/parsers/products.js';
import { readKpiTeams } from './lib/parsers/kpi.js';
import { buildDataObject } from './lib/builder.js';

function log(title, value) {
  console.log(`\n===== ${title} =====`);
  console.log(JSON.stringify(value, null, 2).slice(0, 2000));
}

async function main() {
  const testAll = process.argv[2] !== '--single';

  console.log('Testing parsers with Sheet ID:', process.env.SHEET_ID?.slice(0, 20) + '...');
  console.log('Service account:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);

  try {
    console.log('\n[1/4] Testing readAdsOverview...');
    const ads = await readAdsOverview();
    log('ADS Overview', ads);
    console.log(`  → ${ads.length} rows`);

    console.log('\n[2/4] Testing readProducts (có thể mất 2-5s)...');
    const startTs = Date.now();
    const products = await readProducts();
    console.log(`  → ${products.length} products trong ${Date.now() - startTs}ms`);
    log('First product', products[0]);

    console.log('\n[3/4] Testing readKpiTeams...');
    const kpi = await readKpiTeams();
    log('KPI teams', kpi);
    console.log(`  → Full Month: ${kpi.fullMonth?.length || 0}, Run Rate: ${kpi.runRate?.length || 0}`);

    if (testAll) {
      console.log('\n[4/4] Testing full buildDataObject (parallel)...');
      const startAll = Date.now();
      const data = await buildDataObject();
      console.log(`  → Build time: ${Date.now() - startAll}ms`);
      console.log('  → Keys:', Object.keys(data));
      console.log('  → Summary:', {
        products: data.products?.length,
        adsRows: data.adsOverview?.length,
        fullMonth: data.kpiTeams?.fullMonth?.length,
        totalGmv: data.summary?.totals?.gmv,
        totalRoi: data.summary?.totals?.roi,
      });
    }

    console.log('\n✅ All parsers OK!');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();

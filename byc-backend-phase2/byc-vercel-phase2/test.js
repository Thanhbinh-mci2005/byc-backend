/**
 * Test tất cả parsers locally.
 * Usage: node test.js
 */
import 'dotenv/config';
import { readAdsOverview } from './lib/parsers/ads.js';
import { readProducts } from './lib/parsers/products.js';
import { readKpiTeams } from './lib/parsers/kpi.js';
import { readInventoryVariants } from './lib/parsers/inventory.js';
import { readDailyGmv } from './lib/parsers/dailyGmv.js';
import { buildDataObject } from './lib/builder.js';

async function main() {
  console.log('Sheet ID:', process.env.SHEET_ID?.slice(0, 20) + '...');
  console.log('Service account:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  console.log();

  try {
    console.log('[1/6] readAdsOverview...');
    const ads = await readAdsOverview();
    console.log(`  ✓ ${ads.length} rows`);

    console.log('[2/6] readProducts...');
    let ts = Date.now();
    const products = await readProducts();
    console.log(`  ✓ ${products.length} products (${Date.now() - ts}ms)`);

    console.log('[3/6] readKpiTeams...');
    const kpi = await readKpiTeams();
    console.log(`  ✓ fullMonth=${kpi.fullMonth?.length}, runRate=${kpi.runRate?.length}`);

    console.log('[4/6] readInventoryVariants...');
    ts = Date.now();
    const inv = await readInventoryVariants();
    console.log(`  ✓ ${inv.variants.length} variants, ${Object.keys(inv.bySkuParent).length} parent SKUs (${Date.now() - ts}ms)`);

    console.log('[5/6] readDailyGmv...');
    ts = Date.now();
    const daily = await readDailyGmv();
    console.log(`  ✓ Shopee=${Object.keys(daily.shopee).length} items, Tiktok=${Object.keys(daily.tiktok).length} items, ${daily.dates.length} dates (${Date.now() - ts}ms)`);

    console.log('[6/6] buildDataObject (full parallel)...');
    ts = Date.now();
    const data = await buildDataObject();
    console.log(`  ✓ Build time: ${Date.now() - ts}ms`);
    console.log(`  ✓ Summary: GMV=${data.summary.totals.gmv}, Products=${data.summary.totals.products}, ROI=${data.summary.totals.roi?.toFixed(2)}`);

    console.log('\n✅ All parsers OK!');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();

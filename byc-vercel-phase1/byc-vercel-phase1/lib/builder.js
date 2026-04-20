/**
 * Build toàn bộ data object bằng cách gọi tất cả parsers parallel.
 * Port từ Code.gs buildDataObject().
 */
import { readProducts } from './parsers/products.js';
import { readAdsOverview } from './parsers/ads.js';
import { readKpiTeams } from './parsers/kpi.js';

export async function buildDataObject() {
  const startTs = Date.now();

  // Parallel fetch — each parser is 1+ Sheets API calls
  const [products, adsOverview, kpiTeams] = await Promise.all([
    readProducts().catch(err => {
      console.error('readProducts failed:', err);
      return [];
    }),
    readAdsOverview().catch(err => {
      console.error('readAdsOverview failed:', err);
      return [];
    }),
    readKpiTeams().catch(err => {
      console.error('readKpiTeams failed:', err);
      return { fullMonth: [], runRate: [] };
    }),
  ]);

  const generatedAt = new Date().toISOString();
  const summary = buildSummary(products, adsOverview);

  return {
    generatedAt,
    _snapshotSavedAt: generatedAt,
    _buildTimeMs: Date.now() - startTs,
    products,
    adsOverview,
    kpiTeams,
    summary,
    // Phase 2 will add:
    // inventory, dailyGmv
  };
}

function buildSummary(products, adsOverview) {
  const totals = products.reduce((acc, p) => {
    acc.gmv += (p.finance?.gmvShopee || 0) + (p.finance?.gmvTiktok || 0);
    acc.gmvShopee += p.finance?.gmvShopee || 0;
    acc.gmvTiktok += p.finance?.gmvTiktok || 0;
    acc.ads += (p.finance?.adsShopee || 0) + (p.finance?.adsTiktok || 0);
    acc.adsShopee += p.finance?.adsShopee || 0;
    acc.adsTiktok += p.finance?.adsTiktok || 0;
    acc.bookingCost += p.finance?.bookingCost || 0;
    acc.inventory += p.inventory || 0;
    acc.products += 1;
    if (p.status === 'SP đang bán') acc.active += 1;
    return acc;
  }, {
    gmv: 0, gmvShopee: 0, gmvTiktok: 0,
    ads: 0, adsShopee: 0, adsTiktok: 0, bookingCost: 0,
    inventory: 0, products: 0, active: 0,
  });
  totals.totalCost = totals.ads + totals.bookingCost;
  totals.roi = totals.totalCost > 0 ? totals.gmv / totals.totalCost : null;

  const byTeam = {};
  for (const p of products) {
    const team = p.team || 'Khác';
    if (!byTeam[team]) byTeam[team] = { gmvShopee: 0, gmvTiktok: 0, count: 0 };
    byTeam[team].gmvShopee += p.finance?.gmvShopee || 0;
    byTeam[team].gmvTiktok += p.finance?.gmvTiktok || 0;
    byTeam[team].count += 1;
  }

  const byStatus = {};
  for (const p of products) {
    const s = p.status || 'Không rõ';
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  const top20ByGmv = [...products]
    .map(p => ({
      sku: p.sku, name: p.name, team: p.team,
      gmvShopee: p.finance?.gmvShopee || 0,
      gmvTiktok: p.finance?.gmvTiktok || 0,
      gmv: (p.finance?.gmvShopee || 0) + (p.finance?.gmvTiktok || 0),
      ads: (p.finance?.adsShopee || 0) + (p.finance?.adsTiktok || 0),
      roi: p.finance?.roiTotal,
      imageUrl: p.imageUrl,
    }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 20);

  return { totals, byTeam, byStatus, top20ByGmv };
}

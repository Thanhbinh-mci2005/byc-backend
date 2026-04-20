/**
 * Port từ Code.gs readAdsOverview().
 * Sheet: "TỔNG QUAN ADS 2 SÀN"
 * Range: A3:O7 (5 rows × 15 cols)
 */
import { batchGetRanges } from '../sheets.js';
import { CONFIG, toNumber } from '../config.js';

export async function readAdsOverview() {
  const range = `'${CONFIG.SHEET_ADS}'!A3:O7`;
  // UNFORMATTED_VALUE để giữ raw numbers
  const [valueRange] = await batchGetRanges([range], 'UNFORMATTED_VALUE');
  const rows = valueRange.values || [];

  const result = [];
  for (const row of rows) {
    const team = (row[0] || '').toString().trim();
    if (!team) continue;
    result.push({
      team,
      isTotal: team.toLowerCase() === 'tổng',
      shopee: {
        dailySpend: toNumber(row[1]),
        totalSpend: toNumber(row[2]),
        budget: toNumber(row[3]),
        budgetUsageRate: toNumber(row[4]),
        adRevenue: toNumber(row[5]),
        roas: toNumber(row[6]),
        dailyBudgetUsed: toNumber(row[7]),
      },
      tiktok: {
        dailySpend: toNumber(row[8]),
        totalSpend: toNumber(row[9]),
        budget: toNumber(row[10]),
        dailyBudget: toNumber(row[11]),
        budgetUsageRate: toNumber(row[12]),
        revenueYesterday: toNumber(row[13]),
        revenueToday: toNumber(row[14]),
      },
    });
  }
  return result;
}

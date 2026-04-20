/**
 * Port từ Code.gs readKpiTeams().
 * Sheet chứa keyword "kpi" hoặc "vận hành" — tự tìm trong metadata.
 * Parse 2 bảng: Full Month + Run Rate.
 */
import { getSheetMetadata, getRange } from '../sheets.js';
import { CONFIG, normalizeText, toNumber } from '../config.js';

/**
 * Tìm sheet name match keyword.
 */
async function findKpiSheetName() {
  const sheetsMeta = await getSheetMetadata();
  for (const s of sheetsMeta) {
    const name = normalizeText(s.properties.title);
    for (const kw of CONFIG.SHEET_KPI_KEYWORDS) {
      if (name.includes(normalizeText(kw))) return s.properties.title;
    }
  }
  return null;
}

function findKpiSections(allData) {
  const sections = { fullMonth: null, runRate: null };
  for (let r = 0; r < allData.length; r++) {
    const row = allData[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = normalizeText(row[c]);
      if (!cell) continue;
      if (cell === 'full month' && !sections.fullMonth) {
        sections.fullMonth = { labelRow: r + 1, headerRow: r + 2 };
      } else if ((cell === 'run rate' || cell === 'runrate') && !sections.runRate) {
        sections.runRate = { labelRow: r + 1, headerRow: r + 2 };
      }
    }
  }
  return sections;
}

function parseKpiTable(allData, section) {
  const HEADER_LIKE = new Set(['group', 'team', 'nhom', 'kpi', '']);
  const dataStartRow = section.headerRow + 1;
  const values = allData.slice(dataStartRow, dataStartRow + 8);

  const rows = [];
  for (const row of values) {
    if (!row) continue;
    const groupName = String(row[2] || '').trim();
    if (!groupName) continue;

    const normalizedGroup = normalizeText(groupName);
    if (HEADER_LIKE.has(normalizedGroup)) continue;

    const hasAnyNumber = [3, 4, 5, 10, 11, 12, 14, 16, 18, 20, 21, 22].some(col => {
      const v = toNumber(row[col]);
      return v != null && v !== 0;
    });
    if (!hasAnyNumber) continue;

    const isTotal = normalizedGroup === 'total' || normalizedGroup === 'tong';

    rows.push({
      group: groupName,
      isTotal,
      skuKpi:   toNumber(row[3]),
      ranking:  toNumber(row[4]),
      finalScore: toNumber(row[5]),
      kpis: {
        shopeeGmvPct: toNumber(row[6]),
        shopeeSkuPct: toNumber(row[7]),
        tiktokGmvPct: toNumber(row[8]),
        tiktokSkuPct: toNumber(row[9]),
      },
      actual: {
        shopeeGmv: toNumber(row[10]),
        shopeeSku: toNumber(row[11]),
        tiktokGmv: toNumber(row[12]),
        tiktokSku: toNumber(row[13]),
      },
      target: {
        shopeeGmv: toNumber(row[14]),
        shopeeSku: toNumber(row[15]),
        tiktokGmv: toNumber(row[16]),
        tiktokSku: toNumber(row[17]),
      },
      mom: {
        shopeeGmv: toNumber(row[18]),
        tiktokGmv: toNumber(row[19]),
        total: toNumber(row[20]),
      },
      mMinus1: {
        shopeeGmv: toNumber(row[21]),
        tiktokGmv: toNumber(row[22]),
      },
    });

    if (isTotal) break;
  }

  return rows;
}

export async function readKpiTeams() {
  const sheetName = await findKpiSheetName();
  if (!sheetName) {
    console.warn('KPI sheet not found');
    return { fullMonth: [], runRate: [] };
  }

  // Lấy 40 rows × 25 cols (A1:Y40) — đủ cover 2 bảng
  const range = `'${sheetName}'!A1:Y40`;
  const allData = await getRange(range, 'UNFORMATTED_VALUE');

  const sections = findKpiSections(allData);
  const result = { fullMonth: [], runRate: [] };
  if (sections.fullMonth) result.fullMonth = parseKpiTable(allData, sections.fullMonth);
  if (sections.runRate)   result.runRate   = parseKpiTable(allData, sections.runRate);
  return result;
}

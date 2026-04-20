/**
 * Config cho Sheet structure (port từ Code.gs CONFIG)
 */
export const CONFIG = {
  SHEET_MAIN: 'BỘ CHỈ SỐ',
  SHEET_ADS: 'TỔNG QUAN ADS 2 SÀN',
  SHEET_INVENTORY: 'Tồn kho',
  SHEET_DAILY_GMV: 'GMV Daily',
  SHEET_DAILY_GMV_PREV: 'GMV Daily M-1',
  SHEET_KPI_KEYWORDS: ['kpi', 'vận hành'],
  HEADER_ROW: 6,
  DATA_START_ROW: 7,
  MAX_EMPTY_ROWS: 5,
};

export const COL_MATCHERS = {
  shopeeId:      ['id shopee'],
  tiktokId:      ['id tiktok'],
  name:          ['ten san pham', 'ten sp'],
  sku:           ['sku'],
  team:          ['team'],
  status:        ['trang thai'],
  productType:   ['loai san pham', 'loai sp'],
  inventory:     ['ton hang'],
  priceShopee:   ['gia thu ve shp', 'gia thu ve shopee', 'gia shp', 'gia shopee'],
  priceTiktok:   ['gia thu ve tiktok', 'gia thu ve tt', 'gia tiktok', 'gia tt', 'gia thu ve tts', 'gia tts'],
  priceExpected: ['gia ki vong', 'gia ky vong'],
  sold7d2Platform:  ['x 2 san 7n', 'x 2 san'],
  sold30d2Platform: ['so ban 30n 2 san', 'so ban 30n', 'x 30n 2 san'],
  gmvShopee:     ['gmv shp', 'gmv shopee'],
  gmvTiktok:     ['gmv tts', 'gmv tiktok', 'gmv tt'],
  adsShopee:     ['ads shopee', 'ads shp'],
  adsTiktok:     ['ads tiktok', 'ads tt'],
  bookingCost:   ['chi phi booking'],
  roiTotal:      ['roi tong'],
  kpiVideos:     ['kpi so video', 'kpi video'],
  actualVideos:  ['so video booking'],
  gmvBooking:    ['gmv booking'],
  growthShopee:  ['tang truong shopee'],
  growthTiktok:  ['tang truong tiktok'],
  growthWh:      ['kho hang'],
  inventoryReal: ['ton thuc te'],
  noteReview:    ['nhan xet'],
  noteSuggest:   ['de xuat'],
  actionPrev:    ['7n truoc', 'action 31/3'],
  actionNext:    ['7n sau', 'action 1/4'],
};

export function normalizeText(s) {
  if (s == null) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  const isPercent = s.endsWith('%');
  if (isPercent) s = s.slice(0, -1).trim();
  const hasDot = s.indexOf('.') !== -1;
  const hasComma = s.indexOf(',') !== -1;
  if (hasDot && hasComma) s = s.replace(/\./g, '').replace(',', '.');
  else if (hasDot) {
    const dots = (s.match(/\./g) || []).length;
    if (dots > 1) s = s.replace(/\./g, '');
  } else if (hasComma) s = s.replace(',', '.');
  s = s.replace(/[^\d.\-]/g, '');
  if (!s || s === '-' || s === '.') return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return isPercent ? n / 100 : n;
}

export function parsePriceCell(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const m = String(v).trim().match(/[\d][\d.,]*/);
  return m ? toNumber(m[0]) : null;
}

export function colIdxToLetter(idx) {
  let result = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

/**
 * Port từ Code.gs:
 * - detectColumns(): zone-based scan, image URL detect
 * - readProducts(): map 90+ cols → product objects
 *
 * Key difference với Apps Script:
 * - Dùng Sheets API values.get thay vì SpreadsheetApp
 * - getDisplayValues() không có, thay bằng valueRenderOption='FORMATTED_VALUE'
 *   (riêng cho image URL detect, cần raw values)
 */
import { batchGetRanges, getRange, getSheetMetadata } from '../sheets.js';
import { CONFIG, COL_MATCHERS, normalizeText, toNumber, parsePriceCell, colIdxToLetter } from '../config.js';

/**
 * Scan qua 3 super-header rows (3, 4, 5) + main header row (6) + 5 data rows đầu
 * để tạo column map. Tương tự Code.gs detectColumns() nhưng gọi API thay vì Sheet.
 */
async function detectColumns() {
  // Lấy tất cả rows cần thiết trong 1 batch call
  const mainSheet = CONFIG.SHEET_MAIN;
  // Dùng column letter rộng A:CV (= 100 cols), sẽ trim khi parse
  const ranges = [
    `'${mainSheet}'!A3:CV3`,  // super row 3
    `'${mainSheet}'!A4:CV4`,  // super row 4
    `'${mainSheet}'!A5:CV5`,  // super row 5
    `'${mainSheet}'!A6:CV6`,  // main header row
    `'${mainSheet}'!A7:CV11`, // first 5 data rows (for image URL detect)
  ];
  const [r3, r4, r5, r6, dataSample] = await batchGetRanges(ranges, 'UNFORMATTED_VALUE');

  const headerRow = (r6.values && r6.values[0]) || [];
  const superRow3 = (r3.values && r3.values[0]) || [];
  const superRow4 = (r4.values && r4.values[0]) || [];
  const superRow5 = (r5.values && r5.values[0]) || [];
  const sampleRows = dataSample.values || [];

  const headers = headerRow.map(h => normalizeText(h));
  const super3 = superRow3.map(h => normalizeText(h));
  const super4 = superRow4.map(h => normalizeText(h));
  const super5 = superRow5.map(h => normalizeText(h));

  const result = {};

  // Pad arrays tới cùng length
  const maxLen = Math.max(headers.length, super3.length, super4.length, super5.length);
  while (headers.length < maxLen) headers.push('');
  while (super3.length < maxLen) super3.push('');
  while (super4.length < maxLen) super4.push('');
  while (super5.length < maxLen) super5.push('');

  // Fill-forward super-header (merged cells trong Apps Script trả về value cho cell đầu, các cell sau empty)
  let cur3 = '', cur4 = '', cur5 = '';
  const superAt3 = headers.map((_, i) => { if (super3[i]) cur3 = super3[i]; return cur3; });
  const superAt4 = headers.map((_, i) => { if (super4[i]) cur4 = super4[i]; return cur4; });
  const superAt5 = headers.map((_, i) => { if (super5[i]) cur5 = super5[i]; return cur5; });

  // Anchor detection: cột nào có "shopee"/"shp" hoặc "tiktok"/"tts" trong raw super text
  const shopeeAnchors = [];
  const tiktokAnchors = [];
  for (let i = 0; i < headers.length; i++) {
    const combined = (super3[i] || '') + ' ' + (super4[i] || '') + ' ' + (super5[i] || '');
    if (/shopee|shp/.test(combined) && !/tiktok|tts/.test(combined)) shopeeAnchors.push(i);
    if (/tiktok|tts/.test(combined) && !/shopee|shp/.test(combined)) tiktokAnchors.push(i);
  }

  // Zone map: mỗi col thuộc shopee/tiktok/neither dựa vào anchor gần nhất bên trái
  const zoneAt = new Array(headers.length).fill('');
  let lastShopeeAnchor = -1;
  let lastTiktokAnchor = -1;
  for (let i = 0; i < headers.length; i++) {
    if (shopeeAnchors.includes(i)) lastShopeeAnchor = i;
    if (tiktokAnchors.includes(i)) lastTiktokAnchor = i;
    if (lastShopeeAnchor > lastTiktokAnchor && lastShopeeAnchor >= 0) zoneAt[i] = 'shopee';
    else if (lastTiktokAnchor > lastShopeeAnchor && lastTiktokAnchor >= 0) zoneAt[i] = 'tiktok';
  }

  // Normal matchers: match theo keyword
  for (const [key, matchers] of Object.entries(COL_MATCHERS)) {
    for (const kw of matchers) {
      const kwNorm = normalizeText(kw);
      let idx = headers.findIndex(h => h === kwNorm);
      if (idx === -1) idx = headers.findIndex(h => h && h.includes(kwNorm));
      if (idx !== -1) { result[key] = idx; break; }
    }
  }

  // Tiktok sub-sections (SHOP TAB / LIVE / VIDEO / THẺ SẢN PHẨM) ở row 5
  const tiktokSections = ['shop tab', 'live', 'video', 'the san pham'];
  const tiktokKeys = ['ttShopTab', 'ttLive', 'ttVideo', 'ttCard'];
  for (let s = 0; s < tiktokSections.length; s++) {
    const sectionName = tiktokSections[s];
    const key = tiktokKeys[s];
    result[key] = {};
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (!h || superAt5[i] !== sectionName) continue;
      if (h === 'view') result[key].view = i;
      else if (h === 'ctr') result[key].ctr = i;
      else if (h === 'cr') result[key].cr = i;
    }
  }

  // Shopee/Tiktok metrics qua zone
  const shpCols = { sold30d: null, sold7d: null, cr: null, ctr: null, view: null, visit: null };
  const ttCols = { sold30d: null, sold7d: null };

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    const zone = zoneAt[i];
    const has30 = /\bx\s*\(?\s*30\s*n\s*\)?/.test(h) || h.includes('30n');
    const has7  = /\bx\s*\(?\s*7\s*n\s*\)?/.test(h) || h.includes('7n');
    const is2San = h.includes('2 san') || h.includes('2san');

    if (zone === 'shopee') {
      if (h === 'cr' && shpCols.cr == null) shpCols.cr = i;
      else if (h === 'ctr' && shpCols.ctr == null) shpCols.ctr = i;
      else if ((h === 'luot truy cap' || h.includes('luot truy cap') || h === 'visit') && shpCols.visit == null) shpCols.visit = i;
      else if ((h === 'view' || h === 'luot xem' || h.includes('luot xem')) && shpCols.view == null) shpCols.view = i;
    }

    if (is2San) continue;
    if (!has30 && !has7) continue;

    if (zone === 'shopee') {
      if (has30 && shpCols.sold30d == null) shpCols.sold30d = i;
      else if (has7 && shpCols.sold7d == null) shpCols.sold7d = i;
    } else if (zone === 'tiktok') {
      if (has30 && ttCols.sold30d == null) ttCols.sold30d = i;
      else if (has7 && ttCols.sold7d == null) ttCols.sold7d = i;
    }
  }

  result.soldShopee = shpCols;
  result.soldTiktok = ttCols;

  // Detect image URL column: scan 5 data rows, cột nào có >= 3 URL → là ảnh
  const urlRegex = /^https?:\/\/\S+/i;
  let imageUrlCol = null;
  const sampleCols = Math.max(...sampleRows.map(r => r.length), 0);
  for (let c = 0; c < sampleCols; c++) {
    let urlCount = 0;
    for (let r = 0; r < sampleRows.length; r++) {
      const v = sampleRows[r][c];
      if (typeof v === 'string' && urlRegex.test(v.trim())) urlCount++;
    }
    if (urlCount >= 3) {
      imageUrlCol = c;
      break;
    }
  }
  result.imageUrl = imageUrlCol;

  return result;
}

/**
 * Main entry: detect columns + read products.
 */
export async function readProducts() {
  const colMap = await detectColumns();

  // Đọc toàn bộ data rows (từ row 7 đến end, ~270 rows × 90 cols)
  // Dùng A:CV để cover ~100 cols
  const dataRange = `'${CONFIG.SHEET_MAIN}'!A${CONFIG.DATA_START_ROW}:CV`;
  const values = await getRange(dataRange, 'UNFORMATTED_VALUE');

  const get = (row, key) => colMap[key] != null ? row[colMap[key]] : null;
  const getSection = (row, key) => {
    const sec = colMap[key];
    if (!sec) return { view: null, ctr: null, cr: null };
    return {
      view: sec.view != null ? toNumber(row[sec.view]) : null,
      ctr:  sec.ctr  != null ? toNumber(row[sec.ctr])  : null,
      cr:   sec.cr   != null ? toNumber(row[sec.cr])   : null,
    };
  };

  const products = [];
  let emptyStreak = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const shopeeId = get(row, 'shopeeId');
    const tiktokId = get(row, 'tiktokId');

    if (!shopeeId && !tiktokId) {
      emptyStreak++;
      if (emptyStreak >= CONFIG.MAX_EMPTY_ROWS) break;
      continue;
    }
    emptyStreak = 0;

    const name = get(row, 'name');
    if (!name || !String(name).trim()) continue;

    products.push({
      rowNum: CONFIG.DATA_START_ROW + i,
      shopeeId: shopeeId ? String(shopeeId).trim() : null,
      tiktokId: tiktokId ? String(tiktokId).trim() : null,
      name: String(name).trim(),
      sku: get(row, 'sku') ? String(get(row, 'sku')).trim() : null,
      team: get(row, 'team') ? String(get(row, 'team')).trim() : null,
      status: get(row, 'status') ? String(get(row, 'status')).trim() : null,
      productType: get(row, 'productType') ? String(get(row, 'productType')).trim() : null,
      inventory: toNumber(get(row, 'inventory')),
      imageUrl: colMap.imageUrl != null && typeof row[colMap.imageUrl] === 'string' && /^https?:\/\//.test(row[colMap.imageUrl].trim())
        ? row[colMap.imageUrl].trim()
        : null,
      sold2Platform7d: toNumber(get(row, 'sold7d2Platform')),
      sold2Platform30d: toNumber(get(row, 'sold30d2Platform')),
      soldShopee: {
        d30: colMap.soldShopee?.sold30d != null ? toNumber(row[colMap.soldShopee.sold30d]) : null,
        d7:  colMap.soldShopee?.sold7d  != null ? toNumber(row[colMap.soldShopee.sold7d])  : null,
        cr:  colMap.soldShopee?.cr      != null ? toNumber(row[colMap.soldShopee.cr])      : null,
        ctr: colMap.soldShopee?.ctr     != null ? toNumber(row[colMap.soldShopee.ctr])     : null,
        view: colMap.soldShopee?.view   != null ? toNumber(row[colMap.soldShopee.view])    : null,
        visit: colMap.soldShopee?.visit != null ? toNumber(row[colMap.soldShopee.visit])   : null,
      },
      soldTiktok: {
        d30: colMap.soldTiktok?.sold30d != null ? toNumber(row[colMap.soldTiktok.sold30d]) : null,
        d7:  colMap.soldTiktok?.sold7d  != null ? toNumber(row[colMap.soldTiktok.sold7d])  : null,
      },
      price: {
        shopee: parsePriceCell(get(row, 'priceShopee')),
        shopeeRaw: get(row, 'priceShopee') != null ? String(get(row, 'priceShopee')).trim() : null,
        tiktok: parsePriceCell(get(row, 'priceTiktok')),
        tiktokRaw: get(row, 'priceTiktok') != null ? String(get(row, 'priceTiktok')).trim() : null,
        expected: get(row, 'priceExpected') ? String(get(row, 'priceExpected')).trim() : null,
      },
      tiktok: {
        shopTab: getSection(row, 'ttShopTab'),
        live:    getSection(row, 'ttLive'),
        video:   getSection(row, 'ttVideo'),
        card:    getSection(row, 'ttCard'),
      },
      finance: {
        gmvShopee: toNumber(get(row, 'gmvShopee')),
        gmvTiktok: toNumber(get(row, 'gmvTiktok')),
        adsShopee: toNumber(get(row, 'adsShopee')),
        adsTiktok: toNumber(get(row, 'adsTiktok')),
        bookingCost: toNumber(get(row, 'bookingCost')),
        roiTotal: toNumber(get(row, 'roiTotal')),
      },
      booking: {
        kpiVideos: toNumber(get(row, 'kpiVideos')),
        actualVideos: toNumber(get(row, 'actualVideos')),
        gmv: toNumber(get(row, 'gmvBooking')),
      },
      growth: {
        shopee: toNumber(get(row, 'growthShopee')),
        tiktok: toNumber(get(row, 'growthTiktok')),
        warehouse: get(row, 'growthWh') ? String(get(row, 'growthWh')).trim() : null,
      },
      inventoryReal: get(row, 'inventoryReal') ? String(get(row, 'inventoryReal')).trim() : null,
      notes: {
        review: get(row, 'noteReview') ? String(get(row, 'noteReview')).trim() : null,
        suggestion: get(row, 'noteSuggest') ? String(get(row, 'noteSuggest')).trim() : null,
      },
      actions: {
        previous7d: get(row, 'actionPrev') ? String(get(row, 'actionPrev')).trim() : null,
        next7d: get(row, 'actionNext') ? String(get(row, 'actionNext')).trim() : null,
      },
    });
  }

  return products;
}

// Export for debug/test
export { detectColumns };

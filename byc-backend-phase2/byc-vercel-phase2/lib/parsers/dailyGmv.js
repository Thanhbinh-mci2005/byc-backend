/**
 * Port từ Code.gs readDailyGmv() + mergeDailyData().
 * 
 * Sheets: "GMV Daily" (tháng hiện tại) + "GMV Daily M-1" (tháng trước).
 * Mỗi sheet có 2 block trong cùng 1 row: Shopee bên trái + Tiktok bên phải.
 * 
 * Row 2 = header với pattern "1 thg 4", "2 thg 4",... hoặc "1/4", "2/4"
 * Row 3+ = data: itemid | item name | ... | daily values
 * 
 * Key challenges:
 * - Tiktok itemid 18-digit → cần FORMATTED_VALUE để không bị scientific notation
 * - Cell ngày header có thể là Date object → cần FORMATTED_VALUE để có text "1 thg 4"
 * - Daily GMV values → dùng UNFORMATTED_VALUE để parse nhanh
 */
import { batchGetRanges } from '../sheets.js';
import { CONFIG, toNumber } from '../config.js';

const dayColRegex = /^\s*\d{1,2}\s*(thg|th|\/|\-)\s*\d{1,2}\s*$/i;

/**
 * Đọc 1 sheet GMV Daily, return { shopee, tiktok, dates, shopeeByName, tiktokByName }
 */
async function readOneDailySheet(sheetName) {
  // Batch 3 ranges cùng lúc để tiết kiệm API calls:
  // - Header row 2 FORMATTED (để giữ text ngày như "1 thg 4")
  // - Data rows 3+ FORMATTED (để giữ itemid 18 chữ số)  
  // - Data rows 3+ UNFORMATTED (để parse daily values nhanh)
  // Dùng range lớn A:BQ cover cả 2 blocks
  const range = `'${sheetName}'!A:BQ`;

  const [headerRangeFormatted, dataRangeFormatted, dataRangeRaw] = await batchGetRanges(
    [
      `'${sheetName}'!2:2`,
      `'${sheetName}'!3:1000`,
      `'${sheetName}'!3:1000`,
    ],
    'FORMATTED_VALUE'
  ).then(async ([h, d]) => {
    // Fetch unformatted separately
    const [u] = await batchGetRanges([`'${sheetName}'!3:1000`], 'UNFORMATTED_VALUE');
    return [h, d, u];
  });

  const headerRow = (headerRangeFormatted?.values?.[0]) || [];
  const displayValues = dataRangeFormatted?.values || [];
  const rawValues = dataRangeRaw?.values || [];

  if (headerRow.length === 0 || displayValues.length === 0) {
    return { shopee: {}, tiktok: {}, dates: [], shopeeByName: {}, tiktokByName: {} };
  }

  // Tìm các block: mỗi block cần itemid + các daily cols liền kề
  const blocks = [];
  let i = 0;
  while (i < headerRow.length) {
    const cell = String(headerRow[i] || '').trim().toLowerCase();
    if (cell === 'itemid' || cell === 'item id') {
      const block = { itemidCol: i, nameCol: null, dailyCols: [] };
      let j = i + 1;
      let hitDate = false;
      while (j < headerRow.length) {
        const h = String(headerRow[j] || '').trim();
        const hLower = h.toLowerCase();
        if (hLower === 'item name' || hLower === 'ten san pham' || hLower === 'name') {
          block.nameCol = j;
          j++;
          continue;
        }
        if (dayColRegex.test(h)) {
          const m = h.match(/(\d+)\s*(?:thg|th|\/|\-)\s*(\d+)/i);
          if (m) {
            block.dailyCols.push({ col: j, label: h, day: parseInt(m[1]), month: parseInt(m[2]) });
          }
          hitDate = true;
          j++;
        } else if (hitDate) {
          break;
        } else {
          j++;
        }
      }
      if (block.dailyCols.length > 0) blocks.push(block);
      i = j;
    } else {
      i++;
    }
  }

  if (blocks.length === 0) {
    return { shopee: {}, tiktok: {}, dates: [], shopeeByName: {}, tiktokByName: {} };
  }

  const shopeeMap = {};
  const tiktokMap = {};
  const shopeeByName = {};
  const tiktokByName = {};

  const parseBlock = (block, targetMap, byNameMap) => {
    for (let r = 0; r < rawValues.length; r++) {
      const row = rawValues[r] || [];
      const dispRow = displayValues[r] || [];
      // Lấy itemid từ DISPLAY values để bảo toàn dạng số nguyên dài 18+ chữ số
      const id = String(dispRow[block.itemidCol] || '').trim();
      if (!id) continue;
      const name = block.nameCol != null ? String(dispRow[block.nameCol] || '').trim() : '';

      const series = block.dailyCols.map(dc => ({
        day: dc.day,
        month: dc.month,
        label: dc.label,
        value: toNumber(row[dc.col]) || 0,
      }));
      targetMap[id] = series;
      if (name) byNameMap[name] = series;
    }
  };

  if (blocks[0]) parseBlock(blocks[0], shopeeMap, shopeeByName);
  if (blocks[1]) parseBlock(blocks[1], tiktokMap, tiktokByName);

  const dates = blocks[0]
    ? blocks[0].dailyCols.map(dc => ({ day: dc.day, month: dc.month, label: dc.label }))
    : [];

  return { shopee: shopeeMap, tiktok: tiktokMap, dates, shopeeByName, tiktokByName };
}

/**
 * Merge 2 dailyData (M + M-1) thành 1, sort chronological, dedupe theo month-day.
 */
function mergeDailyData(prev, cur) {
  const merge = (prevMap, curMap) => {
    const out = {};
    const allKeys = new Set([...Object.keys(prevMap), ...Object.keys(curMap)]);
    for (const k of allKeys) {
      const prevSeries = prevMap[k] || [];
      const curSeries = curMap[k] || [];
      const seen = new Set();
      const combined = [];
      for (const d of prevSeries) {
        const key = d.month + '-' + d.day;
        if (!seen.has(key)) { seen.add(key); combined.push(d); }
      }
      for (const d of curSeries) {
        const key = d.month + '-' + d.day;
        if (!seen.has(key)) { seen.add(key); combined.push(d); }
      }
      combined.sort((a, b) => a.month - b.month || a.day - b.day);
      out[k] = combined;
    }
    return out;
  };

  return {
    shopee: merge(prev.shopee || {}, cur.shopee || {}),
    tiktok: merge(prev.tiktok || {}, cur.tiktok || {}),
    shopeeByName: merge(prev.shopeeByName || {}, cur.shopeeByName || {}),
    tiktokByName: merge(prev.tiktokByName || {}, cur.tiktokByName || {}),
    dates: [...(prev.dates || []), ...(cur.dates || [])],
  };
}

/**
 * Main entry: fetch cả M và M-1, merge, return.
 */
export async function readDailyGmv() {
  try {
    const curPromise = readOneDailySheet(CONFIG.SHEET_DAILY_GMV);
    const prevPromise = readOneDailySheet(CONFIG.SHEET_DAILY_GMV_PREV)
      .catch(() => ({ shopee: {}, tiktok: {}, dates: [], shopeeByName: {}, tiktokByName: {} }));

    const [cur, prev] = await Promise.all([curPromise, prevPromise]);
    return mergeDailyData(prev, cur);
  } catch (err) {
    console.error('readDailyGmv failed:', err.message);
    return { shopee: {}, tiktok: {}, dates: [], shopeeByName: {}, tiktokByName: {} };
  }
}

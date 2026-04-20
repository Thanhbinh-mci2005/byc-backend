/**
 * Port từ Code.gs readInventoryVariants().
 * Sheet: "Tồn kho"
 * Structure: hierarchical — mỗi SP có section header "TRENDY X - tên SP"
 *   → sub-header "Hình ảnh | SKU Sản phẩm | SKU phân loại | Màu | Size | ..."
 *   → data rows (1 row mỗi variant)
 */
import { getRange } from '../sheets.js';
import { CONFIG, toNumber } from '../config.js';

const COL = {
  skuSp: 1,             // B: SKU Sản phẩm
  skuVariant: 2,        // C: SKU phân loại
  color: 3,             // D: Màu
  size: 4,              // E: Size
  sold30d: 6,           // G: Tổng bán 30N
  sold7d: 7,            // H: Tổng bán 7N
  needOrder: 8,         // I: Tổng cần đặt
  safetyStock: 9,       // J: Ngưỡng cần đặt / Tồn an toàn
  cycle: 10,            // K: Chu kỳ
  productionTime: 11,   // L: Thời gian SX
  dailySold: 12,        // M: Số bán 1 ngày
  inventoryCurrent: 13, // N: Tồn hiện tại
  inventorySw: 14,      // O: Tồn kho SW
};

export async function readInventoryVariants() {
  const range = `'${CONFIG.SHEET_INVENTORY}'!A1:T`;
  // Dùng UNFORMATTED_VALUE để giữ số thô
  const values = await getRange(range, 'UNFORMATTED_VALUE');
  if (!values || values.length < 2) {
    return { variants: [], bySkuParent: {} };
  }

  const variants = [];
  const bySkuParent = {};

  let currentParentSku = null;
  let currentParentName = null;
  let currentTeamLabel = null;

  for (let r = 0; r < values.length; r++) {
    const row = values[r] || [];
    const colA = String(row[0] || '').trim();
    const colB = String(row[1] || '').trim();

    const isSectionHeader = colA && /^(trendy|must have|khác)/i.test(colA) && colA.includes('-');
    const isSeparatorHeader = colA && /không cần đặt/i.test(colA);

    if (isSectionHeader) {
      const match = colA.match(/^([^\-]+?)\s*-\s*(.+)$/);
      if (match) {
        currentTeamLabel = match[1].trim();
        currentParentName = match[2].trim();
      }
      currentParentSku = (row[1] || row[2] || '').toString().trim();
      if (!currentParentSku || currentParentSku.toLowerCase().includes('sku')) {
        currentParentSku = null;
      }
      continue;
    }

    if (isSeparatorHeader) {
      currentTeamLabel = 'Khác';
      currentParentName = null;
      currentParentSku = null;
      continue;
    }

    // Skip sub-header rows
    const colAnorm = colA.toLowerCase();
    const colBnorm = colB.toLowerCase();
    if (colAnorm === 'hình ảnh' || colBnorm === 'sku sản phẩm') continue;

    const skuSp = String(row[COL.skuSp] || '').trim();
    const skuVariant = String(row[COL.skuVariant] || '').trim();
    const color = String(row[COL.color] || '').trim();
    const size = row[COL.size];

    if (!skuSp) continue;
    if (!color && (size === '' || size == null)) continue;

    if (!currentParentSku) currentParentSku = skuSp;

    const variant = {
      skuParent: skuSp,
      skuVariant,
      color,
      size: size != null && size !== '' ? String(size) : null,
      parentName: currentParentName,
      teamLabel: currentTeamLabel,
      sold30d: toNumber(row[COL.sold30d]),
      sold7d: toNumber(row[COL.sold7d]),
      needOrder: toNumber(row[COL.needOrder]),
      safetyStock: toNumber(row[COL.safetyStock]),
      cycle: toNumber(row[COL.cycle]),
      productionTime: toNumber(row[COL.productionTime]),
      dailySold: toNumber(row[COL.dailySold]),
      inventoryCurrent: toNumber(row[COL.inventoryCurrent]),
      inventorySw: toNumber(row[COL.inventorySw]),
    };

    variants.push(variant);
    if (!bySkuParent[skuSp]) bySkuParent[skuSp] = [];
    bySkuParent[skuSp].push(variant);
  }

  return { variants, bySkuParent };
}

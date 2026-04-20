# BYC Dashboard — Vercel Backend

Serverless Node.js API đọc Google Sheet qua Google Sheets API (Service Account auth). Deploy Vercel.

## Kiến trúc

```
Vercel Serverless Function (api/data.js)
   ↓
lib/builder.js (orchestrate, parallel fetch)
   ├── parsers/products.js     — readProducts + detectColumns (main sheet)
   ├── parsers/ads.js          — readAdsOverview
   ├── parsers/kpi.js          — readKpiTeams (auto find sheet by keyword)
   ├── parsers/inventory.js    — TODO Phase 2
   └── parsers/dailyGmv.js     — TODO Phase 2
   ↓
lib/sheets.js (Google Sheets API client, JWT auth)
   ↓
Google Sheets API v4
   ↓
Sheet "Dashboard Bycamcam"
```

---

## Setup Local

### 1. Install deps

```bash
npm install
```

### 2. Config credentials

```bash
cp .env.example .env.local
# Mở .env.local, điền:
# - SHEET_ID (đã có sẵn)
# - GOOGLE_SERVICE_ACCOUNT_EMAIL (từ file JSON download)
# - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (từ file JSON, giữ \n)
```

**Cách copy private_key đúng**:
1. Mở file JSON credentials (vd `byc-dashboard-xxxx.json`) trong VS Code
2. Copy toàn bộ value của field `private_key` — bao gồm cả `\n` và dấu ngoặc kép
3. Paste sau dấu `=` trong `.env.local`

Ví dụ đúng:
```
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ...\n-----END PRIVATE KEY-----\n"
```

### 3. Test parsers

```bash
node test.js
```

Output mong đợi:
```
Testing parsers with Sheet ID: 149YvRLeXT...
Service account: byc-dashboard-reader@...

[1/4] Testing readAdsOverview...
  → 5 rows

[2/4] Testing readProducts...
  → 262 products in 2500ms

[3/4] Testing readKpiTeams...
  → Full Month: 5, Run Rate: 5

[4/4] Testing full buildDataObject (parallel)...
  → Build time: 3200ms

✅ All parsers OK!
```

### 4. Test Vercel Serverless Function local

```bash
npm i -g vercel    # first time only
vercel dev
```

Mở http://localhost:3000/api/data → trả JSON.

---

## Deploy Vercel

### 1. Push GitHub

```bash
git init
git add .
git commit -m "Initial BYC backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/byc-backend.git
git push -u origin main
```

### 2. Import Vercel

1. vercel.com → Add New → Project → Import repo
2. Framework Preset: **Other** (vì không có build step)
3. **Environment Variables** (CRITICAL):
   - `SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (paste nguyên value từ .env.local, giữ `\n` và dấu `"`)
4. Deploy

URL: `https://byc-backend-xxx.vercel.app/api/data`

---

## Troubleshooting

**403 Permission Denied**
→ Service Account chưa được share Sheet. Check email SA có trong danh sách share của Sheet.

**`Missing GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`**
→ `.env.local` chưa được load hoặc thiếu field. Run `node -e "console.log(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)"` để check.

**`DECODER routines::unsupported`**
→ Private key format sai. Thường do `\n` bị replace thành newline thật. Giữ nguyên `\n` trong `.env.local`.

**Products count = 0**
→ Header detection fail. Kiểm tra:
- Sheet name có đúng là `BỘ CHỈ SỐ` (hoặc update `CONFIG.SHEET_MAIN` trong `lib/config.js`)
- HEADER_ROW = 6, DATA_START_ROW = 7 (nếu sheet khác thì update)

---

## Phase status

- ✅ Phase 1: products, ads, kpi parsers + summary
- ⏳ Phase 2: inventory + daily GMV + merge M-1
- ⏳ Phase 3: Vercel KV cache
- ⏳ Phase 4: connect frontend

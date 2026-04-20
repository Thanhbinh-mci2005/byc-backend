/**
 * Google Sheets API client dùng Service Account credentials
 * 
 * Env vars required (set trong Vercel Dashboard):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (với \n giữ nguyên)
 *   SHEET_ID
 */
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

let sheetsClient = null;

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKey) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars');
  }
  return new JWT({
    email,
    // Private key env var thường có \\n escaped — replace thành \n thật
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

export function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const auth = getAuth();
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export function getSheetId() {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error('Missing SHEET_ID env var');
  return id;
}

/**
 * Batch get nhiều ranges trong 1 API call (tiết kiệm quota + nhanh).
 * @param {string[]} ranges - mảng A1 notation, ví dụ ['BỘ CHỈ SỐ!A1:Z10', 'Tồn kho!A:K']
 * @param {string} valueRenderOption - 'FORMATTED_VALUE' (default, text như user thấy)
 *                                    | 'UNFORMATTED_VALUE' (raw value, số/ngày)
 *                                    | 'FORMULA' (công thức)
 */
export async function batchGetRanges(ranges, valueRenderOption = 'FORMATTED_VALUE') {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption,
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data.valueRanges || [];
}

/**
 * Get 1 range với options linh hoạt.
 */
export async function getRange(range, valueRenderOption = 'FORMATTED_VALUE') {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption,
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data.values || [];
}

/**
 * Get metadata of sheets (list sheets with IDs, row counts).
 */
export async function getSheetMetadata() {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  return res.data.sheets || [];
}

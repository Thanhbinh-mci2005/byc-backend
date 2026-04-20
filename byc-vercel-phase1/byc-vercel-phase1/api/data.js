/**
 * Vercel Serverless Function: GET /api/data
 * 
 * Query params:
 *   bust=1 → skip cache, fetch fresh from Sheet
 * 
 * Response: JSON data object (same shape as Apps Script getData)
 */
import { buildDataObject } from '../lib/builder.js';

// CORS headers (cho phép frontend Vercel fetch)
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bustCache = req.query.bust === '1';

  try {
    // TODO: add Vercel KV cache (Phase 3)
    const data = await buildDataObject();
    data._fromCache = false;
    return res.status(200).json(data);
  } catch (err) {
    console.error('Error building data:', err);
    return res.status(500).json({
      error: err.message || 'Internal error',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}

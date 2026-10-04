/**
 * Chronex Local Development & Production Preview Server
 * Zero external dependencies — pure Node.js HTTP static server & Live Economic Calendar API proxy.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// In-memory cache for live economic calendar
let calendarCache = {
  timestamp: 0,
  data: null
};

const server = http.createServer(async (req, res) => {
  // CORS & Security headers for PWA testing & API access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse path
  let safePath = req.url.split('?')[0];

  // Live Economic Calendar API Route
  if (safePath === '/api/calendar') {
    const now = Date.now();
    // Cache for 5 minutes (300,000 ms)
    if (calendarCache.data && (now - calendarCache.timestamp < 300000)) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Cache': 'HIT',
        'X-Cache-Age-Seconds': Math.round((now - calendarCache.timestamp) / 1000)
      });
      res.end(JSON.stringify(calendarCache.data));
      return;
    }

    try {
      const response = await fetch('https://www.financecalendar.com/wp-json/fc/v1/calendar', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chronex-Dashboard/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Upstream returned HTTP ${response.status}`);
      }

      const data = await response.json();
      calendarCache = { timestamp: now, data };

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Cache': 'MISS'
      });
      res.end(JSON.stringify(data));
      return;
    } catch (err) {
      console.error('[API Proxy] Error fetching economic calendar:', err.message);
      if (calendarCache.data) {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Cache': 'STALE'
        });
        res.end(JSON.stringify(calendarCache.data));
      } else {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          error: 'Failed to retrieve economic calendar from upstream',
          message: err.message
        }));
      }
      return;
    }
  }

  if (safePath === '/') safePath = '/index.html';

  const fullPath = path.join(__dirname, safePath);

  // Prevent directory traversal
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Service Worker should not be aggressively cached
    if (safePath === '/sw.js') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('\n======================================================');
  console.log('   CHRONEX — Economic & Session Countdown Dashboard   ');
  console.log('======================================================');
  console.log(`\n  🟢 Local Server Running at: http://localhost:${PORT}`);
  console.log(`  📊 Live Calendar API Proxy: http://localhost:${PORT}/api/calendar`);
  console.log(`  📱 PWA Manifest & Service Worker: Active`);
  console.log(`  ⏹  Press Ctrl+C to stop the server\n`);
});

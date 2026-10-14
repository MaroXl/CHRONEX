/**
 * Chronex High-Performance Backend Server
 * 
 * Features:
 * - Pure Node.js HTTP Server with zero external runtime dependencies.
 * - Server-side Market Sessions & Overlap Engine (offloads timeline & overlap math).
 * - Live Economic Calendar Ingestion, Caching, Normalization & Query Filtering.
 * - Persistent Cloud Event Storage & Sync Engine (per-user / guest persistence).
 * - Dashboard Summary Aggregation Route (/api/dashboard-summary).
 * - Secure Persistent Authentication System (Signup, Login, Forgot Password).
 * - Static file serving with strict traversal protection & optimal caching headers.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

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

// ============================================================================
// Data Directory & Persistence Helpers
// ============================================================================
const DEFAULT_SEED_USERS = [
  {
    id: 'usr_1791098843088_mqvhcd',
    name: 'VICTOR OGHENEMARO',
    email: 'victorgreat219@gmail.com',
    passwordHash: '92ad73d50cc5af403427adcc375c126bc34f022f180291dd5846dcb60ecd8418',
    salt: '5ef6e2d31af22685940c3f044d19d2a1',
    securityQuestion: 'What is your favorite financial asset or ticker?',
    securityAnswerHash: '24d7f03d8dc3c3666969e6fa5bb1fac4736d3f1353c28307ed51b320f9dc42d3',
    createdAt: 1791098843088,
    lastLoginAt: 1791439743348
  },
  {
    id: 'usr_1791412830466_cyj476',
    name: 'Test Trader',
    email: 'testtrader99@example.com',
    passwordHash: 'c8d936f81f4df6536c73af8b4915617a70bc57e7afafa356904639d4a6ccade6',
    salt: '866115cfd2c089ba46374c4e6ebc109f',
    securityQuestion: 'What is your primary trading market or city?',
    securityAnswerHash: '6089854c94ca5454b76be6752c562901a985f64c9a946f62976aeab593b83161',
    createdAt: 1791412830466,
    lastLoginAt: 1791412830633
  },
  {
    id: 'usr_1791098620969_b9100j',
    name: 'Alex Morgan',
    email: 'trader_1791098620969@example.com',
    passwordHash: 'e2c3bcc4632c18d60bcaa86a65bcde0d12611f6df0fd86a432b0a1bba7daf04e',
    salt: 'd0d0113bc9e3cef8e05638a89bc29f99',
    securityQuestion: 'What is your primary trading market or city?',
    securityAnswerHash: '6089854c94ca5454b76be6752c562901a985f64c9a946f62976aeab593b83161',
    createdAt: 1791098620978,
    lastLoginAt: 1791098621014
  }
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_SEED_USERS, null, 2), 'utf-8');
  }
  if (!fs.existsSync(EVENTS_FILE)) {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(createDefaultPresetEvents(), null, 2), 'utf-8');
  }
}

function loadUsers() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const users = Array.isArray(parsed) ? parsed : [];
    
    // Ensure default seed users are included
    let updated = false;
    DEFAULT_SEED_USERS.forEach((seed) => {
      const exists = users.some((u) => u.email.toLowerCase() === seed.email.toLowerCase());
      if (!exists) {
        users.push(seed);
        updated = true;
      }
    });

    if (updated || users.length === 0) {
      const finalUsers = users.length > 0 ? users : DEFAULT_SEED_USERS;
      saveUsers(finalUsers);
      return finalUsers;
    }

    return users;
  } catch (e) {
    console.error('[Auth DB] Error loading users.json:', e.message);
    return DEFAULT_SEED_USERS;
  }
}

function saveUsers(users) {
  ensureDataDir();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Auth DB] Error saving users.json:', e.message);
    return false;
  }
}

function loadEvents() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(EVENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : createDefaultPresetEvents();
  } catch (e) {
    console.error('[Events DB] Error loading events.json:', e.message);
    return createDefaultPresetEvents();
  }
}

function saveEvents(events) {
  ensureDataDir();
  try {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Events DB] Error saving events.json:', e.message);
    return false;
  }
}

function createDefaultPresetEvents() {
  const now = Date.now();
  const ONE_HOUR = 3600 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  return [
    {
      id: 'preset-cpi',
      title: 'US CPI (Inflation Data) Release',
      targetDate: new Date(now + 3 * ONE_HOUR + 25 * 60 * 1000).toISOString(),
      impact: 'high',
      category: 'financial',
      notes: 'Key monthly inflation report impacting USD, Gold, and bond yields.',
      notified: false,
      createdAt: now
    },
    {
      id: 'preset-london-ny-prep',
      title: 'London / NY Overlap Session Opening',
      targetDate: new Date(now + 6 * ONE_HOUR).toISOString(),
      impact: 'high',
      category: 'financial',
      notes: 'Peak daily liquidity window (13:30 - 16:30 UTC). Major Forex & Indices volatility.',
      notified: false,
      createdAt: now
    },
    {
      id: 'preset-fomc',
      title: 'FOMC Interest Rate Decision & Statement',
      targetDate: new Date(now + 1 * ONE_DAY + 4 * ONE_HOUR).toISOString(),
      impact: 'high',
      category: 'financial',
      notes: 'Federal Reserve rate announcement followed by press conference.',
      notified: false,
      createdAt: now
    },
    {
      id: 'preset-academic-defense',
      title: 'Course Final Project & Architecture Defense',
      targetDate: new Date(now + 3 * ONE_DAY + 6 * ONE_HOUR).toISOString(),
      impact: 'high',
      category: 'academic',
      notes: 'Final system delivery, live demonstration, and documentation handoff.',
      notified: false,
      createdAt: now
    },
    {
      id: 'preset-ecb-meeting',
      title: 'ECB Monetary Policy Decision',
      targetDate: new Date(now + 5 * ONE_DAY + 2 * ONE_HOUR).toISOString(),
      impact: 'medium',
      category: 'financial',
      notes: 'European Central Bank interest rate guidance and press briefing.',
      notified: false,
      createdAt: now
    },
    {
      id: 'preset-nfp',
      title: 'US Non-Farm Payrolls (NFP) Report',
      targetDate: new Date(now + 7 * ONE_DAY).toISOString(),
      impact: 'high',
      category: 'financial',
      notes: 'High-volatility employment metrics released at 13:30 UTC.',
      notified: false,
      createdAt: now
    }
  ];
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + ':' + salt).digest('hex');
}

function hashSecurityAnswer(answer) {
  return crypto.createHash('sha256').update(answer.trim().toLowerCase()).digest('hex');
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2e6) { // 2MB limit
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    ...headers
  });
  res.end(JSON.stringify(data));
}

// ============================================================================
// 1. Server-Side Market Sessions & Overlap Engine
// ============================================================================
const SESSIONS_CONFIG = [
  {
    id: 'sydney',
    name: 'Sydney',
    market: 'ASX',
    flag: '🇦🇺',
    timeZone: 'Australia/Sydney',
    openUtc: '22:00',
    closeUtc: '07:00',
    openMinutes: 22 * 60, // 1320
    closeMinutes: 7 * 60, // 420
    durationMinutes: (24 * 60 - 22 * 60) + 7 * 60, // 540 min (9 hrs)
    crossesMidnight: true,
    color: '#06B6D4',
    currency: 'AUD / NZD'
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    market: 'TSE',
    flag: '🇯🇵',
    timeZone: 'Asia/Tokyo',
    openUtc: '00:00',
    closeUtc: '09:00',
    openMinutes: 0,
    closeMinutes: 9 * 60, // 540
    durationMinutes: 9 * 60, // 540 min (9 hrs)
    crossesMidnight: false,
    color: '#8B5CF6',
    currency: 'JPY / Asian FX'
  },
  {
    id: 'london',
    name: 'London',
    market: 'LSE',
    flag: '🇬🇧',
    timeZone: 'Europe/London',
    openUtc: '08:00',
    closeUtc: '16:30',
    openMinutes: 8 * 60, // 480
    closeMinutes: 16 * 60 + 30, // 990
    durationMinutes: 8.5 * 60, // 510 min (8.5 hrs)
    crossesMidnight: false,
    color: '#3B82F6',
    currency: 'GBP / EUR / CHF'
  },
  {
    id: 'new-york',
    name: 'New York',
    market: 'NYSE',
    flag: '🇺🇸',
    timeZone: 'America/New_York',
    openUtc: '13:30',
    closeUtc: '20:00',
    openMinutes: 13 * 60 + 30, // 810
    closeMinutes: 20 * 60, // 1200
    durationMinutes: 6.5 * 60, // 390 min (6.5 hrs)
    crossesMidnight: false,
    color: '#EC4899',
    currency: 'USD / CAD'
  }
];

function computeMarketSessions(now = new Date()) {
  const currentUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  const utcPercent = (currentUtcMinutes / 1440) * 100;

  // Active Overlaps
  const isLondonNyOverlap = currentUtcMinutes >= 810 && currentUtcMinutes < 990;
  const isTokyoSydneyOverlap = currentUtcMinutes >= 0 && currentUtcMinutes < 420;
  const isTokyoLondonOverlap = currentUtcMinutes >= 480 && currentUtcMinutes < 540;

  const overlaps = {
    londonNewYork: isLondonNyOverlap,
    tokyoSydney: isTokyoSydneyOverlap,
    tokyoLondon: isTokyoLondonOverlap,
    any: isLondonNyOverlap || isTokyoSydneyOverlap || isTokyoLondonOverlap
  };

  const sessions = SESSIONS_CONFIG.map((session) => {
    let isOpen = false;
    if (session.crossesMidnight) {
      isOpen = currentUtcMinutes >= session.openMinutes || currentUtcMinutes < session.closeMinutes;
    } else {
      isOpen = currentUtcMinutes >= session.openMinutes && currentUtcMinutes < session.closeMinutes;
    }

    let isOverlap = false;
    let overlapTitle = '';
    if (isOpen) {
      if ((session.id === 'london' || session.id === 'new-york') && overlaps.londonNewYork) {
        isOverlap = true;
        overlapTitle = 'London / NY Overlap';
      } else if ((session.id === 'sydney' || session.id === 'tokyo') && overlaps.tokyoSydney) {
        isOverlap = true;
        overlapTitle = 'Sydney / Tokyo Overlap';
      } else if ((session.id === 'tokyo' || session.id === 'london') && overlaps.tokyoLondon) {
        isOverlap = true;
        overlapTitle = 'Tokyo / London Overlap';
      }
    }

    const status = isOverlap ? 'OVERLAP' : (isOpen ? 'OPEN' : 'CLOSED');

    let progressPercent = 0;
    let countdownMinutes = 0;
    let countdownLabel = '';

    if (isOpen) {
      let elapsedMinutes = 0;
      if (session.crossesMidnight) {
        if (currentUtcMinutes >= session.openMinutes) {
          elapsedMinutes = currentUtcMinutes - session.openMinutes;
        } else {
          elapsedMinutes = (24 * 60 - session.openMinutes) + currentUtcMinutes;
        }
      } else {
        elapsedMinutes = currentUtcMinutes - session.openMinutes;
      }
      progressPercent = Math.min(100, Math.max(0, (elapsedMinutes / session.durationMinutes) * 100));
      countdownMinutes = Math.max(0, session.durationMinutes - elapsedMinutes);
      countdownLabel = 'Session Closes in:';
    } else {
      let waitMinutes = 0;
      if (session.crossesMidnight) {
        if (currentUtcMinutes < session.openMinutes) {
          waitMinutes = session.openMinutes - currentUtcMinutes;
        } else {
          waitMinutes = (24 * 60 - currentUtcMinutes) + session.openMinutes;
        }
      } else {
        if (currentUtcMinutes < session.openMinutes) {
          waitMinutes = session.openMinutes - currentUtcMinutes;
        } else {
          waitMinutes = (24 * 60 - currentUtcMinutes) + session.openMinutes;
        }
      }
      const cycleLength = 24 * 60 - session.durationMinutes;
      const elapsedWait = cycleLength - waitMinutes;
      progressPercent = Math.min(100, Math.max(0, (elapsedWait / cycleLength) * 100));
      countdownMinutes = waitMinutes;
      countdownLabel = 'Session Opens in:';
    }

    const hrs = Math.floor(countdownMinutes / 60);
    const mins = Math.floor(countdownMinutes % 60);
    const countdownStr = `${hrs}h ${String(mins).padStart(2, '0')}m`;

    return {
      ...session,
      isOpen,
      isOverlap,
      overlapTitle,
      status,
      progressPercent: parseFloat(progressPercent.toFixed(1)),
      countdownMinutes: Math.round(countdownMinutes),
      countdownLabel,
      countdownStr
    };
  });

  // Calculate next immediate market handover event
  let nextHandover = null;
  let minWait = Infinity;

  sessions.forEach((s) => {
    if (s.countdownMinutes < minWait && s.countdownMinutes > 0) {
      minWait = s.countdownMinutes;
      nextHandover = {
        sessionId: s.id,
        sessionName: s.name,
        action: s.isOpen ? 'Closes' : 'Opens',
        minutesAway: s.countdownMinutes,
        countdownStr: s.countdownStr
      };
    }
  });

  return {
    serverTimeUtc: now.toISOString(),
    serverEpoch: now.getTime(),
    currentUtcMinutes: parseFloat(currentUtcMinutes.toFixed(2)),
    utcPercent: parseFloat(utcPercent.toFixed(2)),
    overlaps,
    sessions,
    nextHandover,
    activeSessionsCount: sessions.filter((s) => s.isOpen).length
  };
}

// ============================================================================
// 2. Server-Side Economic Calendar Ingestion & Query Normalization
// ============================================================================
let calendarStore = {
  timestamp: 0,
  raw: null,
  normalized: []
};

function normalizeCalendarFeed(rawEvents) {
  if (!Array.isArray(rawEvents)) return [];

  return rawEvents.map((item, idx) => {
    const dateIso = item.time_utc || (item.date ? `${item.date}T12:00:00Z` : new Date().toISOString());
    let impact = (item.impact || 'medium').toLowerCase();
    if (!['high', 'medium', 'low'].includes(impact)) impact = 'medium';

    const name = item.name || item.title || 'Economic Release';
    const title = item.title || item.name || '';
    const textToScan = `${name} ${title}`.toLowerCase();

    let currency = 'USD';
    let flag = '🇺🇸';

    if (textToScan.includes('canada') || textToScan.includes('tsx') || textToScan.includes('boc')) {
      currency = 'CAD'; flag = '🇨🇦';
    } else if (textToScan.includes('china') || textToScan.includes('pboc')) {
      currency = 'CNY'; flag = '🇨🇳';
    } else if (textToScan.includes('australia') || textToScan.includes('rba') || textToScan.includes('asx')) {
      currency = 'AUD'; flag = '🇦🇺';
    } else if (textToScan.includes('uk') || textToScan.includes('boe') || textToScan.includes('gdp uk')) {
      currency = 'GBP'; flag = '🇬🇧';
    } else if (textToScan.includes('japan') || textToScan.includes('boj') || textToScan.includes('tse')) {
      currency = 'JPY'; flag = '🇯🇵';
    } else if (textToScan.includes('ecb') || textToScan.includes('eurozone') || textToScan.includes('germany')) {
      currency = 'EUR'; flag = '🇪🇺';
    }

    const epoch = new Date(dateIso).getTime();

    return {
      id: `cal_${item.date || 'd'}_${idx}`,
      title: name,
      fullTitle: title,
      targetDate: dateIso,
      targetEpoch: isNaN(epoch) ? Date.now() : epoch,
      currency,
      flag,
      impact,
      prior: item.prior || null,
      consensus: item.consensus || null,
      actual: item.actual || null,
      url: item.url || null
    };
  });
}

async function refreshCalendarCache() {
  const now = Date.now();
  // 5 minute TTL (300,000 ms)
  if (calendarStore.normalized.length > 0 && (now - calendarStore.timestamp < 300000)) {
    return calendarStore.normalized;
  }

  try {
    const response = await fetch('https://www.financecalendar.com/wp-json/fc/v1/calendar', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chronex-Backend/2.4.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (response.ok) {
      const data = await response.json();
      const rawEvents = data.events || (Array.isArray(data) ? data : []);
      if (rawEvents.length > 0) {
        calendarStore.raw = data;
        calendarStore.normalized = normalizeCalendarFeed(rawEvents);
        calendarStore.timestamp = now;
        console.log(`[Calendar Engine] Synced & normalized ${calendarStore.normalized.length} events from upstream.`);
        return calendarStore.normalized;
      }
    }
  } catch (err) {
    console.warn('[Calendar Engine] Upstream fetch warning:', err.message);
  }

  // If upstream failed but we have cached events, continue with cached
  if (calendarStore.normalized.length > 0) {
    return calendarStore.normalized;
  }

  // Fallback: Generate curated high-impact weekly macroeconomic events
  const fallbackList = [
    { name: 'US Consumer Price Index (CPI YoY)', title: 'US CPI Headline Inflation Rate', time_utc: new Date(now + 3.5 * 3600000).toISOString(), impact: 'high', currency: 'USD', prior: '2.5%', consensus: '2.4%' },
    { name: 'FOMC Interest Rate Decision', title: 'Federal Reserve Monetary Policy Rate', time_utc: new Date(now + 24 * 3600000).toISOString(), impact: 'high', currency: 'USD', prior: '5.25%', consensus: '5.00%' },
    { name: 'US Non-Farm Payrolls (NFP)', title: 'US Bureau of Labor Statistics Jobs Data', time_utc: new Date(now + 72 * 3600000).toISOString(), impact: 'high', currency: 'USD', prior: '142K', consensus: '150K' },
    { name: 'ECB Main Refinancing Rate', title: 'European Central Bank Rate Decision', time_utc: new Date(now + 48 * 3600000).toISOString(), impact: 'high', currency: 'EUR', prior: '3.65%', consensus: '3.40%' },
    { name: 'UK Gross Domestic Product (QoQ)', title: 'Office for National Statistics GDP', time_utc: new Date(now + 18 * 3600000).toISOString(), impact: 'high', currency: 'GBP', prior: '0.6%', consensus: '0.5%' },
    { name: 'Bank of Japan Monetary Policy', title: 'BOJ Rate Announcement & Outlook', time_utc: new Date(now + 36 * 3600000).toISOString(), impact: 'high', currency: 'JPY', prior: '0.25%', consensus: '0.25%' },
    { name: 'Canada Employment Change', title: 'Statistics Canada Labour Force Survey', time_utc: new Date(now + 60 * 3600000).toISOString(), impact: 'medium', currency: 'CAD', prior: '-40K', consensus: '+25K' },
    { name: 'Australia CPI (QoQ)', title: 'Australian Bureau of Statistics CPI', time_utc: new Date(now + 84 * 3600000).toISOString(), impact: 'high', currency: 'AUD', prior: '1.0%', consensus: '0.8%' }
  ];

  calendarStore.normalized = normalizeCalendarFeed(fallbackList);
  calendarStore.timestamp = now;
  return calendarStore.normalized;
}

// Background pre-fetch at startup
refreshCalendarCache().catch(() => {});

// ============================================================================
// Main HTTP Request Handler
// ============================================================================
const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let safePath = parsedUrl.pathname;
  if (safePath.length > 1 && safePath.endsWith('/')) {
    safePath = safePath.slice(0, -1);
  }

  // ==========================================================================
  // API Route: Market Sessions & Overlaps Engine
  // ==========================================================================
  if (safePath === '/api/market-sessions' && req.method === 'GET') {
    const marketState = computeMarketSessions(new Date());
    sendJson(res, 200, {
      success: true,
      ...marketState
    });
    return;
  }

  // ==========================================================================
  // API Route: Unified Dashboard Summary (Single Request Engine)
  // ==========================================================================
  if (safePath === '/api/dashboard-summary' && req.method === 'GET') {
    const now = new Date();
    const marketState = computeMarketSessions(now);
    const events = loadEvents();
    const calendarEvents = await refreshCalendarCache();

    // Next nearest upcoming economic event
    const nowEpoch = now.getTime();
    const upcomingCal = calendarEvents
      .filter((e) => e.targetEpoch > nowEpoch && e.impact === 'high')
      .sort((a, b) => a.targetEpoch - b.targetEpoch)[0] || null;

    sendJson(res, 200, {
      success: true,
      serverTimeUtc: marketState.serverTimeUtc,
      serverEpoch: marketState.serverEpoch,
      activeSessionsCount: marketState.activeSessionsCount,
      activeOverlaps: marketState.overlaps,
      nextHandover: marketState.nextHandover,
      nextHighImpactRelease: upcomingCal ? {
        id: upcomingCal.id,
        title: upcomingCal.title,
        currency: upcomingCal.currency,
        flag: upcomingCal.flag,
        targetDate: upcomingCal.targetDate,
        minutesAway: Math.round((upcomingCal.targetEpoch - nowEpoch) / 60000)
      } : null,
      totalEventsTracked: events.length
    });
    return;
  }

  // ==========================================================================
  // API Route: Live Economic Calendar (Query Filtered on Backend)
  // ==========================================================================
  if (safePath === '/api/calendar' && req.method === 'GET') {
    const allNormalized = await refreshCalendarCache();

    const currencyFilter = parsedUrl.searchParams.get('currency')?.toUpperCase() || 'ALL';
    const impactFilter = parsedUrl.searchParams.get('impact')?.toLowerCase() || 'ALL';
    const searchQuery = parsedUrl.searchParams.get('search')?.toLowerCase().trim() || '';
    const limit = parseInt(parsedUrl.searchParams.get('limit') || '150', 10);

    let filtered = allNormalized.filter((ev) => {
      if (currencyFilter !== 'ALL' && ev.currency !== currencyFilter) {
        return false;
      }
      if (impactFilter !== 'ALL' && ev.impact !== impactFilter) {
        return false;
      }
      if (searchQuery) {
        const text = `${ev.title} ${ev.fullTitle} ${ev.currency}`.toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }
      return true;
    });

    if (limit > 0 && filtered.length > limit) {
      filtered = filtered.slice(0, limit);
    }

    sendJson(res, 200, {
      success: true,
      count: filtered.length,
      totalAvailable: allNormalized.length,
      cachedAgeSeconds: Math.round((Date.now() - calendarStore.timestamp) / 1000),
      events: filtered
    }, {
      'X-Cache-Count': String(filtered.length)
    });
    return;
  }

  // ==========================================================================
  // API Routes: Cloud Events Persistence & Sync Engine
  // ==========================================================================
  if (safePath.startsWith('/api/events')) {
    // 1. Get All Events
    if (safePath === '/api/events' && req.method === 'GET') {
      const events = loadEvents();
      sendJson(res, 200, { success: true, events });
      return;
    }

    // 2. Add New Event
    if (safePath === '/api/events' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const { title, targetDate, impact, category, notes } = body;

        if (!title || !targetDate) {
          sendJson(res, 400, { error: 'Event title and targetDate are required.' });
          return;
        }

        const events = loadEvents();
        const newEvent = {
          id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          title: title.trim(),
          targetDate: new Date(targetDate).toISOString(),
          impact: ['high', 'medium', 'low'].includes(impact) ? impact : 'medium',
          category: ['financial', 'academic', 'personal'].includes(category) ? category : 'financial',
          notes: notes ? notes.trim() : '',
          notified: false,
          createdAt: Date.now()
        };

        events.unshift(newEvent);
        saveEvents(events);

        console.log(`[Events Engine] New event created: ${newEvent.title}`);
        sendJson(res, 201, { success: true, event: newEvent });
        return;
      } catch (err) {
        sendJson(res, 500, { error: err.message || 'Failed to save event.' });
        return;
      }
    }

    // 3. Batch Sync Events (Merges client local storage with server cloud store)
    if (safePath === '/api/events/sync' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const clientEvents = Array.isArray(body.events) ? body.events : [];
        const serverEvents = loadEvents();

        const serverIdMap = new Map();
        serverEvents.forEach((ev) => serverIdMap.set(ev.id, ev));

        // Merge client events into server store
        clientEvents.forEach((clientEv) => {
          if (!clientEv.id || !clientEv.title || !clientEv.targetDate) return;
          if (!serverIdMap.has(clientEv.id)) {
            serverIdMap.set(clientEv.id, {
              ...clientEv,
              createdAt: clientEv.createdAt || Date.now()
            });
          }
        });

        const merged = Array.from(serverIdMap.values());
        saveEvents(merged);

        console.log(`[Events Engine] Synced events database. Total: ${merged.length}`);
        sendJson(res, 200, { success: true, count: merged.length, events: merged });
        return;
      } catch (err) {
        sendJson(res, 500, { error: err.message || 'Sync failed.' });
        return;
      }
    }

    // 4. Reset to Default Presets
    if (safePath === '/api/events/reset' && req.method === 'POST') {
      const presets = createDefaultPresetEvents();
      saveEvents(presets);
      sendJson(res, 200, { success: true, events: presets });
      return;
    }

    // 5. Update or Delete specific event (/api/events/:id)
    const eventIdMatch = safePath.match(/^\/api\/events\/([a-zA-Z0-9_-]+)$/);
    if (eventIdMatch) {
      const eventId = eventIdMatch[1];
      const events = loadEvents();
      const eventIndex = events.findIndex((e) => e.id === eventId);

      if (req.method === 'DELETE') {
        if (eventIndex === -1) {
          sendJson(res, 404, { error: 'Event not found' });
          return;
        }
        const removed = events.splice(eventIndex, 1)[0];
        saveEvents(events);
        console.log(`[Events Engine] Deleted event: ${removed.title}`);
        sendJson(res, 200, { success: true, id: eventId });
        return;
      }

      if (req.method === 'PUT') {
        if (eventIndex === -1) {
          sendJson(res, 404, { error: 'Event not found' });
          return;
        }
        try {
          const body = await parseJsonBody(req);
          const current = events[eventIndex];
          const updated = {
            ...current,
            title: body.title !== undefined ? body.title.trim() : current.title,
            targetDate: body.targetDate ? new Date(body.targetDate).toISOString() : current.targetDate,
            impact: body.impact || current.impact,
            category: body.category || current.category,
            notes: body.notes !== undefined ? body.notes.trim() : current.notes,
            notified: body.notified !== undefined ? Boolean(body.notified) : current.notified,
            updatedAt: Date.now()
          };
          events[eventIndex] = updated;
          saveEvents(events);
          sendJson(res, 200, { success: true, event: updated });
          return;
        } catch (err) {
          sendJson(res, 500, { error: err.message || 'Failed to update event.' });
          return;
        }
      }
    }

    sendJson(res, 404, { error: 'Events API endpoint not found' });
    return;
  }

  // ==========================================================================
  // API Routes: User Authentication System
  // ==========================================================================
  if (safePath.startsWith('/api/auth/')) {
    // 1. Signup
    if (safePath === '/api/auth/signup' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const { name, email, password, securityQuestion, securityAnswer } = body;

        if (!name || !email || !password) {
          sendJson(res, 400, { error: 'Name, email, and password are required.' });
          return;
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          sendJson(res, 400, { error: 'Please provide a valid email address.' });
          return;
        }

        if (password.length < 6) {
          sendJson(res, 400, { error: 'Password must be at least 6 characters.' });
          return;
        }

        const users = loadUsers();
        const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
        if (existing) {
          sendJson(res, 409, { error: 'An account with this email already exists. Please log in.' });
          return;
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const questionText = securityQuestion || 'What is your primary trading market or city?';
        const answerHash = securityAnswer ? hashSecurityAnswer(securityAnswer) : '';

        const newUser = {
          id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          salt,
          securityQuestion: questionText,
          securityAnswerHash: answerHash,
          createdAt: Date.now(),
          lastLoginAt: Date.now()
        };

        users.push(newUser);
        saveUsers(users);

        const token = 'tok_' + crypto.randomBytes(24).toString('hex');
        console.log(`[Auth API] New user registered: ${newUser.name} (${newUser.email})`);

        sendJson(res, 201, {
          success: true,
          message: 'Account created successfully!',
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            securityQuestion: newUser.securityQuestion,
            createdAt: newUser.createdAt,
            lastLoginAt: newUser.lastLoginAt
          },
          token
        });
        return;
      } catch (err) {
        sendJson(res, 500, { error: err.message || 'Failed to process signup.' });
        return;
      }
    }

    // 2. Login
    if (safePath === '/api/auth/login' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const { email, password } = body;

        if (!email || !password) {
          sendJson(res, 400, { error: 'Email and password are required.' });
          return;
        }

        const normalizedEmail = email.trim().toLowerCase();
        const users = loadUsers();
        const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

        if (!user) {
          sendJson(res, 404, { error: 'No account found with this email. Please check your spelling or sign up.' });
          return;
        }

        const calculatedHash = hashPassword(password, user.salt);
        if (calculatedHash !== user.passwordHash) {
          sendJson(res, 401, { error: 'Incorrect password. Please try again or use Forgot Password.' });
          return;
        }

        user.lastLoginAt = Date.now();
        saveUsers(users);

        const token = 'tok_' + crypto.randomBytes(24).toString('hex');
        console.log(`[Auth API] User logged in: ${user.name} (${user.email})`);

        sendJson(res, 200, {
          success: true,
          message: `Welcome back, ${user.name}!`,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            securityQuestion: user.securityQuestion || 'What is your primary trading market or city?',
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
          },
          token
        });
        return;
      } catch (err) {
        sendJson(res, 500, { error: err.message || 'Failed to process login.' });
        return;
      }
    }

    // 3. Forgot Password Check
    if (safePath === '/api/auth/forgot-password/check' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const { email } = body;

        if (!email) {
          sendJson(res, 400, { error: 'Please enter your account email.' });
          return;
        }

        const normalizedEmail = email.trim().toLowerCase();
        const users = loadUsers();
        const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

        if (!user) {
          sendJson(res, 404, { error: 'No account registered with this email address.' });
          return;
        }

        sendJson(res, 200, {
          success: true,
          securityQuestion: user.securityQuestion || 'What is your primary trading market or city?'
        });
        return;
      } catch (err) {
        sendJson(res, 500, { error: err.message || 'Failed to verify account.' });
        return;
      }
    }

    // 4. Forgot Password Reset
    if (safePath === '/api/auth/forgot-password/reset' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const { email, securityAnswer, newPassword } = body;

        if (!email || !securityAnswer || !newPassword) {
          sendJson(res, 400, { error: 'All fields are required to reset your password.' });
          return;
        }

        if (newPassword.length < 6) {
          sendJson(res, 400, { error: 'New password must be at least 6 characters.' });
          return;
        }

        const normalizedEmail = email.trim().toLowerCase();
        const users = loadUsers();
        const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

        if (!user) {
          sendJson(res, 404, { error: 'No account registered with this email address.' });
          return;
        }

        const providedAnswerHash = hashSecurityAnswer(securityAnswer);
        if (user.securityAnswerHash && providedAnswerHash !== user.securityAnswerHash) {
          sendJson(res, 401, { error: 'Security answer does not match our records. Please try again.' });
          return;
        }

        const newSalt = crypto.randomBytes(16).toString('hex');
        user.salt = newSalt;
        user.passwordHash = hashPassword(newPassword, newSalt);
        saveUsers(users);

        console.log(`[Auth API] Password reset successfully for: ${user.email}`);
        sendJson(res, 200, {
          success: true,
          message: 'Password reset successful! You can now log in with your new password.'
        });
        return;
      } catch (err) {
        sendJson(res, 500, { error: err.message || 'Failed to reset password.' });
        return;
      }
    }

    // 5. Total registered accounts count
    if (safePath === '/api/auth/users-count' && req.method === 'GET') {
      const users = loadUsers();
      sendJson(res, 200, { count: users.length });
      return;
    }

    // 6. Auth Service Health & Status Check
    if (safePath === '/api/auth/status' && req.method === 'GET') {
      const users = loadUsers();
      sendJson(res, 200, {
        success: true,
        status: 'online',
        usersCount: users.length,
        serverTime: Date.now()
      });
      return;
    }

    // 7. Bi-directional Vault Sync (Merges client offline accounts into permanent server database)
    if (safePath === '/api/auth/sync-vault' && req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const clientUsers = Array.isArray(body.users) ? body.users : [];
        const serverUsers = loadUsers();
        let addedCount = 0;

        clientUsers.forEach((clientUser) => {
          if (!clientUser.email) return;
          const normalizedEmail = clientUser.email.trim().toLowerCase();
          const exists = serverUsers.some((u) => u.email.toLowerCase() === normalizedEmail);
          if (!exists) {
            serverUsers.push({
              id: clientUser.id || ('usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)),
              name: (clientUser.name || 'Trader').trim(),
              email: normalizedEmail,
              passwordHash: clientUser.passwordHash || '',
              salt: clientUser.salt || '',
              securityQuestion: clientUser.securityQuestion || 'What is your primary trading market or city?',
              securityAnswerHash: clientUser.securityAnswerHash || '',
              createdAt: clientUser.createdAt || Date.now(),
              lastLoginAt: clientUser.lastLoginAt || Date.now()
            });
            addedCount++;
          }
        });

        if (addedCount > 0) {
          saveUsers(serverUsers);
          console.log(`[Auth API] Synced ${addedCount} offline account(s) into permanent server database.`);
        }

        sendJson(res, 200, {
          success: true,
          addedCount,
          totalUsers: serverUsers.length
        });
        return;
      } catch (err) {
        sendJson(res, 500, { error: err.message || 'Failed to sync users vault.' });
        return;
      }
    }

    sendJson(res, 404, { error: `Auth API route not found: ${req.method} ${safePath}` });
    return;
  }

  // Catch-all for any unmatched /api/ request (ensures pure JSON is always returned, never HTML/text)
  if (safePath.startsWith('/api/')) {
    sendJson(res, 404, { error: `API endpoint not found: ${req.method} ${safePath}` });
    return;
  }

  // ==========================================================================
  // Static Files Handler with Directory Traversal Protection
  // ==========================================================================
  let staticPath = safePath;
  if (staticPath === '/') staticPath = '/index.html';

  const fullPath = path.join(__dirname, staticPath);

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

    // Development & hot preview headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('\n===============================================================');
  console.log('   CHRONEX — Distributed Financial Terminal & Workload Server   ');
  console.log('===============================================================');
  console.log(`\n  🟢 Local Server Running at: http://localhost:${PORT}`);
  console.log(`  🌐 Market Sessions Engine:  http://localhost:${PORT}/api/market-sessions`);
  console.log(`  📊 Economic Calendar API:   http://localhost:${PORT}/api/calendar`);
  console.log(`  ⚡ Dashboard Summary:       http://localhost:${PORT}/api/dashboard-summary`);
  console.log(`  💾 Cloud Events Store:      http://localhost:${PORT}/api/events`);
  console.log(`  🔐 User Auth & Database:    http://localhost:${PORT}/api/auth/`);
  console.log(`  📱 Mobile Terminal Ready:   Yes`);
  console.log(`  ⏹  Press Ctrl+C to stop the server\n`);
});

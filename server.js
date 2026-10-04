/**
 * Chronex Local Development & Production Server
 * Pure Node.js HTTP static server, Live Economic Calendar API proxy,
 * and Persistent Authentication System (Signup, Login, Logout, Forgot Password).
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

// ============================================================================
// User Persistence & Security Helpers
// ============================================================================
function ensureUsersFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]', 'utf-8');
  }
}

function loadUsers() {
  ensureUsersFile();
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('[Auth DB] Error loading users.json:', e);
    return [];
  }
}

function saveUsers(users) {
  ensureUsersFile();
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Auth DB] Error saving users.json:', e);
    return false;
  }
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
      if (body.length > 1e6) { // 1MB limit
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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(data));
}

// ============================================================================
// Main HTTP Server
// ============================================================================
const server = http.createServer(async (req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse path
  let safePath = req.url.split('?')[0];

  // ==========================================================================
  // Auth API Routes
  // ==========================================================================
  if (safePath.startsWith('/api/auth/')) {
    // 1. Signup Route
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
            email: newUser.email
          },
          token
        });
        return;
      } catch (err) {
        console.error('[Auth API] Signup error:', err.message);
        sendJson(res, 500, { error: err.message || 'Failed to process signup.' });
        return;
      }
    }

    // 2. Login Route
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
            email: user.email
          },
          token
        });
        return;
      } catch (err) {
        console.error('[Auth API] Login error:', err.message);
        sendJson(res, 500, { error: err.message || 'Failed to process login.' });
        return;
      }
    }

    // 3. Forgot Password Check Route (retrieves security question for email)
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

    // 4. Forgot Password Reset Route
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

        // Verify answer
        const providedAnswerHash = hashSecurityAnswer(securityAnswer);
        if (user.securityAnswerHash && providedAnswerHash !== user.securityAnswerHash) {
          sendJson(res, 401, { error: 'Security answer does not match our records. Please try again.' });
          return;
        }

        // Update password with new salt
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

    sendJson(res, 404, { error: 'Auth API endpoint not found' });
    return;
  }

  // ==========================================================================
  // Live Economic Calendar API Route
  // ==========================================================================
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

  // ==========================================================================
  // Static Files Handler
  // ==========================================================================
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

    // Disable caching for development & preview server so changes apply immediately
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
  console.log(`  🔐 User Auth & Database: http://localhost:${PORT}/api/auth/`);
  console.log(`  📱 PWA Manifest & Service Worker: Active`);
  console.log(`  ⏹  Press Ctrl+C to stop the server\n`);
});

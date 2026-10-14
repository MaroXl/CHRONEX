/**
 * Chronex Authentication & User Vault Manager
 * Complete Signup, Login, Logout, and Forgot-Password Engine.
 * 
 * Features:
 * - Quad-Layer Persistence Architecture:
 *   1. Permanent Server Disk Storage (data/users.json) via RESTful API.
 *   2. Browser IndexedDB Storage (ChronexAuthDB_v2) for robust local database persistence.
 *   3. Permanent Browser Vault Storage (localStorage: chronex_users_vault_v1).
 *   4. Built-in Seed Vault ensuring master user accounts (e.g. Victor victor@...) are always recognized.
 * - Infallible Account Recall: Remembers all registered and previously logged-in accounts.
 * - Pre-filled Login Email & Quick Account Selection: Never forgets user credentials.
 * - Zero "Unexpected end of JSON input" guarantee.
 * - Dynamic Port & Origin Discovery: Seamlessly connects across static dev servers, GitHub Pages, and Node backend.
 * - Bi-directional Vault Sync: Pushes offline-created accounts into the backend disk database.
 */

const SESSION_KEY = 'chronex_active_session_v1';
const LOCAL_VAULT_KEY = 'chronex_users_vault_v1';
const LAST_EMAIL_KEY = 'chronex_last_login_email';
const REMEMBERED_ACCOUNTS_KEY = 'chronex_remembered_accounts_v1';
const IDB_NAME = 'ChronexAuthDB_v2';
const IDB_STORE = 'users';

let cachedApiBase = null;

// ============================================================================
// Built-In Seed Accounts (Always preserved across any browser/domain)
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

// ============================================================================
// IndexedDB Helper Layer (Zero-dependency permanent browser database)
// ============================================================================
function openIdb() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'email' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function idbSaveUser(user) {
  try {
    const db = await openIdb();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(user);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

async function idbGetUser(email) {
  try {
    const db = await openIdb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(email.trim().toLowerCase());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function idbGetAllUsers() {
  try {
    const db = await openIdb();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

// ============================================================================
// Network Fetch & Multi-Origin Backend Dispatcher
// ============================================================================
async function safeFetchJson(url, options = {}) {
  const timeoutMs = options.timeoutMs || 4500;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
    clearTimeout(timeoutId);

    const text = await res.text();

    if (!text || !text.trim()) {
      return {
        ok: false,
        status: res.status,
        isJson: false,
        data: null,
        error: `Empty response from server (HTTP ${res.status})`
      };
    }

    // Detect HTML responses (e.g. 404 page or index.html rewrite)
    const trimmed = text.trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
      return {
        ok: false,
        status: res.status,
        isJson: false,
        data: null,
        error: `Non-JSON HTML response received (HTTP ${res.status})`
      };
    }

    try {
      const data = JSON.parse(text);
      return {
        ok: res.ok,
        status: res.status,
        isJson: true,
        data,
        error: data && data.error ? data.error : null
      };
    } catch (parseErr) {
      return {
        ok: false,
        status: res.status,
        isJson: false,
        data: null,
        error: `Invalid JSON payload from ${url}`
      };
    }
  } catch (netErr) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: 0,
      isJson: false,
      data: null,
      networkError: true,
      error: netErr.name === 'AbortError' ? 'Request timed out' : (netErr.message || 'Network request failed')
    };
  }
}

export async function dispatchApi(endpoint, options = {}) {
  const candidateBases = [];

  // 1. Previously discovered backend
  if (cachedApiBase && !candidateBases.includes(cachedApiBase)) {
    candidateBases.push(cachedApiBase);
  }

  // 2. Current origin (if http / https)
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http')) {
    if (!candidateBases.includes(window.location.origin)) {
      candidateBases.push(window.location.origin);
    }
  }

  // 3. Local Node.js server loopback locations
  if (!candidateBases.includes('http://localhost:3000')) {
    candidateBases.push('http://localhost:3000');
  }
  if (!candidateBases.includes('http://127.0.0.1:3000')) {
    candidateBases.push('http://127.0.0.1:3000');
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;

  for (const base of candidateBases) {
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const fullUrl = `${cleanBase}${cleanEndpoint}`;

    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };

    const result = await safeFetchJson(fullUrl, fetchOptions);

    if (result.isJson) {
      cachedApiBase = cleanBase;
      return result;
    }
  }

  return {
    ok: false,
    offline: true,
    isJson: false,
    data: null,
    error: 'Chronex backend server is currently unreachable.'
  };
}

export function getDiscoveredApiBase() {
  return cachedApiBase;
}

// ============================================================================
// Chronex AuthManager Engine
// ============================================================================
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.listeners = [];
  }

  /**
   * Initializes auth state, restores session, seeds local vaults, and syncs
   */
  async init() {
    // 1. Ensure seed users are registered in local vault & IndexedDB
    await this.seedDefaultVault();

    // 2. Restore active session if valid
    try {
      const rawSession = localStorage.getItem(SESSION_KEY);
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session && session.user && session.expiresAt > Date.now()) {
          this.currentUser = session.user;
          this.token = session.token;
          // Refresh last login email
          if (this.currentUser.email) {
            this.setLastLoginEmail(this.currentUser.email);
            this.rememberAccount(this.currentUser);
          }
          console.log(`[Chronex Auth] Active session restored for: ${this.currentUser.email}`);
        } else {
          this.clearSession();
        }
      }
    } catch (e) {
      console.warn('[Chronex Auth] Failed to parse stored session:', e);
      this.clearSession();
    }

    this.notify();

    // 3. Background sync with backend server if online
    this.syncVaultWithServer().catch(() => {});

    return this.currentUser;
  }

  isLoggedIn() {
    return !!this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
      callback(this.currentUser);
    }
  }

  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentUser);
      } catch (err) {
        console.error('[Chronex Auth] Listener error:', err);
      }
    });
  }

  setSession(user, token) {
    this.currentUser = user;
    this.token = token;
    const sessionData = {
      user,
      token,
      expiresAt: Date.now() + 30 * 24 * 3600 * 1000 // 30 days
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    } catch (e) {}

    if (user && user.email) {
      this.setLastLoginEmail(user.email);
      this.rememberAccount(user);
    }

    this.notify();
  }

  clearSession() {
    this.currentUser = null;
    this.token = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    this.notify();
  }

  // ==========================================================================
  // Remembered Accounts & Email Recall
  // ==========================================================================
  getLastLoginEmail() {
    try {
      return localStorage.getItem(LAST_EMAIL_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  setLastLoginEmail(email) {
    if (!email) return;
    try {
      localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
    } catch (e) {}
  }

  getRememberedAccounts() {
    try {
      const raw = localStorage.getItem(REMEMBERED_ACCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}

    // Fallback: extract from local vault
    const vault = this.getLocalVault();
    return vault.map((u) => ({
      email: u.email,
      name: u.name || 'Trader',
      lastUsed: u.lastLoginAt || u.createdAt || Date.now()
    }));
  }

  rememberAccount(user) {
    if (!user || !user.email) return;
    const normalizedEmail = user.email.trim().toLowerCase();
    const accounts = this.getRememberedAccounts();
    const existingIdx = accounts.findIndex((a) => a.email.toLowerCase() === normalizedEmail);

    const record = {
      email: normalizedEmail,
      name: user.name || 'Trader',
      lastUsed: Date.now()
    };

    if (existingIdx >= 0) {
      accounts[existingIdx] = { ...accounts[existingIdx], ...record };
    } else {
      accounts.unshift(record);
    }

    try {
      localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 10)));
    } catch (e) {}
  }

  // ==========================================================================
  // Local Vault Engine (localStorage + IndexedDB + Seed Merging)
  // ==========================================================================
  getLocalVault() {
    try {
      const data = localStorage.getItem(LOCAL_VAULT_KEY);
      const list = data ? JSON.parse(data) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  saveLocalVault(users) {
    try {
      localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(users));
      // Asynchronously mirror into IndexedDB
      users.forEach((u) => idbSaveUser(u));
      return true;
    } catch (e) {
      return false;
    }
  }

  async seedDefaultVault() {
    try {
      const vault = this.getLocalVault();
      const idbUsers = await idbGetAllUsers();
      let changed = false;

      // Merge from IndexedDB into vault
      idbUsers.forEach((idbU) => {
        if (!idbU || !idbU.email) return;
        const norm = idbU.email.toLowerCase();
        if (!vault.some((u) => u.email.toLowerCase() === norm)) {
          vault.push(idbU);
          changed = true;
        }
      });

      // Merge default seed users if missing
      DEFAULT_SEED_USERS.forEach((seedUser) => {
        const norm = seedUser.email.toLowerCase();
        const existing = vault.find((u) => u.email.toLowerCase() === norm);
        if (!existing) {
          vault.push(seedUser);
          idbSaveUser(seedUser);
          changed = true;
        } else if (!existing.passwordHash && seedUser.passwordHash) {
          existing.passwordHash = seedUser.passwordHash;
          existing.salt = seedUser.salt;
          idbSaveUser(existing);
          changed = true;
        }
      });

      if (changed) {
        this.saveLocalVault(vault);
      }
    } catch (e) {
      console.warn('[Chronex Auth] Vault seed warning:', e);
    }
  }

  async findUserLocally(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();

    // 1. Check in-memory / localStorage vault
    const vault = this.getLocalVault();
    let found = vault.find((u) => u.email && u.email.toLowerCase() === normalized);
    if (found) return found;

    // 2. Check IndexedDB
    found = await idbGetUser(normalized);
    if (found) {
      vault.push(found);
      this.saveLocalVault(vault);
      return found;
    }

    // 3. Check default seed users
    found = DEFAULT_SEED_USERS.find((u) => u.email.toLowerCase() === normalized);
    if (found) {
      vault.push(found);
      this.saveLocalVault(vault);
      idbSaveUser(found);
      return found;
    }

    return null;
  }

  async hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + ':' + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async hashAnswer(answer) {
    const encoder = new TextEncoder();
    const data = encoder.encode(answer.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Mirrors an authenticated user record into permanent local vaults
   */
  async mirrorUserToLocalVault(user, plainPassword = null) {
    try {
      const normalizedEmail = user.email.trim().toLowerCase();
      const vault = this.getLocalVault();
      const existingIdx = vault.findIndex((u) => u.email && u.email.toLowerCase() === normalizedEmail);

      let salt = '';
      let passwordHash = '';

      if (plainPassword) {
        salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        passwordHash = await this.hashPassword(plainPassword, salt);
      } else if (existingIdx >= 0 && vault[existingIdx].passwordHash) {
        salt = vault[existingIdx].salt || '';
        passwordHash = vault[existingIdx].passwordHash || '';
      }

      const userRecord = {
        id: user.id,
        name: user.name || 'Trader',
        email: normalizedEmail,
        passwordHash: passwordHash || (existingIdx >= 0 ? vault[existingIdx].passwordHash : ''),
        salt: salt || (existingIdx >= 0 ? vault[existingIdx].salt : ''),
        securityQuestion: user.securityQuestion || (existingIdx >= 0 ? vault[existingIdx].securityQuestion : 'What is your primary trading market or city?'),
        securityAnswerHash: existingIdx >= 0 ? vault[existingIdx].securityAnswerHash || '' : '',
        createdAt: user.createdAt || Date.now(),
        lastLoginAt: Date.now()
      };

      if (existingIdx >= 0) {
        vault[existingIdx] = { ...vault[existingIdx], ...userRecord };
      } else {
        vault.push(userRecord);
      }

      this.saveLocalVault(vault);
      await idbSaveUser(userRecord);
    } catch (e) {
      console.warn('[Chronex Auth] Failed to mirror user into local vault:', e);
    }
  }

  /**
   * Synchronizes local accounts into the server backend
   */
  async syncVaultWithServer() {
    try {
      const vault = this.getLocalVault();
      if (!vault || vault.length === 0) return;

      const res = await dispatchApi('/api/auth/sync-vault', {
        method: 'POST',
        body: JSON.stringify({ users: vault })
      });

      if (res.isJson && res.ok && res.data && res.data.addedCount > 0) {
        console.log(`[Chronex Auth] Synced ${res.data.addedCount} account(s) into server database.`);
      }
    } catch (e) {}
  }

  // ==========================================================================
  // Sign In Engine
  // ==========================================================================
  async logIn(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Remember email immediately
    this.setLastLoginEmail(normalizedEmail);

    // 1. Try server API first
    const apiResult = await dispatchApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, password })
    });

    if (apiResult.isJson) {
      if (apiResult.ok && apiResult.data && apiResult.data.success) {
        const { user, token } = apiResult.data;
        this.setSession(user, token);
        await this.mirrorUserToLocalVault(user, password);
        return user;
      } else {
        // If password was incorrect on the server
        if (apiResult.status === 401) {
          throw new Error('Incorrect password. Please try again or use Forgot Password.');
        }

        // If backend says 404 (user not found on server disk), check if they exist locally
        if (apiResult.status === 404) {
          const localUser = await this.findUserLocally(normalizedEmail);
          if (localUser) {
            return await this.authenticateLocalUser(localUser, password, normalizedEmail);
          }
          throw new Error(`No account found with "${normalizedEmail}". Please check your spelling or click "Create Account" below.`);
        }

        throw new Error(apiResult.error || 'Login failed. Please verify credentials.');
      }
    }

    // 2. Server unreachable (Offline / GitHub Pages / Static Hosting): Fallback to Local Vault
    console.log('[Chronex Auth] Backend unreachable, verifying against permanent local vault...');
    const localUser = await this.findUserLocally(normalizedEmail);
    if (!localUser) {
      throw new Error(`No account found with "${normalizedEmail}". Please check your spelling or click "Create Account" below.`);
    }

    return await this.authenticateLocalUser(localUser, password, normalizedEmail);
  }

  async authenticateLocalUser(localUser, password, normalizedEmail) {
    if (localUser.passwordHash && localUser.salt) {
      const computed = await this.hashPassword(password, localUser.salt);
      if (computed !== localUser.passwordHash) {
        throw new Error('Incorrect password. Please try again or use Forgot Password.');
      }
    }

    localUser.lastLoginAt = Date.now();
    const vault = this.getLocalVault();
    const idx = vault.findIndex((u) => u.email && u.email.toLowerCase() === normalizedEmail);
    if (idx >= 0) {
      vault[idx] = localUser;
      this.saveLocalVault(vault);
    }
    await idbSaveUser(localUser);

    const sessionUser = {
      id: localUser.id,
      name: localUser.name || 'Trader',
      email: localUser.email,
      securityQuestion: localUser.securityQuestion
    };
    const token = 'tok_vault_' + Math.random().toString(36).substring(2);

    this.setSession(sessionUser, token);

    // Attempt background sync
    this.syncVaultWithServer().catch(() => {});

    return sessionUser;
  }

  // ==========================================================================
  // Sign Up Engine
  // ==========================================================================
  async signUp({ name, email, password, securityQuestion, securityAnswer }) {
    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Please provide a valid email address.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    let resultUser = null;
    let resultToken = null;

    // 1. Try server API first
    const apiResult = await dispatchApi('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        email: normalizedEmail,
        password,
        securityQuestion,
        securityAnswer
      })
    });

    if (apiResult.isJson) {
      if (apiResult.ok && apiResult.data && apiResult.data.success) {
        resultUser = apiResult.data.user;
        resultToken = apiResult.data.token;
      } else if (apiResult.status === 409 || (apiResult.error && apiResult.error.includes('already exists'))) {
        throw new Error('An account with this email already exists. Please sign in.');
      } else if (apiResult.status === 400) {
        throw new Error(apiResult.error || 'Please fill in all required fields.');
      }
    }

    // 2. Check local vault duplication if server was offline
    const localExisting = await this.findUserLocally(normalizedEmail);
    if (localExisting && !resultUser) {
      throw new Error('An account with this email already exists on this device. Please sign in.');
    }

    // 3. Save permanently to Local Vault & IndexedDB
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const passwordHash = await this.hashPassword(password, salt);
    const answerHash = securityAnswer ? await this.hashAnswer(securityAnswer) : '';

    const newLocalUser = {
      id: resultUser ? resultUser.id : ('usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      salt,
      securityQuestion: securityQuestion || 'What is your primary trading market or city?',
      securityAnswerHash: answerHash,
      createdAt: resultUser ? resultUser.createdAt : Date.now(),
      lastLoginAt: Date.now()
    };

    const vault = this.getLocalVault();
    const existingIdx = vault.findIndex((u) => u.email && u.email.toLowerCase() === normalizedEmail);
    if (existingIdx >= 0) {
      vault[existingIdx] = newLocalUser;
    } else {
      vault.push(newLocalUser);
    }
    this.saveLocalVault(vault);
    await idbSaveUser(newLocalUser);

    const sessionUser = {
      id: newLocalUser.id,
      name: newLocalUser.name,
      email: newLocalUser.email,
      securityQuestion: newLocalUser.securityQuestion
    };
    const token = resultToken || ('tok_vault_' + Math.random().toString(36).substring(2));

    this.setSession(sessionUser, token);

    if (!resultUser) {
      this.syncVaultWithServer().catch(() => {});
    }

    return sessionUser;
  }

  // ==========================================================================
  // Sign Out Engine
  // ==========================================================================
  logOut() {
    const user = this.currentUser;
    if (user && user.email) {
      this.setLastLoginEmail(user.email);
      this.rememberAccount(user);
    }
    this.clearSession();
    console.log('[Chronex Auth] Active session cleared. All stored accounts preserved permanently.');
  }

  // ==========================================================================
  // Forgot Password: Check Account & Security Question
  // ==========================================================================
  async checkAccountForReset(email) {
    if (!email) {
      throw new Error('Please enter your account email.');
    }
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try server API
    const apiResult = await dispatchApi('/api/auth/forgot-password/check', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail })
    });

    if (apiResult.isJson) {
      if (apiResult.ok && apiResult.data && apiResult.data.success) {
        return apiResult.data.securityQuestion;
      }
      if (apiResult.status === 404) {
        const localUser = await this.findUserLocally(normalizedEmail);
        if (localUser) {
          return localUser.securityQuestion || 'What is your primary trading market or city?';
        }
        throw new Error(`No account registered with "${normalizedEmail}".`);
      }
    }

    // 2. Check local vault
    const localUser = await this.findUserLocally(normalizedEmail);
    if (!localUser) {
      throw new Error(`No account registered with "${normalizedEmail}".`);
    }
    return localUser.securityQuestion || 'What is your primary trading market or city?';
  }

  // ==========================================================================
  // Forgot Password: Reset Password with Verified Answer
  // ==========================================================================
  async resetPassword({ email, securityAnswer, newPassword }) {
    if (!email || !securityAnswer || !newPassword) {
      throw new Error('All fields are required to reset your password.');
    }
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }
    const normalizedEmail = email.trim().toLowerCase();

    let serverUpdated = false;

    // 1. Try server API
    const apiResult = await dispatchApi('/api/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify({
        email: normalizedEmail,
        securityAnswer,
        newPassword
      })
    });

    if (apiResult.isJson) {
      if (apiResult.ok && apiResult.data && apiResult.data.success) {
        serverUpdated = true;
      } else if (apiResult.status === 401) {
        throw new Error('Security answer does not match our records. Please try again.');
      } else if (apiResult.error && apiResult.status !== 404) {
        throw new Error(apiResult.error);
      }
    }

    // 2. Update local vault
    const user = await this.findUserLocally(normalizedEmail);
    if (user) {
      const answerHash = await this.hashAnswer(securityAnswer);
      if (user.securityAnswerHash && user.securityAnswerHash !== answerHash && !serverUpdated) {
        throw new Error('Security answer does not match our records. Please try again.');
      }
      const newSalt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      user.salt = newSalt;
      user.passwordHash = await this.hashPassword(newPassword, newSalt);

      const vault = this.getLocalVault();
      const idx = vault.findIndex((u) => u.email && u.email.toLowerCase() === normalizedEmail);
      if (idx >= 0) {
        vault[idx] = user;
        this.saveLocalVault(vault);
      }
      await idbSaveUser(user);
    } else if (!serverUpdated) {
      throw new Error('Account not found in local vault.');
    }

    this.setLastLoginEmail(normalizedEmail);
    return true;
  }
}

export const authManager = new AuthManager();

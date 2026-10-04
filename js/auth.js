/**
 * Chronex Authentication & User Vault Manager
 * Complete Signup, Login, Logout, and Forgot-Password engine.
 * Dual-persistence: Synchronizes with server backend API (/api/auth) and maintains
 * local vault so accounts are permanently remembered across refreshes and logoffs.
 */

const SESSION_KEY = 'chronex_active_session_v1';
const LOCAL_VAULT_KEY = 'chronex_users_vault_v1';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.listeners = [];
  }

  /**
   * Initializes auth state from stored session
   */
  async init() {
    try {
      const rawSession = localStorage.getItem(SESSION_KEY);
      if (rawSession) {
        const session = JSON.parse(rawSession);
        if (session && session.user && session.expiresAt > Date.now()) {
          this.currentUser = session.user;
          this.token = session.token;
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
      // Immediately trigger for current state
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
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    this.notify();
  }

  clearSession() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem(SESSION_KEY);
    this.notify();
  }

  // ==========================================================================
  // Local Vault Fallback (For offline PWA & permanent browser persistence)
  // ==========================================================================
  getLocalVault() {
    try {
      const data = localStorage.getItem(LOCAL_VAULT_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveLocalVault(users) {
    try {
      localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(users));
      return true;
    } catch (e) {
      return false;
    }
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

  // ==========================================================================
  // Sign Up
  // ==========================================================================
  async signUp({ name, email, password, securityQuestion, securityAnswer }) {
    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required.');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    let resultUser = null;
    let resultToken = null;

    // 1. Try server API first
    try {
      const res = await fetch('./api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: normalizedEmail,
          password,
          securityQuestion,
          securityAnswer
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      resultUser = data.user;
      resultToken = data.token;
    } catch (serverErr) {
      if (serverErr.message.includes('already exists')) {
        throw serverErr;
      }
      console.log('[Chronex Auth] Server API unavailable, saving to local vault...');
    }

    // 2. Synchronize to local vault
    const localUsers = this.getLocalVault();
    const existing = localUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      throw new Error('An account with this email already exists. Please log in.');
    }

    const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const passwordHash = await this.hashPassword(password, salt);
    const answerHash = securityAnswer ? await this.hashAnswer(securityAnswer) : '';

    const newLocalUser = {
      id: resultUser ? resultUser.id : 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      salt,
      securityQuestion: securityQuestion || 'What is your primary trading market or city?',
      securityAnswerHash: answerHash,
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    localUsers.push(newLocalUser);
    this.saveLocalVault(localUsers);

    const userForSession = {
      id: newLocalUser.id,
      name: newLocalUser.name,
      email: newLocalUser.email
    };
    const token = resultToken || 'tok_local_' + Math.random().toString(36).substring(2);

    this.setSession(userForSession, token);
    return userForSession;
  }

  // ==========================================================================
  // Log In
  // ==========================================================================
  async logIn(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try server API
    try {
      const res = await fetch('./api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        this.setSession(data.user, data.token);
        // Sync into local vault as backup
        const vault = this.getLocalVault();
        if (!vault.some((u) => u.email.toLowerCase() === normalizedEmail)) {
          vault.push({
            id: data.user.id,
            name: data.user.name,
            email: normalizedEmail,
            lastLoginAt: Date.now()
          });
          this.saveLocalVault(vault);
        }
        return data.user;
      } else if (res.status === 401 || res.status === 404 || res.status === 400) {
        throw new Error(data.error);
      }
    } catch (serverErr) {
      if (serverErr.message && !serverErr.message.includes('fetch')) {
        throw serverErr;
      }
      console.log('[Chronex Auth] Server API offline, checking local vault...');
    }

    // 2. Fallback to Local Vault
    const vault = this.getLocalVault();
    const user = vault.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      throw new Error('No account found with this email. Please check your spelling or sign up.');
    }

    if (user.passwordHash && user.salt) {
      const computed = await this.hashPassword(password, user.salt);
      if (computed !== user.passwordHash) {
        throw new Error('Incorrect password. Please try again or use Forgot Password.');
      }
    }

    user.lastLoginAt = Date.now();
    this.saveLocalVault(vault);

    const userForSession = {
      id: user.id,
      name: user.name,
      email: user.email
    };
    const token = 'tok_local_' + Math.random().toString(36).substring(2);
    this.setSession(userForSession, token);
    return userForSession;
  }

  // ==========================================================================
  // Log Out
  // ==========================================================================
  logOut() {
    this.clearSession();
    console.log('[Chronex Auth] User logged out. All stored accounts preserved.');
  }

  // ==========================================================================
  // Forgot Password: Check Account & Retrieve Security Question
  // ==========================================================================
  async checkAccountForReset(email) {
    if (!email) {
      throw new Error('Please enter your account email.');
    }
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try server API
    try {
      const res = await fetch('./api/auth/forgot-password/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return data.securityQuestion;
      } else if (res.status === 404) {
        throw new Error(data.error);
      }
    } catch (e) {
      if (e.message && !e.message.includes('fetch')) throw e;
    }

    // 2. Check local vault
    const vault = this.getLocalVault();
    const user = vault.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      throw new Error('No account registered with this email address.');
    }
    return user.securityQuestion || 'What is your primary trading market or city?';
  }

  // ==========================================================================
  // Forgot Password: Reset Password with Verified Security Answer
  // ==========================================================================
  async resetPassword({ email, securityAnswer, newPassword }) {
    if (!email || !securityAnswer || !newPassword) {
      throw new Error('All fields are required to reset your password.');
    }
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try server API
    let serverUpdated = false;
    try {
      const res = await fetch('./api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          securityAnswer,
          newPassword
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        serverUpdated = true;
      } else if (res.status === 401 || res.status === 404) {
        throw new Error(data.error);
      }
    } catch (e) {
      if (e.message && !e.message.includes('fetch')) throw e;
    }

    // 2. Synchronize in local vault
    const vault = this.getLocalVault();
    const user = vault.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (user) {
      const answerHash = await this.hashAnswer(securityAnswer);
      if (user.securityAnswerHash && user.securityAnswerHash !== answerHash) {
        if (!serverUpdated) {
          throw new Error('Security answer does not match our records. Please try again.');
        }
      }
      const newSalt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      user.salt = newSalt;
      user.passwordHash = await this.hashPassword(newPassword, newSalt);
      this.saveLocalVault(vault);
    } else if (!serverUpdated) {
      throw new Error('Account not found in local vault.');
    }

    return true;
  }
}

export const authManager = new AuthManager();

/**
 * Chronex Main Application Orchestrator
 * Connects Clocks, Market Sessions, Countdown Timers, Storage, and PWA logic.
 */

import { ClockManager } from './clock.js?v=2.5.0';
import { sessionTracker } from './sessions.js?v=2.5.0';
import { CountdownManager } from './countdown.js?v=2.5.0';
import { CalendarManager } from './calendar.js?v=2.5.0';
import { StorageManager } from './storage.js?v=2.5.0';
import { chronexAudio } from './audio.js?v=2.5.0';
import { authManager, dispatchApi } from './auth.js?v=2.5.0';

class ChronexApp {
  constructor() {
    this.settings = StorageManager.getSettings();
    this.deferredInstallPrompt = null;
    this.clock = null;
    this.countdown = null;
    this.calendar = null;

    // DOM Elements
    this.dom = {
      sessionCards: document.getElementById('session-cards-container'),
      timelineMaster: document.getElementById('timeline-master-container'),
      overlapBanner: document.getElementById('overlap-live-banner'),
      countdownCards: document.getElementById('events-cards-grid'),
      filterButtons: document.querySelectorAll('.filter-btn:not([data-cal-impact])'),
      searchInput: document.getElementById('event-search-input'),
      sortSelect: document.getElementById('event-sort-select'),
      // Live Economic Calendar DOM elements
      calEventsFeed: document.getElementById('calendar-events-feed'),
      calSyncStatus: document.getElementById('cal-sync-status'),
      btnRefreshCalendar: document.getElementById('btn-refresh-calendar'),
      btnSyncAllHighImpact: document.getElementById('btn-sync-all-high-impact'),
      calCurrencyChips: document.querySelectorAll('.currency-chip'),
      calImpactButtons: document.querySelectorAll('[data-cal-impact]'),
      calSearchInput: document.getElementById('calendar-search-input'),
      // Modals and dialogs
      modalEvent: document.getElementById('modal-event-dialog'),
      formEvent: document.getElementById('form-event-editor'),
      modalTitle: document.getElementById('modal-dialog-title'),
      eventIdInput: document.getElementById('input-event-id'),
      eventTitleInput: document.getElementById('input-event-title'),
      eventDatetimeInput: document.getElementById('input-event-datetime'),
      eventImpactSelect: document.getElementById('input-event-impact'),
      eventCategorySelect: document.getElementById('input-event-category'),
      eventNotesInput: document.getElementById('input-event-notes'),
      btnOpenAdd: document.getElementById('btn-open-add-modal'),
      btnCloseModal: document.getElementById('btn-close-modal'),
      btnCancelModal: document.getElementById('btn-cancel-modal'),
      btnToggleFormat: document.getElementById('btn-toggle-time-format'),
      btnToggleAudio: document.getElementById('btn-toggle-sound'),
      btnRequestNotifications: document.getElementById('btn-notifications-permission'),
      btnInstallPwa: document.getElementById('btn-install-pwa'),
      btnExportBackup: document.getElementById('btn-export-backup'),
      btnImportTrigger: document.getElementById('btn-import-backup-trigger'),
      fileImportInput: document.getElementById('input-import-file'),
      btnResetDefaults: document.getElementById('btn-reset-defaults'),
      toastContainer: document.getElementById('toast-container'),
      // Authentication & User Profile Elements
      modalAuth: document.getElementById('modal-auth-dialog'),
      btnOpenAuth: document.getElementById('btn-open-auth-modal'),
      btnCloseAuth: document.getElementById('btn-close-auth-modal'),
      userProfileWrap: document.getElementById('user-profile-menu-wrap'),
      btnUserProfilePill: document.getElementById('btn-user-profile-pill'),
      userAvatarInitials: document.getElementById('user-avatar-initials'),
      userDisplayName: document.getElementById('user-display-name'),
      userDropdownGlass: document.getElementById('user-dropdown-glass'),
      dropdownUserName: document.getElementById('dropdown-user-name'),
      dropdownUserEmail: document.getElementById('dropdown-user-email'),
      btnLogout: document.getElementById('btn-action-logout'),
      authTabsBar: document.getElementById('auth-tabs-bar'),
      tabAuthLogin: document.getElementById('tab-auth-login'),
      tabAuthSignup: document.getElementById('tab-auth-signup'),
      authAlertBanner: document.getElementById('auth-alert-banner'),
      // Form Login
      formAuthLogin: document.getElementById('form-auth-login'),
      inputLoginEmail: document.getElementById('input-login-email'),
      inputLoginPassword: document.getElementById('input-login-password'),
      loginAccountHint: document.getElementById('login-account-hint'),
      rememberedEmailsList: document.getElementById('remembered-emails-list'),
      btnToggleLoginPw: document.getElementById('btn-toggle-login-pw'),
      btnGotoForgot: document.getElementById('btn-goto-forgot'),
      btnCancelAuthLogin: document.getElementById('btn-cancel-auth-login'),
      btnSwitchToSignup: document.getElementById('btn-switch-to-signup'),
      // Form Signup
      formAuthSignup: document.getElementById('form-auth-signup'),
      inputSignupName: document.getElementById('input-signup-name'),
      inputSignupEmail: document.getElementById('input-signup-email'),
      inputSignupPassword: document.getElementById('input-signup-password'),
      btnToggleSignupPw: document.getElementById('btn-toggle-signup-pw'),
      inputSignupQuestion: document.getElementById('input-signup-question'),
      inputSignupAnswer: document.getElementById('input-signup-answer'),
      btnCancelAuthSignup: document.getElementById('btn-cancel-auth-signup'),
      btnSwitchToLogin: document.getElementById('btn-switch-to-login'),
      // Form Forgot Password
      formAuthForgot: document.getElementById('form-auth-forgot'),
      inputForgotEmail: document.getElementById('input-forgot-email'),
      btnForgotFindAccount: document.getElementById('btn-forgot-find-account'),
      forgotStep2: document.getElementById('forgot-step-2'),
      forgotQuestionText: document.getElementById('forgot-question-text'),
      inputForgotAnswer: document.getElementById('input-forgot-answer'),
      inputForgotNewPw: document.getElementById('input-forgot-newpw'),
      btnToggleForgotPw: document.getElementById('btn-toggle-forgot-pw'),
      btnForgotBackLogin: document.getElementById('btn-forgot-back-login'),
      btnSubmitResetPw: document.getElementById('btn-submit-reset-pw'),
      // Mobile Navigation & Drawer Elements
      hamburgerBtn: document.getElementById('btn-hamburger-menu'),
      mobileNavDrawer: document.getElementById('mobile-nav-drawer'),
      mobileDrawerBackdrop: document.getElementById('mobile-drawer-backdrop'),
      btnCloseMobileDrawer: document.getElementById('btn-close-mobile-drawer'),
      btnMobileQuickAdd: document.getElementById('btn-mobile-quick-add'),
      btnMobileFabAdd: document.getElementById('btn-mobile-fab-add'),
      drawerAuthGuest: document.getElementById('drawer-auth-guest'),
      drawerAuthUser: document.getElementById('drawer-auth-user'),
      btnDrawerLogin: document.getElementById('btn-drawer-login'),
      btnDrawerLogout: document.getElementById('btn-drawer-logout'),
      drawerAvatarInitials: document.getElementById('drawer-avatar-initials'),
      drawerUserName: document.getElementById('drawer-user-name'),
      drawerUserEmail: document.getElementById('drawer-user-email'),
      btnDrawerAddEvent: document.getElementById('btn-drawer-add-event'),
      btnDrawerToggleFormat: document.getElementById('btn-drawer-toggle-time-format'),
      drawerTimeFormatPill: document.getElementById('drawer-time-format-pill'),
      btnDrawerToggleSound: document.getElementById('btn-drawer-toggle-sound'),
      drawerSoundPill: document.getElementById('drawer-sound-pill'),
      btnDrawerNotifications: document.getElementById('btn-drawer-notifications'),
      drawerNotifPill: document.getElementById('drawer-notif-pill'),
      btnDrawerInstallPwa: document.getElementById('btn-drawer-install-pwa'),
      drawerNavLinks: document.querySelectorAll('[data-drawer-nav]'),
      btnDrawerExportBackup: document.getElementById('btn-drawer-export-backup'),
      btnDrawerImportBackup: document.getElementById('btn-drawer-import-backup'),
      btnDrawerRestoreDefaults: document.getElementById('btn-drawer-restore-defaults'),
      drawerBackendStatus: document.getElementById('drawer-backend-status')
    };
  }

  async init() {
    try {
      // 0. Initialize Auth session & listen for state changes
      authManager.onAuthStateChanged((user) => this.handleAuthStateChanged(user));
      await authManager.init();

      // 1. Audio setting
      chronexAudio.enabled = this.settings.soundEnabled;
      this.updateAudioButtonState();

      // 2. Initialize Countdowns first so tick handlers can find it
      this.countdown = new CountdownManager({
        container: this.dom.countdownCards,
        onEdit: (eventObj) => this.openEditModal(eventObj),
        onDelete: (id) => this.showToast('Event removed', 'info')
      });
      this.countdown.loadEvents();
      this.countdown.setFilter(this.settings.activeFilter || 'all');
      this.countdown.setSort(this.settings.sortBy || 'soonest');
      this.countdown.render();
      this.updateActiveFilterButtons();

      // 3. Initialize Live Economic Calendar Feed
      this.calendar = new CalendarManager({
        container: this.dom.calEventsFeed,
        statusEl: this.dom.calSyncStatus,
        onEventPinned: (title) => {
          this.countdown.loadEvents();
          this.countdown.render();
          this.showToast(`Pinned: ${title}`, 'success');
        }
      });
      this.calendar.init();

      // 4. Initial Render of Market Sessions & Master Timeline
      if (this.dom.sessionCards && this.dom.timelineMaster) {
        sessionTracker.render(
          this.dom.sessionCards,
          this.dom.timelineMaster,
          this.dom.overlapBanner,
          new Date()
        );
      }

      // 5. Setup UI Event Listeners
      this.setupListeners();

      // 6. Setup PWA & Service Worker
      this.setupPwa();

      // 7. Initialize Clocks and start tick timer last
      this.clock = new ClockManager({
        timeFormat: this.settings.timeFormat,
        onTick: (tickData) => this.handleClockTick(tickData)
      });
      this.clock.start();
      this.updateTimeFormatButtonState();

      // 8. Setup Mobile Drawer and Mobile Terminal Listeners
      this.setupMobileDrawerListeners();

      // 9. Start background server synchronization & workload polling
      this.startDashboardPolling();

      // Check URL parameters for quick actions
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('action') === 'add-event') {
        this.openAddModal();
      }

      console.log('[Chronex] Core modules initialized successfully');
    } catch (e) {
      console.error('[Chronex] Init failure:', e);
    }
  }

  handleClockTick(tickData) {
    if (!tickData) return;
    const now = tickData.now || new Date();

    // Update market sessions, progress bars, and master timeline
    if (this.dom.sessionCards && this.dom.timelineMaster) {
      sessionTracker.render(
        this.dom.sessionCards,
        this.dom.timelineMaster,
        this.dom.overlapBanner,
        now
      );
    }

    // Update city times on the session cards
    if (tickData.cityTimes) {
      const sydneyCityTime = document.getElementById('card-city-sydney');
      const tokyoCityTime = document.getElementById('card-city-tokyo');
      const londonCityTime = document.getElementById('card-city-london');
      const newYorkCityTime = document.getElementById('card-city-new-york');

      if (sydneyCityTime) sydneyCityTime.textContent = tickData.cityTimes.sydney || '--:--';
      if (tokyoCityTime) tokyoCityTime.textContent = tickData.cityTimes.tokyo || '--:--';
      if (londonCityTime) londonCityTime.textContent = tickData.cityTimes.london || '--:--';
      if (newYorkCityTime) newYorkCityTime.textContent = tickData.cityTimes.newYork || '--:--';
    }

    // Update countdown timers safely
    if (this.countdown) {
      this.countdown.tick();
    }
    if (this.calendar) {
      this.calendar.tick();
    }
  }

  setupListeners() {
    // Add Event Modal Triggers
    this.dom.btnOpenAdd?.addEventListener('click', () => this.openAddModal());
    this.dom.btnCloseModal?.addEventListener('click', () => this.closeModal());
    this.dom.btnCancelModal?.addEventListener('click', () => this.closeModal());

    // Close on backdrop click
    this.dom.modalEvent?.addEventListener('click', (e) => {
      if (e.target === this.dom.modalEvent) {
        this.closeModal();
      }
    });

    // Form submission
    this.dom.formEvent?.addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Preset quick chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const title = chip.getAttribute('data-title');
        const impact = chip.getAttribute('data-impact');
        const cat = chip.getAttribute('data-cat');
        const hoursAhead = parseFloat(chip.getAttribute('data-hours') || '2');

        const targetDate = new Date(Date.now() + hoursAhead * 3600 * 1000);
        StorageManager.addEvent({
          title,
          targetDate: targetDate.toISOString(),
          impact,
          category: cat,
          notes: `Quick preset scheduled for ${targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        });

        this.countdown.loadEvents();
        this.countdown.render();
        chronexAudio.playChime('click');
        this.showToast(`Scheduled: ${title}`, 'success');
      });
    });

    // Filter Buttons
    this.dom.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filterVal = btn.getAttribute('data-filter');
        this.settings.activeFilter = filterVal;
        StorageManager.saveSettings({ activeFilter: filterVal });
        this.countdown.setFilter(filterVal);
        this.updateActiveFilterButtons();
        chronexAudio.playChime('click');
      });
    });

    // Search Input
    this.dom.searchInput?.addEventListener('input', (e) => {
      this.countdown.setSearch(e.target.value);
    });

    // Sort Dropdown
    this.dom.sortSelect?.addEventListener('change', (e) => {
      this.settings.sortBy = e.target.value;
      StorageManager.saveSettings({ sortBy: e.target.value });
      this.countdown.setSort(e.target.value);
      chronexAudio.playChime('click');
    });

    // 12/24 Hour Toggle
    this.dom.btnToggleFormat?.addEventListener('click', () => {
      const newFormat = this.clock.toggleTimeFormat();
      this.settings.timeFormat = newFormat;
      StorageManager.saveSettings({ timeFormat: newFormat });
      this.updateTimeFormatButtonState();
      chronexAudio.playChime('click');
      this.showToast(`Switched to ${newFormat}-hour clock mode`, 'info');
    });

    // Sound Toggle
    this.dom.btnToggleAudio?.addEventListener('click', () => {
      const enabled = chronexAudio.toggle();
      this.settings.soundEnabled = enabled;
      StorageManager.saveSettings({ soundEnabled: enabled });
      this.updateAudioButtonState();
      this.showToast(`Audio alerts ${enabled ? 'enabled' : 'muted'}`, 'info');
    });

    // Notification Permission
    this.dom.btnRequestNotifications?.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        this.showToast('Browser notifications not supported in this browser.', 'warning');
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          this.settings.notificationsEnabled = true;
          StorageManager.saveSettings({ notificationsEnabled: true });
          this.updateNotificationButtonState();
          this.showToast('Desktop notifications enabled!', 'success');
          new Notification('CHRONEX Alerts Active', {
            body: 'You will receive timely alerts when scheduled releases countdown to zero.',
            icon: './assets/icons/icon-192.png'
          });
        } else {
          this.showToast('Notification permission denied', 'warning');
        }
      } catch (err) {
        console.error('Notification error:', err);
      }
    });

    // Export Backup
    this.dom.btnExportBackup?.addEventListener('click', () => {
      StorageManager.exportBackup();
      this.showToast('Exported backup file', 'success');
    });

    // Import Backup Trigger
    this.dom.btnImportTrigger?.addEventListener('click', () => {
      this.dom.fileImportInput?.click();
    });

    this.dom.fileImportInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const success = StorageManager.importBackup(evt.target.result);
        if (success) {
          this.countdown.loadEvents();
          this.countdown.render();
          this.showToast('Backup restored successfully!', 'success');
        } else {
          this.showToast('Failed to parse backup JSON file.', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Reset Defaults
    this.dom.btnResetDefaults?.addEventListener('click', () => {
      if (confirm('Reset custom events to standard economic release presets?')) {
        this.countdown.events = StorageManager.resetToPresets();
        this.countdown.render();
        this.showToast('Preset market releases restored', 'info');
      }
    });

    // Calendar Currency Filter Chips
    this.dom.calCurrencyChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.calCurrencyChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const cur = chip.getAttribute('data-currency');
        this.calendar.setCurrencyFilter(cur);
        chronexAudio.playChime('click');
      });
    });

    // Calendar Impact Filter Buttons
    this.dom.calImpactButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.calImpactButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const impact = btn.getAttribute('data-cal-impact');
        this.calendar.setImpactFilter(impact);
        chronexAudio.playChime('click');
      });
    });

    // Calendar Search Input
    this.dom.calSearchInput?.addEventListener('input', (e) => {
      this.calendar.setSearch(e.target.value);
    });

    // Calendar Refresh Button
    this.dom.btnRefreshCalendar?.addEventListener('click', async () => {
      chronexAudio.playChime('click');
      await this.calendar.fetchLiveEvents();
      this.showToast('Live economic calendar refreshed', 'info');
    });

    // Sync All High-Impact Button
    this.dom.btnSyncAllHighImpact?.addEventListener('click', () => {
      const added = this.calendar.syncAllHighImpact();
      if (added > 0) {
        this.countdown.loadEvents();
        this.countdown.render();
        this.showToast(`Synced ${added} high-impact releases to dashboard!`, 'success');
      } else {
        this.showToast('All high-impact releases are already tracked', 'info');
      }
    });

    this.updateNotificationButtonState();

    // Setup Authentication & Account Management Listeners
    this.setupAuthListeners();
  }

  setupAuthListeners() {
    // Open Auth Modal
    this.dom.btnOpenAuth?.addEventListener('click', () => {
      chronexAudio.playChime('click');
      this.openAuthModal('login');
    });

    // Close Auth Modal
    this.dom.btnCloseAuth?.addEventListener('click', () => this.closeAuthModal());
    this.dom.btnCancelAuthLogin?.addEventListener('click', () => this.closeAuthModal());
    this.dom.btnCancelAuthSignup?.addEventListener('click', () => this.closeAuthModal());

    // Close on backdrop click
    this.dom.modalAuth?.addEventListener('click', (e) => {
      if (e.target === this.dom.modalAuth) {
        this.closeAuthModal();
      }
    });

    // Tabs and Mode Switchers
    this.dom.tabAuthLogin?.addEventListener('click', () => this.switchAuthTab('login'));
    this.dom.tabAuthSignup?.addEventListener('click', () => this.switchAuthTab('signup'));
    this.dom.btnSwitchToSignup?.addEventListener('click', () => this.switchAuthTab('signup'));
    this.dom.btnSwitchToLogin?.addEventListener('click', () => this.switchAuthTab('login'));
    this.dom.btnGotoForgot?.addEventListener('click', () => this.switchAuthTab('forgot'));
    this.dom.btnForgotBackLogin?.addEventListener('click', () => this.switchAuthTab('login'));

    // Password visibility toggles
    this.dom.btnToggleLoginPw?.addEventListener('click', () => {
      this.togglePwVisibility(this.dom.inputLoginPassword, this.dom.btnToggleLoginPw);
    });
    this.dom.btnToggleSignupPw?.addEventListener('click', () => {
      this.togglePwVisibility(this.dom.inputSignupPassword, this.dom.btnToggleSignupPw);
    });
    this.dom.btnToggleForgotPw?.addEventListener('click', () => {
      this.togglePwVisibility(this.dom.inputForgotNewPw, this.dom.btnToggleForgotPw);
    });

    // Email typing live recognition badge
    this.dom.inputLoginEmail?.addEventListener('input', () => {
      this.updateLoginAccountBadge(this.dom.inputLoginEmail.value);
    });

    // Form: Sign In
    this.dom.formAuthLogin?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = this.dom.inputLoginEmail.value.trim();
      const password = this.dom.inputLoginPassword.value;
      const submitBtn = document.getElementById('btn-submit-login');

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Signing in...';
        }
        const user = await authManager.logIn(email, password);
        if (this.dom.inputLoginPassword) this.dom.inputLoginPassword.value = '';
        this.closeAuthModal();
        this.showToast(`Welcome back, ${user.name}!`, 'success');
        chronexAudio.playChime('click');
      } catch (err) {
        this.setAuthAlert(err.message || 'Login failed. Please verify credentials.', 'error');
        chronexAudio.playChime('error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In';
        }
      }
    });

    // Form: Sign Up
    this.dom.formAuthSignup?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = this.dom.inputSignupName.value.trim();
      const email = this.dom.inputSignupEmail.value.trim();
      const password = this.dom.inputSignupPassword.value;
      const securityQuestion = this.dom.inputSignupQuestion.value;
      const securityAnswer = this.dom.inputSignupAnswer.value.trim();
      const submitBtn = document.getElementById('btn-submit-signup');

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating account...';
        }
        const user = await authManager.signUp({
          name,
          email,
          password,
          securityQuestion,
          securityAnswer
        });
        if (this.dom.inputLoginEmail) this.dom.inputLoginEmail.value = email;
        if (this.dom.inputLoginPassword) this.dom.inputLoginPassword.value = '';
        this.closeAuthModal();
        this.showToast(`Account created! Welcome, ${user.name}!`, 'success');
        chronexAudio.playChime('click');
      } catch (err) {
        this.setAuthAlert(err.message || 'Registration failed.', 'error');
        chronexAudio.playChime('error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Account';
        }
      }
    });

    // Forgot Password: Find Account Step
    this.dom.btnForgotFindAccount?.addEventListener('click', async () => {
      const email = this.dom.inputForgotEmail.value.trim();
      if (!email) {
        this.setAuthAlert('Please enter your registered email address.', 'error');
        return;
      }
      try {
        this.dom.btnForgotFindAccount.disabled = true;
        this.dom.btnForgotFindAccount.textContent = 'Searching...';
        const question = await authManager.checkAccountForReset(email);
        if (this.dom.forgotQuestionText) this.dom.forgotQuestionText.textContent = question;
        if (this.dom.forgotStep2) this.dom.forgotStep2.classList.remove('hidden');
        if (this.dom.btnSubmitResetPw) this.dom.btnSubmitResetPw.classList.remove('hidden');
        this.clearAuthAlert();
        this.setAuthAlert('Account located! Answer your security question below to set a new password.', 'success');
      } catch (err) {
        this.setAuthAlert(err.message || 'Could not locate account with this email.', 'error');
      } finally {
        this.dom.btnForgotFindAccount.disabled = false;
        this.dom.btnForgotFindAccount.textContent = 'Find';
      }
    });

    // Form: Forgot Password Reset
    this.dom.formAuthForgot?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = this.dom.inputForgotEmail.value.trim();
      const securityAnswer = this.dom.inputForgotAnswer.value.trim();
      const newPassword = this.dom.inputForgotNewPw.value;
      const submitBtn = this.dom.btnSubmitResetPw;

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Updating password...';
        }
        await authManager.resetPassword({ email, securityAnswer, newPassword });
        this.setAuthAlert('Password successfully reset! Please sign in with your new password.', 'success');
        chronexAudio.playChime('click');
        setTimeout(() => {
          this.switchAuthTab('login');
          if (this.dom.inputLoginEmail) this.dom.inputLoginEmail.value = email;
          if (this.dom.inputLoginPassword) this.dom.inputLoginPassword.value = '';
        }, 1500);
      } catch (err) {
        this.setAuthAlert(err.message || 'Failed to reset password.', 'error');
        chronexAudio.playChime('error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reset Password';
        }
      }
    });

    // User Profile Pill Toggle
    this.dom.btnUserProfilePill?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.dom.userDropdownGlass) return;
      const isHidden = this.dom.userDropdownGlass.classList.contains('hidden');
      this.dom.userDropdownGlass.classList.toggle('hidden', !isHidden);
      this.dom.btnUserProfilePill.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });

    // Close user dropdown if clicked outside
    document.addEventListener('click', (e) => {
      if (this.dom.userProfileWrap && !this.dom.userProfileWrap.contains(e.target)) {
        if (this.dom.userDropdownGlass) {
          this.dom.userDropdownGlass.classList.add('hidden');
          this.dom.btnUserProfilePill?.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // Logout Action
    this.dom.btnLogout?.addEventListener('click', () => {
      const activeUser = authManager.getCurrentUser();
      const lastEmail = activeUser ? activeUser.email : authManager.getLastLoginEmail();
      authManager.logOut();
      if (this.dom.inputLoginEmail && lastEmail) {
        this.dom.inputLoginEmail.value = lastEmail;
      }
      if (this.dom.inputLoginPassword) {
        this.dom.inputLoginPassword.value = '';
      }
      this.updateLoginAccountBadge(lastEmail);
      this.showToast('Logged out. Your account remains permanently saved on this device.', 'info');
      chronexAudio.playChime('click');
    });
  }

  handleAuthStateChanged(user) {
    if (user) {
      // User is logged in: scope StorageManager to this user ID
      StorageManager.setUserId(user.id);

      // Desktop Profile Pill
      if (this.dom.btnOpenAuth) this.dom.btnOpenAuth.classList.add('hidden');
      if (this.dom.userProfileWrap) this.dom.userProfileWrap.classList.remove('hidden');

      const initials = (user.name ? user.name.slice(0, 2) : (user.email ? user.email.slice(0, 2) : 'U')).toUpperCase();
      if (this.dom.userAvatarInitials) this.dom.userAvatarInitials.textContent = initials;
      if (this.dom.userDisplayName) this.dom.userDisplayName.textContent = user.name || user.email.split('@')[0];
      if (this.dom.dropdownUserName) this.dom.dropdownUserName.textContent = user.name || 'Trader';
      if (this.dom.dropdownUserEmail) this.dom.dropdownUserEmail.textContent = user.email || '';

      // Mobile Drawer Profile Card
      if (this.dom.drawerAuthGuest) this.dom.drawerAuthGuest.classList.add('hidden');
      if (this.dom.drawerAuthUser) this.dom.drawerAuthUser.classList.remove('hidden');
      if (this.dom.drawerAvatarInitials) this.dom.drawerAvatarInitials.textContent = initials;
      if (this.dom.drawerUserName) this.dom.drawerUserName.textContent = user.name || 'Trader';
      if (this.dom.drawerUserEmail) this.dom.drawerUserEmail.textContent = user.email || '';

      if (this.countdown) {
        this.countdown.loadEvents();
        this.countdown.render();
      }
    } else {
      // Guest / Logged out
      StorageManager.setUserId(null);

      // Desktop Profile Pill
      if (this.dom.btnOpenAuth) this.dom.btnOpenAuth.classList.remove('hidden');
      if (this.dom.userProfileWrap) this.dom.userProfileWrap.classList.add('hidden');
      if (this.dom.userDropdownGlass) this.dom.userDropdownGlass.classList.add('hidden');

      // Mobile Drawer Profile Card
      if (this.dom.drawerAuthGuest) this.dom.drawerAuthGuest.classList.remove('hidden');
      if (this.dom.drawerAuthUser) this.dom.drawerAuthUser.classList.add('hidden');

      if (this.countdown) {
        this.countdown.loadEvents();
        this.countdown.render();
      }
    }
  }

  openAuthModal(mode = 'login') {
    this.clearAuthAlert();
    this.switchAuthTab(mode);
    if (this.dom.modalAuth) {
      this.dom.modalAuth.showModal();
    }
  }

  closeAuthModal() {
    if (this.dom.modalAuth) {
      this.dom.modalAuth.close();
    }
    this.clearAuthAlert();
  }

  switchAuthTab(mode) {
    this.clearAuthAlert();
    const isLogin = mode === 'login';
    const isSignup = mode === 'signup';
    const isForgot = mode === 'forgot';

    if (this.dom.authTabsBar) {
      this.dom.authTabsBar.style.display = isForgot ? 'none' : 'flex';
    }

    if (this.dom.tabAuthLogin) {
      this.dom.tabAuthLogin.classList.toggle('active', isLogin);
      this.dom.tabAuthLogin.setAttribute('aria-selected', isLogin ? 'true' : 'false');
    }
    if (this.dom.tabAuthSignup) {
      this.dom.tabAuthSignup.classList.toggle('active', isSignup);
      this.dom.tabAuthSignup.setAttribute('aria-selected', isSignup ? 'true' : 'false');
    }

    if (this.dom.formAuthLogin) this.dom.formAuthLogin.classList.toggle('hidden', !isLogin);
    if (this.dom.formAuthSignup) this.dom.formAuthSignup.classList.toggle('hidden', !isSignup);
    if (this.dom.formAuthForgot) this.dom.formAuthForgot.classList.toggle('hidden', !isForgot);

    // Populate datalist with all remembered accounts on this device
    if (this.dom.rememberedEmailsList) {
      const accounts = authManager.getRememberedAccounts();
      this.dom.rememberedEmailsList.innerHTML = accounts
        .map((a) => `<option value="${a.email}">${a.name ? `${a.name} (${a.email})` : a.email}</option>`)
        .join('');
    }

    if (isLogin && this.dom.inputLoginEmail) {
      const lastEmail = authManager.getLastLoginEmail();
      if (lastEmail) {
        this.dom.inputLoginEmail.value = lastEmail;
      }
      this.updateLoginAccountBadge(this.dom.inputLoginEmail.value);

      setTimeout(() => {
        if (this.dom.inputLoginEmail.value && this.dom.inputLoginPassword) {
          this.dom.inputLoginPassword.focus();
        } else {
          this.dom.inputLoginEmail.focus();
        }
      }, 50);
    } else if (isSignup && this.dom.inputSignupName) {
      // Pre-fill email in signup if user already typed one in login
      if (this.dom.inputLoginEmail?.value && !this.dom.inputSignupEmail?.value) {
        this.dom.inputSignupEmail.value = this.dom.inputLoginEmail.value;
      }
      setTimeout(() => this.dom.inputSignupName.focus(), 50);
    } else if (isForgot && this.dom.inputForgotEmail) {
      if (this.dom.inputLoginEmail?.value) {
        this.dom.inputForgotEmail.value = this.dom.inputLoginEmail.value;
      }
      if (this.dom.forgotStep2) this.dom.forgotStep2.classList.add('hidden');
      if (this.dom.btnSubmitResetPw) this.dom.btnSubmitResetPw.classList.add('hidden');
      setTimeout(() => this.dom.inputForgotEmail.focus(), 50);
    }
  }

  updateLoginAccountBadge(email) {
    if (!this.dom.loginAccountHint) return;
    const norm = (email || '').trim().toLowerCase();
    if (!norm) {
      this.dom.loginAccountHint.classList.add('hidden');
      this.dom.loginAccountHint.textContent = '';
      return;
    }
    const accounts = authManager.getRememberedAccounts();
    const match = accounts.find((a) => a.email.toLowerCase() === norm);
    if (match) {
      this.dom.loginAccountHint.textContent = `✓ Recognized account: ${match.name || 'Trader'}`;
      this.dom.loginAccountHint.classList.remove('hidden');
    } else {
      this.dom.loginAccountHint.classList.add('hidden');
      this.dom.loginAccountHint.textContent = '';
    }
  }

  setAuthAlert(message, type = 'error') {
    if (!this.dom.authAlertBanner) return;
    this.dom.authAlertBanner.textContent = message;
    this.dom.authAlertBanner.className = `auth-alert-banner ${type}`;
    this.dom.authAlertBanner.classList.remove('hidden');
  }

  clearAuthAlert() {
    if (!this.dom.authAlertBanner) return;
    this.dom.authAlertBanner.textContent = '';
    this.dom.authAlertBanner.className = 'auth-alert-banner hidden';
  }

  togglePwVisibility(inputEl, btnEl) {
    if (!inputEl) return;
    const isPw = inputEl.type === 'password';
    inputEl.type = isPw ? 'text' : 'password';
    if (btnEl) btnEl.textContent = isPw ? '🙈' : '👁';
  }

  openAddModal() {
    this.dom.modalTitle.textContent = 'Add Countdown Event';
    this.dom.eventIdInput.value = '';
    this.dom.eventTitleInput.value = '';
    this.dom.eventImpactSelect.value = 'high';
    this.dom.eventCategorySelect.value = 'financial';
    this.dom.eventNotesInput.value = '';

    // Set default datetime to tomorrow at 13:30 (typical London/NY overlap release)
    const def = new Date(Date.now() + 24 * 3600 * 1000);
    def.setHours(13, 30, 0, 0);

    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const year = def.getFullYear();
    const month = String(def.getMonth() + 1).padStart(2, '0');
    const day = String(def.getDate()).padStart(2, '0');
    const hours = String(def.getHours()).padStart(2, '0');
    const mins = String(def.getMinutes()).padStart(2, '0');
    this.dom.eventDatetimeInput.value = `${year}-${month}-${day}T${hours}:${mins}`;

    this.dom.modalEvent.showModal();
    this.dom.eventTitleInput.focus();
  }

  openEditModal(ev) {
    this.dom.modalTitle.textContent = 'Edit Countdown Event';
    this.dom.eventIdInput.value = ev.id;
    this.dom.eventTitleInput.value = ev.title;
    this.dom.eventImpactSelect.value = ev.impact;
    this.dom.eventCategorySelect.value = ev.category;
    this.dom.eventNotesInput.value = ev.notes || '';

    const d = new Date(ev.targetDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    this.dom.eventDatetimeInput.value = `${year}-${month}-${day}T${hours}:${mins}`;

    this.dom.modalEvent.showModal();
    this.dom.eventTitleInput.focus();
  }

  closeModal() {
    this.dom.modalEvent.close();
  }

  handleFormSubmit(e) {
    e.preventDefault();
    const id = this.dom.eventIdInput.value;
    const title = this.dom.eventTitleInput.value.trim();
    const datetimeVal = this.dom.eventDatetimeInput.value;
    const impact = this.dom.eventImpactSelect.value;
    const category = this.dom.eventCategorySelect.value;
    const notes = this.dom.eventNotesInput.value.trim();

    if (!title) {
      alert('Please enter an event title');
      return;
    }
    if (!datetimeVal) {
      alert('Please select a target date and time');
      return;
    }

    const targetDate = new Date(datetimeVal).toISOString();

    if (id) {
      // Edit existing
      StorageManager.updateEvent(id, {
        title,
        targetDate,
        impact,
        category,
        notes,
        notified: false // reset notification on edit
      });
      this.showToast('Event updated', 'success');
    } else {
      // Add new
      StorageManager.addEvent({
        title,
        targetDate,
        impact,
        category,
        notes
      });
      this.showToast('New event countdown added', 'success');
    }

    this.countdown.loadEvents();
    this.countdown.render();
    chronexAudio.playChime('click');
    this.closeModal();
  }

  updateActiveFilterButtons() {
    this.dom.filterButtons.forEach(btn => {
      const f = btn.getAttribute('data-filter');
      if (f === this.countdown.filter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  updateTimeFormatButtonState() {
    const fmt = `${this.clock.timeFormat}H`;
    if (this.dom.btnToggleFormat) {
      this.dom.btnToggleFormat.innerHTML = `
        <span class="btn-icon">⏱</span>
        <span>Format: ${fmt}</span>
      `;
    }
    if (this.dom.drawerTimeFormatPill) {
      this.dom.drawerTimeFormatPill.textContent = fmt;
    }
  }

  updateAudioButtonState() {
    const isMuted = !chronexAudio.enabled;
    if (this.dom.btnToggleAudio) {
      this.dom.btnToggleAudio.innerHTML = isMuted 
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg><span>Sound Off</span>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg><span>Sound On</span>`;
      this.dom.btnToggleAudio.classList.toggle('btn-muted', isMuted);
    }
    if (this.dom.drawerSoundPill) {
      this.dom.drawerSoundPill.textContent = isMuted ? 'MUTED' : 'ON';
    }
  }

  updateNotificationButtonState() {
    const isGranted = ('Notification' in window) && Notification.permission === 'granted';
    if (this.dom.btnRequestNotifications && 'Notification' in window) {
      if (isGranted) {
        this.dom.btnRequestNotifications.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <span>Alerts Active</span>
        `;
        this.dom.btnRequestNotifications.classList.add('btn-active');
      } else {
        this.dom.btnRequestNotifications.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          <span>Enable Alerts</span>
        `;
        this.dom.btnRequestNotifications.classList.remove('btn-active');
      }
    }
    if (this.dom.drawerNotifPill) {
      this.dom.drawerNotifPill.textContent = isGranted ? 'Active' : 'Enable';
    }
  }

  showToast(message, type = 'info') {
    if (!this.dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-indicator"></span>
      <span class="toast-msg">${message}</span>
    `;
    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  setupPwa() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('[Chronex PWA] ServiceWorker registered with scope:', registration.scope);
            registration.update();
          })
          .catch((error) => {
            console.warn('[Chronex PWA] ServiceWorker registration failed:', error);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    // Capture beforeinstallprompt for standalone install button
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (this.dom.btnInstallPwa) {
        this.dom.btnInstallPwa.classList.remove('hidden');
      }
      if (this.dom.btnDrawerInstallPwa) {
        this.dom.btnDrawerInstallPwa.classList.remove('hidden');
      }
    });

    this.dom.btnInstallPwa?.addEventListener('click', async () => {
      if (!this.deferredInstallPrompt) return;
      this.deferredInstallPrompt.prompt();
      const { outcome } = await this.deferredInstallPrompt.userChoice;
      console.log(`[Chronex PWA] User install response: ${outcome}`);
      this.deferredInstallPrompt = null;
      this.dom.btnInstallPwa.classList.add('hidden');
      this.dom.btnDrawerInstallPwa?.classList.add('hidden');
    });

    window.addEventListener('appinstalled', () => {
      console.log('[CHRONEX PWA] Successfully installed!');
      this.showToast('CHRONEX installed as an app!', 'success');
      this.dom.btnInstallPwa?.classList.add('hidden');
      this.dom.btnDrawerInstallPwa?.classList.add('hidden');
    });

    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      if (this.dom.btnInstallPwa) {
        this.dom.btnInstallPwa.classList.add('hidden');
      }
      if (this.dom.btnDrawerInstallPwa) {
        this.dom.btnDrawerInstallPwa.classList.add('hidden');
      }
    }
  }

  // ==========================================================================
  // Mobile Hamburger & Slide-In Navigation Drawer System
  // ==========================================================================
  setupMobileDrawerListeners() {
    // 1. Hamburger button toggle
    this.dom.hamburgerBtn?.addEventListener('click', () => {
      this.toggleMobileDrawer();
    });

    // 2. Close button in drawer header
    this.dom.btnCloseMobileDrawer?.addEventListener('click', () => {
      this.closeMobileDrawer();
    });

    // 3. Backdrop tap to dismiss
    this.dom.mobileDrawerBackdrop?.addEventListener('click', () => {
      this.closeMobileDrawer();
    });

    // 4. Escape key closes drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isMobileDrawerOpen()) {
        this.closeMobileDrawer();
      }
    });

    // 5. Touch swipe to dismiss drawer
    let touchStartX = 0;
    this.dom.mobileNavDrawer?.addEventListener('touchstart', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        touchStartX = e.changedTouches[0].clientX;
      }
    }, { passive: true });

    this.dom.mobileNavDrawer?.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const touchEndX = e.changedTouches[0].clientX;
        // Swiped right by > 50px
        if (touchEndX - touchStartX > 50) {
          this.closeMobileDrawer();
        }
      }
    }, { passive: true });

    // 6. Mobile Quick Add (+) button and Mobile FAB button
    this.dom.btnMobileQuickAdd?.addEventListener('click', () => {
      chronexAudio.playChime('click');
      this.openAddModal();
    });

    this.dom.btnMobileFabAdd?.addEventListener('click', () => {
      chronexAudio.playChime('click');
      this.openAddModal();
    });

    // 7. Drawer Primary Add Event button
    this.dom.btnDrawerAddEvent?.addEventListener('click', () => {
      this.closeMobileDrawer();
      this.openAddModal();
    });

    // 8. Drawer Time Format toggle
    this.dom.btnDrawerToggleFormat?.addEventListener('click', () => {
      const newFormat = this.clock.toggleTimeFormat();
      this.settings.timeFormat = newFormat;
      StorageManager.saveSettings({ timeFormat: newFormat });
      this.updateTimeFormatButtonState();
      chronexAudio.playChime('click');
      this.showToast(`Switched to ${newFormat}-hour format`, 'info');
    });

    // 9. Drawer Audio toggle
    this.dom.btnDrawerToggleSound?.addEventListener('click', () => {
      const enabled = chronexAudio.toggle();
      this.settings.soundEnabled = enabled;
      StorageManager.saveSettings({ soundEnabled: enabled });
      this.updateAudioButtonState();
      this.showToast(`Audio alerts ${enabled ? 'enabled' : 'muted'}`, 'info');
    });

    // 10. Drawer Notifications toggle
    this.dom.btnDrawerNotifications?.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        this.showToast('Browser notifications not supported.', 'warning');
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          this.settings.notificationsEnabled = true;
          StorageManager.saveSettings({ notificationsEnabled: true });
          this.updateNotificationButtonState();
          this.showToast('Notifications enabled!', 'success');
        } else {
          this.showToast('Notifications permission denied', 'warning');
        }
      } catch (err) {
        console.error('Notification error:', err);
      }
    });

    // 11. Drawer Navigation Jump Links (smooth scroll + close drawer)
    this.dom.drawerNavLinks?.forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId && targetId.startsWith('#')) {
          e.preventDefault();
          this.closeMobileDrawer();
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    // 12. Drawer Auth buttons
    this.dom.btnDrawerLogin?.addEventListener('click', () => {
      this.closeMobileDrawer();
      this.openAuthModal('login');
    });

    this.dom.btnDrawerLogout?.addEventListener('click', () => {
      const activeUser = authManager.getCurrentUser();
      const lastEmail = activeUser ? activeUser.email : authManager.getLastLoginEmail();
      this.closeMobileDrawer();
      authManager.logOut();
      if (this.dom.inputLoginEmail && lastEmail) {
        this.dom.inputLoginEmail.value = lastEmail;
      }
      if (this.dom.inputLoginPassword) {
        this.dom.inputLoginPassword.value = '';
      }
      this.updateLoginAccountBadge(lastEmail);
      this.showToast('Logged out. Your account remains permanently saved on this device.', 'info');
    });

    // 13. Drawer Backup / Restore buttons
    this.dom.btnDrawerExportBackup?.addEventListener('click', () => {
      StorageManager.exportBackup();
      this.showToast('Exported backup file', 'success');
    });

    this.dom.btnDrawerImportBackup?.addEventListener('click', () => {
      this.closeMobileDrawer();
      this.dom.fileImportInput?.click();
    });

    this.dom.btnDrawerRestoreDefaults?.addEventListener('click', () => {
      if (confirm('Restore preset releases?')) {
        this.countdown.events = StorageManager.resetToPresets();
        this.countdown.render();
        this.showToast('Presets restored', 'info');
      }
    });

    // 14. Drawer Install PWA button
    this.dom.btnDrawerInstallPwa?.addEventListener('click', () => {
      if (this.deferredInstallPrompt) {
        this.dom.btnInstallPwa?.click();
      } else {
        this.showToast('To install, use browser menu: Add to Home Screen', 'info');
      }
    });
  }

  isMobileDrawerOpen() {
    return this.dom.mobileNavDrawer?.classList.contains('is-open');
  }

  toggleMobileDrawer() {
    if (this.isMobileDrawerOpen()) {
      this.closeMobileDrawer();
    } else {
      this.openMobileDrawer();
    }
  }

  openMobileDrawer() {
    chronexAudio.playChime('click');
    this.dom.hamburgerBtn?.classList.add('is-active');
    this.dom.hamburgerBtn?.setAttribute('aria-expanded', 'true');
    this.dom.mobileNavDrawer?.classList.add('is-open');
    this.dom.mobileNavDrawer?.setAttribute('aria-hidden', 'false');
    this.dom.mobileDrawerBackdrop?.classList.add('is-open');

    // Accessibility inert on main
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.inert = true;

    // Sync state indicators
    this.updateTimeFormatButtonState();
    this.updateAudioButtonState();
    this.updateNotificationButtonState();
  }

  closeMobileDrawer() {
    this.dom.hamburgerBtn?.classList.remove('is-active');
    this.dom.hamburgerBtn?.setAttribute('aria-expanded', 'false');
    this.dom.mobileNavDrawer?.classList.remove('is-open');
    this.dom.mobileNavDrawer?.setAttribute('aria-hidden', 'true');
    this.dom.mobileDrawerBackdrop?.classList.remove('is-open');

    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.inert = false;
  }

  // ==========================================================================
  // Backend Workload Sharing & Dashboard Polling Engine
  // ==========================================================================
  startDashboardPolling() {
    // Initial background sync of events
    StorageManager.syncWithServer().then((syncedEvents) => {
      if (syncedEvents && this.countdown) {
        this.countdown.loadEvents();
        this.countdown.render();
      }
    }).catch(() => {});

    // Periodic lightweight summary polling every 35 seconds
    setInterval(async () => {
      try {
        const apiResult = await dispatchApi('/api/dashboard-summary');
        if (apiResult.isJson && apiResult.ok) {
          if (this.dom.drawerBackendStatus) {
            this.dom.drawerBackendStatus.textContent = 'Backend Engine Active · Fast Mode';
          }
        }
      } catch (e) {
        if (this.dom.drawerBackendStatus) {
          this.dom.drawerBackendStatus.textContent = 'Offline / Local Terminal Mode';
        }
      }
    }, 35000);
  }
}

// Robust startup: works whether DOM is loading, interactive, or complete
async function launchChronex() {
  try {
    const app = new ChronexApp();
    await app.init();
    window.chronexApp = app;
    console.log('[Chronex] Application loaded and running');
  } catch (err) {
    console.error('[Chronex] Critical startup error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', launchChronex);
} else {
  // DOM is already parsed (modules are deferred by default)
  launchChronex();
}

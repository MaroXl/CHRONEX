/**
 * Chronex Main Application Orchestrator
 * Connects Clocks, Market Sessions, Countdown Timers, Storage, and PWA logic.
 */

import { ClockManager } from './clock.js?v=2.1.0';
import { sessionTracker } from './sessions.js?v=2.1.0';
import { CountdownManager } from './countdown.js?v=2.1.0';
import { CalendarManager } from './calendar.js?v=2.1.0';
import { StorageManager } from './storage.js?v=2.1.0';
import { chronexAudio } from './audio.js?v=2.1.0';

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
      toastContainer: document.getElementById('toast-container')
    };
  }

  init() {
    try {
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
          new Notification('Chronex Live Alerts Active', {
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
    if (this.dom.btnToggleFormat) {
      this.dom.btnToggleFormat.innerHTML = `
        <span class="btn-icon">⏱</span>
        <span>Format: ${this.clock.timeFormat}H</span>
      `;
    }
  }

  updateAudioButtonState() {
    if (this.dom.btnToggleAudio) {
      const isMuted = !chronexAudio.enabled;
      this.dom.btnToggleAudio.innerHTML = isMuted 
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg><span>Sound Off</span>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg><span>Sound On</span>`;
      
      this.dom.btnToggleAudio.classList.toggle('btn-muted', isMuted);
    }
  }

  updateNotificationButtonState() {
    if (this.dom.btnRequestNotifications && 'Notification' in window) {
      if (Notification.permission === 'granted') {
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
    });

    this.dom.btnInstallPwa?.addEventListener('click', async () => {
      if (!this.deferredInstallPrompt) return;
      this.deferredInstallPrompt.prompt();
      const { outcome } = await this.deferredInstallPrompt.userChoice;
      console.log(`[Chronex PWA] User install response: ${outcome}`);
      this.deferredInstallPrompt = null;
      this.dom.btnInstallPwa.classList.add('hidden');
    });

    window.addEventListener('appinstalled', () => {
      console.log('[Chronex PWA] Successfully installed!');
      this.showToast('Chronex installed as an app!', 'success');
      this.dom.btnInstallPwa?.classList.add('hidden');
    });

    // Check if running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      if (this.dom.btnInstallPwa) {
        this.dom.btnInstallPwa.classList.add('hidden');
      }
    }
  }
}

// Robust startup: works whether DOM is loading, interactive, or complete
function launchChronex() {
  try {
    const app = new ChronexApp();
    app.init();
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

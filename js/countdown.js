/**
 * Chronex Custom Event & News Release Countdown Engine
 * High-precision countdown timers, live status triggers, tagging, and filtering.
 */

import { StorageManager } from './storage.js?v=2.1.0';
import { chronexAudio } from './audio.js?v=2.1.0';

export class CountdownManager {
  constructor(options = {}) {
    this.container = options.container || null;
    this.events = [];
    this.filter = 'all';
    this.searchQuery = '';
    this.sortBy = 'soonest';
    this.onEdit = options.onEdit || null;
    this.onDelete = options.onDelete || null;
  }

  loadEvents() {
    this.events = StorageManager.getEvents();
    return this.events;
  }

  setFilter(filter) {
    this.filter = filter;
    this.render();
  }

  setSearch(query) {
    this.searchQuery = query.toLowerCase().trim();
    this.render();
  }

  setSort(sortBy) {
    this.sortBy = sortBy;
    this.render();
  }

  /**
   * Evaluates countdown values for a target timestamp
   */
  getCountdownData(targetDateIso, notified = false) {
    const target = new Date(targetDateIso).getTime();
    const now = Date.now();
    const diff = target - now;

    const isLive = diff <= 0 && diff > -1800000; // Live for 30 minutes after target
    const isPast = diff <= -1800000; // Past / Completed
    const isUrgent = diff > 0 && diff < 3600000; // < 1 hour
    const isImpending = diff >= 3600000 && diff < 86400000; // < 24 hours

    // Trigger chime once when event hits zero
    let shouldNotify = false;
    if (diff <= 0 && !notified && diff > -60000) {
      shouldNotify = true;
    }

    if (diff <= 0) {
      return {
        diff,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatted: '00d 00h 00m 00s',
        isLive,
        isPast,
        isUrgent: false,
        isImpending: false,
        shouldNotify
      };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formatted = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

    return {
      diff,
      days,
      hours,
      minutes,
      seconds,
      formatted,
      isLive: false,
      isPast: false,
      isUrgent,
      isImpending,
      shouldNotify
    };
  }

  /**
   * Filter and sort events
   */
  getFilteredEvents() {
    let list = [...this.events];

    // Search filter
    if (this.searchQuery) {
      list = list.filter(e => 
        e.title.toLowerCase().includes(this.searchQuery) ||
        (e.notes && e.notes.toLowerCase().includes(this.searchQuery)) ||
        e.category.toLowerCase().includes(this.searchQuery) ||
        e.impact.toLowerCase().includes(this.searchQuery)
      );
    }

    // Category / Impact Filter
    if (this.filter !== 'all') {
      if (['high', 'medium', 'low'].includes(this.filter)) {
        list = list.filter(e => e.impact === this.filter);
      } else if (['financial', 'academic', 'personal'].includes(this.filter)) {
        list = list.filter(e => e.category === this.filter);
      }
    }

    // Sort
    const now = Date.now();
    const impactWeights = { high: 3, medium: 2, low: 1 };

    list.sort((a, b) => {
      const timeA = new Date(a.targetDate).getTime();
      const timeB = new Date(b.targetDate).getTime();

      if (this.sortBy === 'soonest') {
        // Active/upcoming first, past events sink to bottom
        const diffA = timeA - now;
        const diffB = timeB - now;
        if (diffA >= -1800000 && diffB < -1800000) return -1;
        if (diffA < -1800000 && diffB >= -1800000) return 1;
        return timeA - timeB;
      } else if (this.sortBy === 'latest') {
        return timeB - timeA;
      } else if (this.sortBy === 'impact') {
        const weightA = impactWeights[a.impact] || 0;
        const weightB = impactWeights[b.impact] || 0;
        if (weightB !== weightA) return weightB - weightA;
        return timeA - timeB;
      }
      return timeA - timeB;
    });

    return list;
  }

  /**
   * Tick update: called every second to re-evaluate countdowns without rebuilding DOM if possible
   */
  tick() {
    let stateChanged = false;

    // Check notifications
    this.events.forEach(e => {
      const cd = this.getCountdownData(e.targetDate, e.notified);
      if (cd.shouldNotify && !e.notified) {
        e.notified = true;
        stateChanged = true;
        chronexAudio.playChime('release');
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`CHRONEX Alert: ${e.title}`, {
            body: `Event countdown reached zero! Impact: ${e.impact.toUpperCase()}`,
            icon: './assets/icons/icon-192.png'
          });
        }
      }

      // Update card digits directly in DOM
      const cardEl = document.getElementById(`event-card-${e.id}`);
      if (cardEl) {
        const daysEl = cardEl.querySelector('.cd-num-days');
        const hrsEl = cardEl.querySelector('.cd-num-hours');
        const minsEl = cardEl.querySelector('.cd-num-mins');
        const secsEl = cardEl.querySelector('.cd-num-secs');
        const statusBadge = cardEl.querySelector('.event-status-pill');

        if (daysEl) daysEl.textContent = String(cd.days).padStart(2, '0');
        if (hrsEl) hrsEl.textContent = String(cd.hours).padStart(2, '0');
        if (minsEl) minsEl.textContent = String(cd.minutes).padStart(2, '0');
        if (secsEl) secsEl.textContent = String(cd.seconds).padStart(2, '0');

        if (statusBadge) {
          if (cd.isLive) {
            statusBadge.className = 'event-status-pill pill-live';
            statusBadge.innerHTML = '<span class="pulse-live-dot"></span> LIVE NOW';
          } else if (cd.isPast) {
            statusBadge.className = 'event-status-pill pill-past';
            statusBadge.textContent = 'COMPLETED';
          } else if (cd.isUrgent) {
            statusBadge.className = 'event-status-pill pill-urgent';
            statusBadge.textContent = 'UNDER 1 HOUR';
          } else if (cd.isImpending) {
            statusBadge.className = 'event-status-pill pill-impending';
            statusBadge.textContent = 'WITHIN 24H';
          } else {
            statusBadge.className = 'event-status-pill pill-upcoming';
            statusBadge.textContent = 'UPCOMING';
          }
        }
      }
    });

    if (stateChanged) {
      StorageManager.saveEvents(this.events);
    }
  }

  /**
   * Full render of event cards
   */
  render() {
    if (!this.container) return;
    const filtered = this.getFilteredEvents();

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div class="empty-events-state">
          <div class="empty-icon">📅</div>
          <h3>No events match your criteria</h3>
          <p>Create a custom event countdown or restore standard economic presets.</p>
          <div class="empty-actions">
            <button class="btn btn-primary" id="btn-empty-add-event">
              <span class="btn-icon">+</span> Add New Event
            </button>
            <button class="btn btn-secondary" id="btn-empty-restore">
              Restore Preset Releases
            </button>
          </div>
        </div>
      `;

      // Attach button events
      document.getElementById('btn-empty-add-event')?.addEventListener('click', () => {
        document.getElementById('btn-open-add-modal')?.click();
      });
      document.getElementById('btn-empty-restore')?.addEventListener('click', () => {
        this.events = StorageManager.resetToPresets();
        this.render();
      });
      return;
    }

    this.container.innerHTML = filtered.map(e => {
      const cd = this.getCountdownData(e.targetDate, e.notified);
      const targetObj = new Date(e.targetDate);

      // Formatted date string in UTC and local
      const utcDateStr = targetObj.toUTCString().replace('GMT', 'UTC');
      const localDateStr = targetObj.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      // Impact badge
      const impactClass = `impact-${e.impact}`;
      const categoryClass = `cat-${e.category}`;

      let statusBadgeHtml = '';
      let cardGlowClass = '';

      if (cd.isLive) {
        statusBadgeHtml = '<span class="event-status-pill pill-live"><span class="pulse-live-dot"></span> LIVE NOW</span>';
        cardGlowClass = 'event-card-live';
      } else if (cd.isPast) {
        statusBadgeHtml = '<span class="event-status-pill pill-past">COMPLETED</span>';
        cardGlowClass = 'event-card-past';
      } else if (cd.isUrgent) {
        statusBadgeHtml = '<span class="event-status-pill pill-urgent">UNDER 1 HOUR</span>';
        cardGlowClass = 'event-card-urgent';
      } else if (cd.isImpending) {
        statusBadgeHtml = '<span class="event-status-pill pill-impending">WITHIN 24H</span>';
      } else {
        statusBadgeHtml = '<span class="event-status-pill pill-upcoming">UPCOMING</span>';
      }

      return `
        <article class="event-card ${cardGlowClass}" id="event-card-${e.id}" data-id="${e.id}">
          <header class="event-card-top">
            <div class="event-tags-row">
              <span class="tag-badge ${impactClass}">${e.impact.toUpperCase()} IMPACT</span>
              <span class="tag-badge ${categoryClass}">${e.category.toUpperCase()}</span>
              ${statusBadgeHtml}
            </div>

            <div class="event-card-menu">
              <button class="btn-icon-ghost btn-duplicate-event" data-id="${e.id}" title="Duplicate Event" aria-label="Duplicate">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button class="btn-icon-ghost btn-edit-event" data-id="${e.id}" title="Edit Event" aria-label="Edit">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </button>
              <button class="btn-icon-ghost btn-delete-event" data-id="${e.id}" title="Delete Event" aria-label="Delete">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </header>

          <h3 class="event-title">${escapeHtml(e.title)}</h3>
          ${e.notes ? `<p class="event-notes">${escapeHtml(e.notes)}</p>` : ''}

          <!-- Countdown Timer Display -->
          <div class="event-countdown-display">
            <div class="cd-slot">
              <span class="cd-num cd-num-days mono">${String(cd.days).padStart(2, '0')}</span>
              <span class="cd-unit">DAYS</span>
            </div>
            <span class="cd-divider">:</span>
            <div class="cd-slot">
              <span class="cd-num cd-num-hours mono">${String(cd.hours).padStart(2, '0')}</span>
              <span class="cd-unit">HOURS</span>
            </div>
            <span class="cd-divider">:</span>
            <div class="cd-slot">
              <span class="cd-num cd-num-mins mono">${String(cd.minutes).padStart(2, '0')}</span>
              <span class="cd-unit">MINS</span>
            </div>
            <span class="cd-divider">:</span>
            <div class="cd-slot">
              <span class="cd-num cd-num-secs mono">${String(cd.seconds).padStart(2, '0')}</span>
              <span class="cd-unit">SECS</span>
            </div>
          </div>

          <footer class="event-card-footer">
            <div class="event-time-meta">
              <span class="meta-label">TARGET TIME</span>
              <span class="meta-val mono">${localDateStr}</span>
            </div>
            <div class="event-time-meta text-right">
              <span class="meta-label">UTC EQUIVALENT</span>
              <span class="meta-val mono">${formatShortUtc(targetObj)}</span>
            </div>
          </footer>
        </article>
      `;
    }).join('');

    this.attachEventListeners();
  }

  attachEventListeners() {
    this.container.querySelectorAll('.btn-edit-event').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const ev = this.events.find(x => x.id === id);
        if (ev && typeof this.onEdit === 'function') {
          this.onEdit(ev);
        }
      });
    });

    this.container.querySelectorAll('.btn-duplicate-event').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const ev = this.events.find(x => x.id === id);
        if (ev) {
          const duplicate = {
            ...ev,
            title: `${ev.title} (Copy)`,
            notified: false
          };
          delete duplicate.id;
          StorageManager.addEvent(duplicate);
          this.loadEvents();
          this.render();
          chronexAudio.playChime('click');
        }
      });
    });

    this.container.querySelectorAll('.btn-delete-event').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this countdown event?')) {
          this.events = StorageManager.deleteEvent(id);
          this.render();
          chronexAudio.playChime('click');
          if (typeof this.onDelete === 'function') {
            this.onDelete(id);
          }
        }
      });
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatShortUtc(date) {
  const d = date.getUTCDate().toString().padStart(2, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const h = date.getUTCHours().toString().padStart(2, '0');
  const min = date.getUTCMinutes().toString().padStart(2, '0');
  return `${d}/${m} ${h}:${min} UTC`;
}

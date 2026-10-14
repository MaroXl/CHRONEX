/**
 * Chronex Live Economic Calendar Engine
 * High-performance backend workload sharing, real-time query filtering,
 * zero-lag DOM updates, and 1-click "Pin to Countdowns" synchronization.
 */

import { StorageManager } from './storage.js?v=2.5.0';
import { chronexAudio } from './audio.js?v=2.5.0';
import { dispatchApi } from './auth.js?v=2.5.0';

const CALENDAR_CACHE_KEY = 'chronex_live_calendar_cache_v2';

export class CalendarManager {
  constructor(options = {}) {
    this.container = options.container || null;
    this.statusEl = options.statusEl || null;
    this.events = [];
    this.lastFetched = null;
    this.activeCurrency = 'all';
    this.activeImpact = 'all';
    this.searchQuery = '';
    this.isLoading = false;
    this.onEventPinned = options.onEventPinned || null;
    this.lastTickBucket = -1;
    this.searchDebounceTimer = null;
  }

  async init() {
    // 1. Instant render from local cache
    this.loadCache();
    this.render();

    // 2. Fetch fresh pre-processed data from backend
    await this.fetchLiveEvents();
  }

  loadCache() {
    try {
      const cached = localStorage.getItem(CALENDAR_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.events = parsed.events || [];
        this.lastFetched = parsed.timestamp ? new Date(parsed.timestamp) : null;
      }
    } catch (e) {
      console.warn('Failed to parse calendar cache:', e);
    }
  }

  saveCache(events) {
    try {
      const payload = {
        timestamp: Date.now(),
        events
      };
      localStorage.setItem(CALENDAR_CACHE_KEY, JSON.stringify(payload));
      this.lastFetched = new Date();
    } catch (e) {
      console.warn('Failed to save calendar cache:', e);
    }
  }

  async fetchLiveEvents() {
    this.setLoading(true);
    let eventsLoaded = false;

    // 1. High-Performance Backend API (handles ingestion, normalization, filtering)
    try {
      const queryParams = new URLSearchParams({
        currency: this.activeCurrency,
        impact: this.activeImpact,
        search: this.searchQuery,
        limit: '100'
      });

      const apiResult = await dispatchApi(`/api/calendar?${queryParams.toString()}`);
      if (apiResult.isJson && apiResult.ok && apiResult.data && Array.isArray(apiResult.data.events)) {
        this.events = apiResult.data.events;
        this.saveCache(this.events);
        eventsLoaded = true;
        this.setLoading(false, true);
        this.render();
        return;
      }
    } catch (e) {
      console.log('[Calendar Engine] Local server proxy error, checking fallback...');
    }

    // 2. Direct Fallback if backend proxy is temporarily unreachable
    if (!eventsLoaded) {
      try {
        const directRes = await fetch('https://www.financecalendar.com/wp-json/fc/v1/calendar');
        if (directRes.ok) {
          const json = await directRes.json();
          const rawEvents = json.events || (Array.isArray(json) ? json : null);
          if (rawEvents) {
            this.events = this.normalizeEvents(rawEvents);
            this.saveCache(this.events);
            eventsLoaded = true;
          }
        }
      } catch (e) {
        console.warn('Direct fetch failed, falling back to cache:', e.message);
      }
    }

    this.setLoading(false, eventsLoaded);
    this.render();
  }

  normalizeEvents(rawList) {
    return rawList.map((item, idx) => {
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

      return {
        id: `cal_${item.date || 'd'}_${idx}`,
        title: name,
        fullTitle: title,
        targetDate: dateIso,
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

  setLoading(isLoading, isSuccess = true) {
    this.isLoading = isLoading;
    if (this.statusEl) {
      if (isLoading) {
        this.statusEl.innerHTML = `<span class="spinner-sm"></span> Syncing Feed...`;
      } else if (isSuccess && this.lastFetched) {
        const timeStr = this.lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.statusEl.innerHTML = `<span class="live-dot-green"></span> Synced at ${timeStr} · Fast Server`;
      } else {
        this.statusEl.textContent = 'Offline / Cached';
      }
    }
  }

  setCurrencyFilter(cur) {
    this.activeCurrency = cur;
    // Re-fetch or re-filter from server
    this.fetchLiveEvents();
  }

  setImpactFilter(impact) {
    this.activeImpact = impact;
    this.fetchLiveEvents();
  }

  setSearch(query) {
    this.searchQuery = query.toLowerCase().trim();
    // Debounce to prevent lag during fast typing
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.fetchLiveEvents();
    }, 180);
  }

  getFilteredEvents() {
    return this.events.filter(e => {
      if (this.activeCurrency !== 'all' && e.currency !== this.activeCurrency) {
        return false;
      }
      if (this.activeImpact !== 'all' && e.impact !== this.activeImpact) {
        return false;
      }
      if (this.searchQuery) {
        const text = `${e.title} ${e.fullTitle} ${e.currency}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }
      return true;
    });
  }

  /**
   * Zero-lag tick: updates time remaining badges at 30s bucket resolution
   * avoids layout thrashing and prevents DOM innerHTML reconstruction
   */
  tick() {
    if (!this.container) return;
    const now = Date.now();
    const currentBucket = Math.floor(now / 30000); // 30s bucket

    // Only run DOM scan if bucket changed
    if (currentBucket === this.lastTickBucket) return;
    this.lastTickBucket = currentBucket;

    const rows = this.container.querySelectorAll('.calendar-event-row');
    if (rows.length === 0) return;

    rows.forEach(row => {
      const id = row.getAttribute('data-id');
      const ev = this.events.find(e => e.id === id);
      if (!ev) return;

      const diff = new Date(ev.targetDate).getTime() - now;
      const badgeContainer = row.querySelector('.cal-col-countdown');
      if (!badgeContainer) return;

      let badgeHtml = '';
      if (diff <= 0 && diff > -1800000) {
        badgeHtml = '<span class="cal-badge-live">LIVE NOW</span>';
      } else if (diff <= -1800000) {
        badgeHtml = '<span class="cal-badge-past">COMPLETED</span>';
      } else {
        const totalSecs = Math.floor(diff / 1000);
        const days = Math.floor(totalSecs / 86400);
        const hours = Math.floor((totalSecs % 86400) / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);

        const timeStr = days > 0 ? `in ${days}d ${hours}h` : (hours > 0 ? `in ${hours}h ${mins}m` : `in ${mins}m`);
        const isUrgent = diff < 3600000;
        badgeHtml = `<span class="cal-badge-countdown mono ${isUrgent ? 'urgent' : ''}">${timeStr}</span>`;
      }

      if (badgeContainer.innerHTML !== badgeHtml) {
        badgeContainer.innerHTML = badgeHtml;
      }
    });
  }

  render() {
    if (!this.container) return;

    const filtered = this.getFilteredEvents();

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div class="calendar-empty-state">
          <p>No economic releases found matching your active filters.</p>
          <button class="btn btn-secondary btn-sm" id="btn-reset-cal-filters">Reset Filters</button>
        </div>
      `;
      document.getElementById('btn-reset-cal-filters')?.addEventListener('click', () => {
        this.setCurrencyFilter('all');
        this.setImpactFilter('all');
        this.setSearch('');
      });
      return;
    }

    const pinnedEventTitles = new Set(StorageManager.getEvents().map(e => e.title.toLowerCase()));

    const rowsHtml = filtered.map(ev => {
      const d = new Date(ev.targetDate);
      const now = Date.now();
      const diff = d.getTime() - now;

      let countdownBadge = '';
      if (diff <= 0 && diff > -1800000) {
        countdownBadge = '<span class="cal-badge-live">LIVE NOW</span>';
      } else if (diff <= -1800000) {
        countdownBadge = '<span class="cal-badge-past">COMPLETED</span>';
      } else {
        const totalSecs = Math.floor(diff / 1000);
        const days = Math.floor(totalSecs / 86400);
        const hours = Math.floor((totalSecs % 86400) / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);

        let timeStr = '';
        if (days > 0) {
          timeStr = `in ${days}d ${hours}h`;
        } else if (hours > 0) {
          timeStr = `in ${hours}h ${mins}m`;
        } else {
          timeStr = `in ${mins}m`;
        }

        const isUrgent = diff < 3600000;
        countdownBadge = `<span class="cal-badge-countdown mono ${isUrgent ? 'urgent' : ''}">${timeStr}</span>`;
      }

      const localTimeStr = d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const isPinned = pinnedEventTitles.has(ev.title.toLowerCase()) || pinnedEventTitles.has(`[${ev.currency}] ${ev.title}`.toLowerCase());

      return `
        <div class="calendar-event-row" data-id="${ev.id}">
          <div class="cal-col-time">
            <span class="cal-date-label">${localTimeStr}</span>
            <span class="cal-utc-label mono">${d.toISOString().slice(11, 16)} UTC</span>
          </div>

          <div class="cal-col-currency">
            <span class="cal-flag" aria-hidden="true">${ev.flag}</span>
            <span class="cal-cur-code">${ev.currency}</span>
          </div>

          <div class="cal-col-impact">
            <span class="cal-impact-dot impact-${ev.impact}" title="${ev.impact.toUpperCase()} Impact"></span>
          </div>

          <div class="cal-col-title">
            <span class="cal-event-title">${escapeHtml(ev.title)}</span>
            ${ev.fullTitle && ev.fullTitle !== ev.title ? `<span class="cal-event-subtitle">${escapeHtml(ev.fullTitle)}</span>` : ''}
          </div>

          <div class="cal-col-metrics">
            <div class="metric-box">
              <span class="metric-lbl">Prior</span>
              <span class="metric-val mono">${ev.prior ? escapeHtml(ev.prior) : '—'}</span>
            </div>
            <div class="metric-box">
              <span class="metric-lbl">Forecast</span>
              <span class="metric-val mono">${ev.consensus ? escapeHtml(ev.consensus) : '—'}</span>
            </div>
          </div>

          <div class="cal-col-countdown">
            ${countdownBadge}
          </div>

          <div class="cal-col-action">
            <button class="btn btn-sm ${isPinned ? 'btn-pinned' : 'btn-pin'}" 
                    data-title="${escapeHtml(ev.title)}" 
                    data-date="${ev.targetDate}" 
                    data-impact="${ev.impact}" 
                    data-currency="${ev.currency}"
                    ${isPinned ? 'disabled' : ''}>
              ${isPinned ? '✓ Tracked' : '+ Track'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = rowsHtml;
    this.attachPinHandlers();
  }

  attachPinHandlers() {
    this.container.querySelectorAll('.btn-pin').forEach(btn => {
      btn.addEventListener('click', () => {
        const title = btn.getAttribute('data-title');
        const targetDate = btn.getAttribute('data-date');
        const impact = btn.getAttribute('data-impact');
        const currency = btn.getAttribute('data-currency');

        StorageManager.addEvent({
          title: `[${currency}] ${title}`,
          targetDate,
          impact,
          category: 'financial',
          notes: `Tracked from Live Economic Calendar feed.`
        });

        chronexAudio.playChime('click');
        btn.classList.remove('btn-pin');
        btn.classList.add('btn-pinned');
        btn.textContent = '✓ Tracked';
        btn.disabled = true;

        if (typeof this.onEventPinned === 'function') {
          this.onEventPinned(title);
        }
      });
    });
  }

  syncAllHighImpact() {
    const highEvents = this.events.filter(e => e.impact === 'high');
    if (highEvents.length === 0) return 0;

    let addedCount = 0;
    const existingTitles = new Set(StorageManager.getEvents().map(e => e.title.toLowerCase()));

    highEvents.forEach(ev => {
      const fullTitle = `[${ev.currency}] ${ev.title}`;
      if (!existingTitles.has(fullTitle.toLowerCase())) {
        StorageManager.addEvent({
          title: fullTitle,
          targetDate: ev.targetDate,
          impact: 'high',
          category: 'financial',
          notes: `Imported from Live Economic Calendar.`
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      chronexAudio.playChime('click');
      this.render();
      if (typeof this.onEventPinned === 'function') {
        this.onEventPinned(`Synced ${addedCount} high-impact releases`);
      }
    }
    return addedCount;
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

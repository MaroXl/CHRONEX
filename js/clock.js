/**
 * Chronex Live Clock System
 * Dual UTC & Local time synchronization with 12/24h toggle and major city timezones.
 */

export class ClockManager {
  constructor(options = {}) {
    this.timeFormat = options.timeFormat || '24'; // '24' or '12'
    this.onTick = options.onTick || null;
    this.timerId = null;

    // Detect user timezone
    this.detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    this.tzOffsetMinutes = -new Date().getTimezoneOffset();
  }

  setTimeFormat(format) {
    this.timeFormat = format === '12' ? '12' : '24';
    this.update();
  }

  toggleTimeFormat() {
    this.setTimeFormat(this.timeFormat === '24' ? '12' : '24');
    return this.timeFormat;
  }

  start() {
    this.update();
    // Align with second tick
    const now = Date.now();
    const delay = 1000 - (now % 1000);
    setTimeout(() => {
      this.update();
      this.timerId = setInterval(() => this.update(), 1000);
    }, delay);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  formatTime(date, timeZone = 'UTC', includeSeconds = true) {
    const is12Hour = this.timeFormat === '12';
    try {
      const options = {
        timeZone,
        hour: is12Hour ? 'numeric' : '2-digit',
        minute: '2-digit',
        hour12: is12Hour
      };
      if (includeSeconds) {
        options.second = '2-digit';
      }
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (e) {
      // Fallback
      if (timeZone === 'UTC') {
        const h = String(date.getUTCHours()).padStart(2, '0');
        const m = String(date.getUTCMinutes()).padStart(2, '0');
        const s = String(date.getUTCSeconds()).padStart(2, '0');
        return `${h}:${m}:${s}`;
      }
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
  }

  formatDate(date, timeZone = 'UTC') {
    const options = {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    };
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }

  getTimezoneLabel() {
    // e.g. "UTC+1" or "UTC-5"
    const sign = this.tzOffsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(this.tzOffsetMinutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const formattedOffset = mins > 0 
      ? `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`
      : `UTC${sign}${hours}`;

    const city = this.detectedTz.split('/').pop()?.replace(/_/g, ' ') || 'Local';
    return `${city} (${formattedOffset})`;
  }

  update() {
    const now = new Date();

    // UTC Info
    const utcTimeStr = this.formatTime(now, 'UTC', true);
    const utcDateStr = this.formatDate(now, 'UTC');

    // Local Info
    const localTimeStr = this.formatTime(now, this.detectedTz, true);
    const localDateStr = this.formatDate(now, this.detectedTz);
    const localTzStr = this.getTimezoneLabel();

    // City Times
    const cityTimes = {
      sydney: this.formatTime(now, 'Australia/Sydney', false),
      tokyo: this.formatTime(now, 'Asia/Tokyo', false),
      london: this.formatTime(now, 'Europe/London', false),
      newYork: this.formatTime(now, 'America/New_York', false)
    };

    // DOM Updates if present
    const elUtcTime = document.getElementById('utc-live-time');
    const elUtcDate = document.getElementById('utc-live-date');
    const elLocalTime = document.getElementById('local-live-time');
    const elLocalDate = document.getElementById('local-live-date');
    const elLocalTz = document.getElementById('local-tz-label');

    if (elUtcTime) elUtcTime.textContent = utcTimeStr;
    if (elUtcDate) elUtcDate.textContent = utcDateStr;
    if (elLocalTime) elLocalTime.textContent = localTimeStr;
    if (elLocalDate) elLocalDate.textContent = localDateStr;
    if (elLocalTz) elLocalTz.textContent = localTzStr;

    // Mini city indicators
    for (const [city, timeVal] of Object.entries(cityTimes)) {
      const elCity = document.getElementById(`city-time-${city}`);
      if (elCity) elCity.textContent = timeVal;
    }

    if (typeof this.onTick === 'function') {
      this.onTick({
        now,
        utcTimeStr,
        utcDateStr,
        localTimeStr,
        localDateStr,
        cityTimes
      });
    }
  }
}

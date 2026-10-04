/**
 * Chronex Storage Management
 * Handles custom events, user preferences, presets, and JSON backup/restore.
 */

const STORAGE_KEYS = {
  EVENTS: 'chronex_events_v1',
  SETTINGS: 'chronex_settings_v1'
};

const DEFAULT_SETTINGS = {
  timeFormat: '24', // '24' or '12'
  soundEnabled: true,
  notificationsEnabled: false,
  activeFilter: 'all',
  sortBy: 'soonest'
};

/**
 * Creates dynamic realistic starter events relative to now
 */
function createDefaultPresets() {
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
      targetDate: getNextUtcTime(13, 30).toISOString(),
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
      id: 'preset-academic-deadline',
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

/**
 * Computes next occurrence of a given UTC hour/minute today or tomorrow
 */
function getNextUtcTime(utcHour, utcMinute) {
  const d = new Date();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), utcHour, utcMinute, 0, 0));
  if (target.getTime() <= d.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}

export class StorageManager {
  static getEvents() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!data) {
        const presets = createDefaultPresets();
        this.saveEvents(presets);
        return presets;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Error loading events:', e);
      return createDefaultPresets();
    }
  }

  static saveEvents(events) {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
      return true;
    } catch (e) {
      console.error('Error saving events:', e);
      return false;
    }
  }

  static addEvent(eventData) {
    const events = this.getEvents();
    const newEvent = {
      id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: eventData.title.trim(),
      targetDate: new Date(eventData.targetDate).toISOString(),
      impact: eventData.impact || 'medium',
      category: eventData.category || 'financial',
      notes: (eventData.notes || '').trim(),
      notified: false,
      createdAt: Date.now()
    };
    events.push(newEvent);
    this.saveEvents(events);
    return newEvent;
  }

  static updateEvent(id, updatedFields) {
    const events = this.getEvents();
    const index = events.findIndex(e => e.id === id);
    if (index === -1) return null;

    events[index] = {
      ...events[index],
      ...updatedFields,
      targetDate: updatedFields.targetDate ? new Date(updatedFields.targetDate).toISOString() : events[index].targetDate
    };
    this.saveEvents(events);
    return events[index];
  }

  static deleteEvent(id) {
    let events = this.getEvents();
    events = events.filter(e => e.id !== id);
    this.saveEvents(events);
    return events;
  }

  static resetToPresets() {
    const presets = createDefaultPresets();
    this.saveEvents(presets);
    return presets;
  }

  static getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) {
        this.saveSettings(DEFAULT_SETTINGS);
        return { ...DEFAULT_SETTINGS };
      }
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error saving settings:', e);
      return DEFAULT_SETTINGS;
    }
  }

  static exportBackup() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      events: this.getEvents(),
      settings: this.getSettings()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronex-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static importBackup(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && Array.isArray(parsed.events)) {
        this.saveEvents(parsed.events);
        if (parsed.settings) {
          this.saveSettings(parsed.settings);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import parse error:', e);
      return false;
    }
  }
}

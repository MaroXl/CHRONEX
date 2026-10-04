/**
 * Chronex Market Sessions Logic
 * Real-time calculation of Sydney, Tokyo, London, and New York trading sessions,
 * wrap-around midnight handling, overlap windows, and 24-hour timeline rendering.
 */

export const SESSIONS_CONFIG = [
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
    color: '#06B6D4', // Cyan accent
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
    color: '#8B5CF6', // Purple accent
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
    color: '#3B82F6', // Blue accent
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
    color: '#EC4899', // Pink accent
    currency: 'USD / CAD'
  }
];

export class SessionTracker {
  constructor() {
    this.sessions = SESSIONS_CONFIG;
  }

  /**
   * Returns current time converted into continuous UTC minutes [0, 1440)
   */
  getCurrentUtcMinutes(now = new Date()) {
    return now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  }

  /**
   * Check if a session is currently active
   */
  isSessionOpen(session, utcMinutes) {
    if (session.crossesMidnight) {
      return utcMinutes >= session.openMinutes || utcMinutes < session.closeMinutes;
    }
    return utcMinutes >= session.openMinutes && utcMinutes < session.closeMinutes;
  }

  /**
   * Determine overlap state for active sessions
   */
  getActiveOverlaps(utcMinutes) {
    // London & New York Overlap: 13:30 - 16:30 UTC (810 to 990 mins)
    const isLondonNyOverlap = utcMinutes >= 810 && utcMinutes < 990;

    // Tokyo & Sydney Overlap: 00:00 - 07:00 UTC (0 to 420 mins)
    const isTokyoSydneyOverlap = utcMinutes >= 0 && utcMinutes < 420;

    // Tokyo & London Overlap: 08:00 - 09:00 UTC (480 to 540 mins)
    const isTokyoLondonOverlap = utcMinutes >= 480 && utcMinutes < 540;

    return {
      londonNewYork: isLondonNyOverlap,
      tokyoSydney: isTokyoSydneyOverlap,
      tokyoLondon: isTokyoLondonOverlap,
      any: isLondonNyOverlap || isTokyoSydneyOverlap || isTokyoLondonOverlap
    };
  }

  /**
   * Computes detailed state for a single session
   */
  getSessionState(session, now = new Date()) {
    const utcMinutes = this.getCurrentUtcMinutes(now);
    const isOpen = this.isSessionOpen(session, utcMinutes);
    const overlaps = this.getActiveOverlaps(utcMinutes);

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

    // Status: OVERLAP, OPEN, or CLOSED
    const status = isOverlap ? 'OVERLAP' : (isOpen ? 'OPEN' : 'CLOSED');

    // Progress and Countdown calculations
    let progressPercent = 0;
    let countdownMinutes = 0;
    let countdownLabel = '';

    if (isOpen) {
      // Calculate elapsed minutes
      let elapsedMinutes = 0;
      if (session.crossesMidnight) {
        if (utcMinutes >= session.openMinutes) {
          elapsedMinutes = utcMinutes - session.openMinutes;
        } else {
          elapsedMinutes = (1440 - session.openMinutes) + utcMinutes;
        }
      } else {
        elapsedMinutes = utcMinutes - session.openMinutes;
      }

      progressPercent = Math.min(100, Math.max(0, (elapsedMinutes / session.durationMinutes) * 100));

      // Minutes until close
      if (session.crossesMidnight) {
        if (utcMinutes >= session.openMinutes) {
          countdownMinutes = (1440 - utcMinutes) + session.closeMinutes;
        } else {
          countdownMinutes = session.closeMinutes - utcMinutes;
        }
      } else {
        countdownMinutes = session.closeMinutes - utcMinutes;
      }
      countdownLabel = 'Closes in';
    } else {
      // Closed: Calculate time until next open
      let minsUntilOpen = 0;
      if (session.crossesMidnight) {
        // Sydney is closed between closeMinutes (420) and openMinutes (1320)
        minsUntilOpen = session.openMinutes - utcMinutes;
      } else {
        if (utcMinutes < session.openMinutes) {
          minsUntilOpen = session.openMinutes - utcMinutes;
        } else {
          // It opens tomorrow
          minsUntilOpen = (1440 - utcMinutes) + session.openMinutes;
        }
      }

      countdownMinutes = minsUntilOpen;
      countdownLabel = 'Opens in';

      // Closed progress: how far through the closed downtime we are
      const downtimeMinutes = 1440 - session.durationMinutes;
      let closedElapsed = 0;
      if (session.crossesMidnight) {
        closedElapsed = utcMinutes - session.closeMinutes;
      } else {
        if (utcMinutes >= session.closeMinutes) {
          closedElapsed = utcMinutes - session.closeMinutes;
        } else {
          closedElapsed = (1440 - session.closeMinutes) + utcMinutes;
        }
      }
      progressPercent = Math.min(100, Math.max(0, (closedElapsed / downtimeMinutes) * 100));
    }

    // Convert countdownMinutes to HH:MM:SS
    const totalSecs = Math.max(0, Math.floor(countdownMinutes * 60));
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = Math.floor(totalSecs % 60);
    const countdownStr = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;

    return {
      ...session,
      isOpen,
      isOverlap,
      overlapTitle,
      status,
      progressPercent,
      countdownLabel,
      countdownStr,
      rawCountdownSeconds: totalSecs
    };
  }

  /**
   * Get all sessions evaluated
   */
  getAllSessionStates(now = new Date()) {
    const states = this.sessions.map(s => this.getSessionState(s, now));
    const utcMinutes = this.getCurrentUtcMinutes(now);
    const overlaps = this.getActiveOverlaps(utcMinutes);

    return {
      sessions: states,
      overlaps,
      currentUtcMinutes: utcMinutes,
      utcPercent: (utcMinutes / 1440) * 100
    };
  }

  /**
   * Renders the 24h visual timeline master bar and session cards into DOM
   */
  /**
   * Renders the 24h visual timeline master bar and session cards into DOM
   */
  render(containerCards, containerTimeline, bannerOverlap, now = new Date()) {
    const data = this.getAllSessionStates(now);

    // Update Overlap Banner
    if (bannerOverlap) {
      let desiredHtml = '';
      let isVisible = false;

      if (data.overlaps.londonNewYork) {
        desiredHtml = `
          <div class="overlap-banner-inner active-london-ny">
            <div class="overlap-pill">
              <span class="pulse-amber-dot"></span>
              <strong>ACTIVE OVERLAP:</strong> London + New York Window (13:30 – 16:30 UTC)
            </div>
            <div class="overlap-desc">Peak Daily Market Liquidity & Maximum Forex / Index Volatility</div>
          </div>
        `;
        isVisible = true;
      } else if (data.overlaps.tokyoSydney) {
        desiredHtml = `
          <div class="overlap-banner-inner active-asian">
            <div class="overlap-pill">
              <span class="pulse-cyan-dot"></span>
              <strong>ACTIVE OVERLAP:</strong> Sydney + Tokyo Window (00:00 – 07:00 UTC)
            </div>
            <div class="overlap-desc">Asian Trading Session Overlap — Primary JPY & AUD/NZD Liquidity</div>
          </div>
        `;
        isVisible = true;
      } else if (data.overlaps.tokyoLondon) {
        desiredHtml = `
          <div class="overlap-banner-inner active-eur-asia">
            <div class="overlap-pill">
              <span class="pulse-purple-dot"></span>
              <strong>ACTIVE OVERLAP:</strong> Tokyo + London Handover (08:00 – 09:00 UTC)
            </div>
            <div class="overlap-desc">Early European Open / Asian Close Transition</div>
          </div>
        `;
        isVisible = true;
      }

      if (isVisible) {
        if (bannerOverlap.innerHTML !== desiredHtml) {
          bannerOverlap.innerHTML = desiredHtml;
        }
        bannerOverlap.classList.remove('hidden');
      } else {
        bannerOverlap.classList.add('hidden');
      }
    }

    // Render or Update Session Cards
    if (containerCards) {
      const existingCards = containerCards.querySelectorAll('.session-card');
      if (existingCards.length === data.sessions.length) {
        // Fast in-place DOM updates (no innerHTML destruction)
        data.sessions.forEach(s => {
          const card = containerCards.querySelector(`[data-session="${s.id}"]`);
          if (!card) return;

          let statusBadgeClass = 'status-closed';
          let glowClass = '';
          let badgeLabel = 'CLOSED';

          if (s.isOverlap) {
            statusBadgeClass = 'status-overlap';
            glowClass = 'card-glow-overlap';
            badgeLabel = s.overlapTitle || 'OVERLAP';
          } else if (s.isOpen) {
            statusBadgeClass = 'status-open';
            glowClass = 'card-glow-open';
            badgeLabel = 'OPEN';
          }

          card.className = `session-card ${glowClass}`;

          const statusBadge = card.querySelector('.status-badge');
          if (statusBadge) {
            statusBadge.className = `status-badge ${statusBadgeClass}`;
            const textSpan = statusBadge.querySelector('span:last-child');
            if (textSpan) textSpan.textContent = badgeLabel;
          }

          const progressLabel = card.querySelector('.progress-label');
          if (progressLabel) progressLabel.textContent = s.isOpen ? 'Session Elapsed' : 'Cycle to Open';

          const progressPct = card.querySelector('.progress-pct');
          if (progressPct) progressPct.textContent = `${s.progressPercent.toFixed(1)}%`;

          const barFill = card.querySelector('.session-progress-bar-fill');
          if (barFill) {
            const barFillClass = s.isOverlap ? 'bar-overlap' : (s.isOpen ? 'bar-open' : 'bar-closed');
            barFill.className = `session-progress-bar-fill ${barFillClass}`;
            barFill.style.width = `${s.progressPercent.toFixed(1)}%`;
          }

          const countdownContext = card.querySelector('.countdown-context');
          if (countdownContext) countdownContext.textContent = s.countdownLabel;

          const countdownTime = card.querySelector('.countdown-time');
          if (countdownTime) countdownTime.textContent = s.countdownStr;
        });
      } else {
        // Initial Full Render
        containerCards.innerHTML = data.sessions.map(s => {
          let statusBadgeClass = 'status-closed';
          let glowClass = '';
          let badgeLabel = 'CLOSED';

          if (s.isOverlap) {
            statusBadgeClass = 'status-overlap';
            glowClass = 'card-glow-overlap';
            badgeLabel = s.overlapTitle || 'OVERLAP';
          } else if (s.isOpen) {
            statusBadgeClass = 'status-open';
            glowClass = 'card-glow-open';
            badgeLabel = 'OPEN';
          }

          const barFillClass = s.isOverlap ? 'bar-overlap' : (s.isOpen ? 'bar-open' : 'bar-closed');

          return `
            <article class="session-card ${glowClass}" data-session="${s.id}">
              <header class="session-card-header">
                <div class="session-identity">
                  <span class="session-flag" aria-hidden="true">${s.flag}</span>
                  <div>
                    <h3 class="session-name">${s.name}</h3>
                    <span class="session-market">${s.market} · ${s.currency}</span>
                  </div>
                </div>
                <div class="status-badge ${statusBadgeClass}">
                  <span class="status-dot"></span>
                  <span>${badgeLabel}</span>
                </div>
              </header>

              <div class="session-hours-grid">
                <div class="hours-block">
                  <span class="hours-label">HOURS (UTC)</span>
                  <span class="hours-val mono">${s.openUtc} – ${s.closeUtc}</span>
                </div>
                <div class="hours-block text-right">
                  <span class="hours-label">LOCAL CITY TIME</span>
                  <span class="hours-val mono" id="card-city-${s.id}">--:--</span>
                </div>
              </div>

              <div class="session-progress-wrapper">
                <div class="session-progress-header">
                  <span class="progress-label">${s.isOpen ? 'Session Elapsed' : 'Cycle to Open'}</span>
                  <span class="progress-pct mono">${s.progressPercent.toFixed(1)}%</span>
                </div>
                <div class="session-progress-bar-track">
                  <div class="session-progress-bar-fill ${barFillClass}" style="width: ${s.progressPercent.toFixed(1)}%;"></div>
                </div>
              </div>

              <footer class="session-card-footer">
                <span class="countdown-context">${s.countdownLabel}</span>
                <span class="countdown-time mono">${s.countdownStr}</span>
              </footer>
            </article>
          `;
        }).join('');
      }
    }

    // Render Master 24h Timeline
    if (containerTimeline) {
      this.renderMasterTimeline(containerTimeline, data);
    }
  }

  /**
   * Renders the high-precision 24-hour master timeline visualization
   */
  renderMasterTimeline(container, data) {
    const { currentUtcMinutes, utcPercent } = data;
    const curHour = Math.floor(currentUtcMinutes / 60).toString().padStart(2, '0');
    const curMin = Math.floor(currentUtcMinutes % 60).toString().padStart(2, '0');

    // If needle already exists, perform instant CSS transform update
    const needle = container.querySelector('.timeline-current-needle');
    if (needle) {
      needle.style.left = `${utcPercent.toFixed(2)}%`;
      const timeSpan = needle.querySelector('.needle-time');
      if (timeSpan) timeSpan.textContent = `${curHour}:${curMin} UTC`;
      return;
    }

    // Initial Full Render
    const getPosPct = (mins) => ((mins / 1440) * 100).toFixed(2);

    let labelsHtml = data.sessions.map(s => `
      <div class="timeline-session-label">
        <span class="row-flag">${s.flag}</span>
        <span class="row-name">${s.name}</span>
      </div>
    `).join('');

    let tracksHtml = data.sessions.map(s => {
      let segmentsHtml = '';
      if (s.crossesMidnight) {
        const seg1Left = getPosPct(s.openMinutes);
        const seg1Width = getPosPct(1440 - s.openMinutes);
        const seg2Left = 0;
        const seg2Width = getPosPct(s.closeMinutes);

        segmentsHtml = `
          <div class="timeline-bar-segment segment-${s.id}" style="left: ${seg1Left}%; width: ${seg1Width}%;"></div>
          <div class="timeline-bar-segment segment-${s.id}" style="left: ${seg2Left}%; width: ${seg2Width}%;"></div>
        `;
      } else {
        const segLeft = getPosPct(s.openMinutes);
        const segWidth = getPosPct(s.durationMinutes);
        segmentsHtml = `
          <div class="timeline-bar-segment segment-${s.id}" style="left: ${segLeft}%; width: ${segWidth}%;"></div>
        `;
      }

      return `
        <div class="timeline-row-track" title="${s.name} (${s.openUtc} - ${s.closeUtc} UTC)">
          ${segmentsHtml}
        </div>
      `;
    }).join('');

    // Overlap zones
    const lnyLeft = getPosPct(810);
    const lnyWidth = getPosPct(180);
    const stLeft = 0;
    const stWidth = getPosPct(420);

    container.innerHTML = `
      <div class="timeline-master-shell">
        <div class="timeline-layout">
          <!-- Left: Session Names Column -->
          <div class="timeline-labels-col">
            <div class="timeline-axis-spacer"></div>
            ${labelsHtml}
          </div>

          <!-- Right: Interactive Chart Area -->
          <div class="timeline-chart-col">
            <!-- 24-hour UTC Axis -->
            <div class="timeline-axis">
              <span style="left: 0%;">00:00</span>
              <span style="left: 12.5%;">03:00</span>
              <span style="left: 25%;">06:00</span>
              <span style="left: 37.5%;">09:00</span>
              <span style="left: 50%;">12:00</span>
              <span style="left: 62.5%;">15:00</span>
              <span style="left: 75%;">18:00</span>
              <span style="left: 87.5%;">21:00</span>
              <span style="left: 100%;">24:00</span>
            </div>

            <!-- Tracks and Needle Canvas -->
            <div class="timeline-canvas-area">
              <!-- Overlap Highlight Bands -->
              <div class="overlap-band band-asian" style="left: ${stLeft}%; width: ${stWidth}%;" title="Asian Overlap (00:00 - 07:00 UTC)"></div>
              <div class="overlap-band band-london-ny" style="left: ${lnyLeft}%; width: ${lnyWidth}%;" title="London / NY Overlap (13:30 - 16:30 UTC)">
                <span class="overlap-band-tag">LND / NY OVERLAP</span>
              </div>

              <!-- Session Tracks Stack -->
              <div class="timeline-tracks-stack">
                ${tracksHtml}
              </div>

              <!-- Live Current UTC Indicator Needle -->
              <div class="timeline-current-needle" style="left: ${utcPercent.toFixed(2)}%;">
                <div class="needle-head">
                  <span class="needle-time mono">${curHour}:${curMin} UTC</span>
                </div>
                <div class="needle-line"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

export const sessionTracker = new SessionTracker();

# Chronex — Economic & Session Countdown Dashboard

> **Live Global Market Session Tracker · 24-Hour Visual Timeline · Synchronized UTC & Local Clocks · High-Impact Release Countdowns · Offline Progressive Web App (PWA)**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Online%20%E2%86%92-0284C7.svg?style=for-the-badge)](https://maroxl.github.io/CHRONEX/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-10B981.svg?style=flat-square)](https://web.dev/progressive-web-apps/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-38BDF8.svg?style=flat-square)](#architecture)
[![Vanilla JS](https://img.shields.io/badge/Tech-Vanilla%20ES6%2B-F59E0B.svg?style=flat-square)](#architecture)
[![Storage](https://img.shields.io/badge/Storage-Quad--Vault%20DB-8B5CF6.svg?style=flat-square)](#persistence)

🌐 **Public Live Link**: **[https://maroxl.github.io/CHRONEX/](https://maroxl.github.io/CHRONEX/)**

---

## 🌟 Overview

**Chronex** is a dashboard built for Forex/futures traders, economic analysts, and students. It tracks the four major financial market sessions in real-time, spotlights high-liquidity overlap windows, maintains synchronized UTC and local clocks, and provides high-precision countdown timers for scheduled releases (e.g. CPI, Non-Farm Payrolls, FOMC meetings, project milestones).

Built strictly with **modern vanilla HTML5, CSS3, and modular ES6 JavaScript**, Chronex is packaged as a **Progressive Web App (PWA)** with offline caching, desktop/mobile app installation, and zero external build tool requirements.

---

## 🚀 Core Features

### 1. Global Market Session Bars & Status
- **Tracks 4 Major Global Sessions**:
  - 🇦🇺 **Sydney (ASX)**: `22:00 – 07:00 UTC` (handles midnight wrap-around)
  - 🇯🇵 **Tokyo (TSE)**: `00:00 – 09:00 UTC`
  - 🇬🇧 **London (LSE)**: `08:00 – 16:30 UTC`
  - 🇺🇸 **New York (NYSE)**: `13:30 – 20:00 UTC`
- **Dynamic Visual Status Glows**:
  - 🟢 **Open**: Glowing emerald (`#10B981`)
  - 🟡 **Overlap**: Glowing amber (`#F59E0B`) during key volume intersections
  - ⚪ **Closed**: Muted slate (`#64748B`)
- **Real-Time Dynamic Countdowns**:
  - If open: `"Closes in 02h 45m 12s"`
  - If closed: `"Opens in 01h 14m 08s"`
- **City Mini-Clocks**:
  - Displays local city time in Sydney, Tokyo, London, and New York.

### 2. High-Liquidity Overlap Tracking
- **London + New York Window (`13:30 – 16:30 UTC`)**:
  - The highest liquidity and volatility period in global finance, accounting for over 50% of daily FX volume.
  - Automatically triggers an **Active Overlap Banner** with glowing pulses.
- **Asian Session Overlap (`00:00 – 07:00 UTC`)**:
  - Sydney & Tokyo concurrent trading for JPY, AUD, and NZD pairs.

### 3. 24-Hour Master Visual Progress Bar
- Continuous `00:00` to `24:00` UTC scale.
- Multi-track horizontal bars displaying session windows.
- Striped overlap bands marking London/NY and Asian overlaps.
- Real-time vertical UTC needle with glowing head and live UTC time flag.

### 4. Dual Universal & Local Clocks
- **Universal Time Coordinated (UTC)**:
  - Exact reference time for global financial markets, complete with full date and seconds counter.
- **Local Time**:
  - Automatically detects local user timezone (e.g., `WAT / UTC+1`, `EST / UTC-5`, `CET / UTC+1`).
- **Format Toggle**:
  - Seamlessly switch between **24-Hour** and **12-Hour** (AM/PM) format with one click.

### 5. Custom Event & Economic Release Countdowns
- **Card-Based Precision Countdowns**:
  - Days, Hours, Minutes, Seconds with monospace numbers (`font-variant-numeric: tabular-nums`) to prevent digit flickering on tick.
- **Tagging & Priority System**:
  - **Impact**: High (Red), Medium (Amber), Low (Blue)
  - **Domain**: Financial / Economic, Academic, Project / Personal
- **Live Status Badges**:
  - `LIVE NOW`: Pulsing badge active when an event starts (active for 30 minutes).
  - `UNDER 1 HOUR`: Urgent red glowing card border.
  - `WITHIN 24H`: Impending amber indicator.
  - `COMPLETED`: Archived past state.
- **Quick Preset Chips**:
  - 1-click adder for US CPI, FOMC Rate Decision, NFP, London/NY Open, and Academic Project Deadlines.
- **Filter & Search Toolbar**:
  - Filter by All, High Impact, Medium, Low, Financial, or Academic.
  - Instant live keyword search.
  - Sort by Soonest First, Furthest First, or Highest Impact.

### 6. Live Economic Calendar API Feed (New)
- **Real-Time Macroeconomic Integration**:
  - Live API integration with real upcoming macroeconomic releases, central bank decisions, employment numbers, and inflation data.
  - Proxy route in `server.js` (`/api/calendar`) with 5-minute memory caching and CORS headers.
  - Direct CORS fallback for static deployments (Netlify, Vercel, GitHub Pages) and `localStorage` caching for instant offline load.
- **Key Metrics Display**:
  - Displays **Prior** and **Consensus (Forecast)** values for each release.
  - Region & currency flags: 🇺🇸 USD, 🇨🇦 CAD, 🇬🇧 GBP, 🇦🇺 AUD, 🇨🇳 CNY, 🇪🇺 EUR, 🇯🇵 JPY.
  - Live status indicators: `Synced at XX:XX` and manual **"🔄 Refresh"** trigger.
- **1-Click Tracking & Batch Synchronization**:
  - **`+ Track`**: 1-click pins any live market release directly into your custom countdown cards with sound alerts enabled!
  - **`🔴 Sync High-Impact`**: 1-click batch imports all scheduled high-impact events of the week into your active dashboard.

### 7. Persistence & Offline Synthesis
- **localStorage Client-Side Persistence**:
  - All custom events, filters, and user settings persist across browser refreshes without requiring an external database.
- **JSON Backup & Restore**:
  - Export backup file (`chronex-backup-YYYY-MM-DD.json`) and import anytime.
- **Web Audio API Sound Engine**:
  - Pure synthesized chime alerts when releases countdown to `00:00:00`.
  - Zero external MP3/audio files needed; 100% works offline.
- **Desktop Notifications**:
  - Optional browser notification permission for background tab alerts.

### 8. Mobile Terminal & Hamburger Drawer Navigation
- **Space-Efficient Mobile View**:
  - Automatically switches on mobile and tablet screens (`<= 860px`), replacing cluttered desktop horizontal navigation with a sleek iOS Liquid Glass hamburger button.
- **Animated 3-Bar to 'X' Hamburger Transition**:
  - Tactile spring physics transition (`cubic-bezier(0.22, 1, 0.36, 1)`) with full accessibility (`aria-expanded`, `aria-controls`, `aria-label`).
- **Slide-In Glass Navigation Sheet**:
  - Floating slide-in sheet (`backdrop-filter: blur(40px) saturate(220%)`) with swipe-to-dismiss gesture, backdrop overlay click dismiss, and Escape key dismissal.
  - Contains user account profile card, terminal settings (Time Format, Audio Chimes, Browser Alerts, PWA Install), quick section jump links, and backup tools.
- **Mobile Quick-Add (+) Button & Mobile Floating Action Button (FAB)**:
  - Ergonomic thumb access for instant countdown creation anywhere on the screen.
- **Touch-Optimized Responsive Views**:
  - Fluid countdown cards down to 320px screens, horizontally swipeable currency filter chip bars with touch momentum, and safe area padding (`env(safe-area-inset-bottom)`).

### 9. High-Performance Backend Workload Engine
- **Server-Side Market Sessions Computation (`/api/market-sessions`)**:
  - Offloads timeline math, overlap detection, midnight wrap-around logic, and countdown strings to the Node.js backend to reduce client CPU consumption and eliminate browser lag.
- **Server-Side Calendar Normalization & Query Filtering (`/api/calendar`)**:
  - Ingestion, 5-minute memory caching, country/flag tagging, impact mapping, and instant search/currency filtering executed directly on the server.
- **Cloud Events Persistence & Sync Engine (`/api/events`)**:
  - Persistent JSON event storage (`data/events.json`) with batch synchronization (`/api/events/sync`) and RESTful CRUD endpoints.
- **Unified Dashboard Summary Route (`/api/dashboard-summary`)**:
  - Aggregates server time, active sessions, current overlap state, and nearest upcoming catalyst into a single lightweight ~500 byte payload.
- **Zero-Lag DOM Updates**:
  - Calendar timers throttled to 30s bucket resolution with selective DOM mutations, eliminating micro-stutters and layout thrashing.

### 10. Persistent User Accounts & Dual-Vault Authentication
- **Permanent Backend Storage (`data/users.json`)**:
  - User accounts are stored permanently on disk on the Node backend with cryptographic salted SHA-256 hashes. Once an account is created, you never need to create a new one — your account is permanently saved and ready for sign-in anytime.
- **Client-Side Mirror Vault (`localStorage`)**:
  - Accounts and active sessions are mirrored locally for instantaneous startup and offline PWA capability.
- **Bi-directional Account Synchronization (`/api/auth/sync-vault`)**:
  - Offline-created accounts automatically synchronize into the backend database once connected.
- **Zero-Crash API Communication**:
  - Protected response parser guarantees zero `Unexpected end of JSON input` errors by verifying body streams before JSON evaluation.
- **Dynamic Port & Origin Discovery**:
  - Automatically bridges between local static preview servers (e.g. VS Code Live Server on port 5500) and the Node.js backend server on port 3000.
- **Secure Password Reset**:
  - Account recovery via personalized security questions and answers (`/api/auth/forgot-password/reset`).

### 11. Progressive Web App (PWA)
- `manifest.json`: Standalone app configuration, theme color `#0B0E14`, vector icons.
- `sw.js` (Service Worker v2.4.1): Cache-first caching strategy for instant startup offline, with automatic bypass for dynamic `/api/` routes.
- **In-App "Install App" Button**: Listens to `beforeinstallprompt` to install directly to Windows taskbar or mobile home screen.

---

## 📁 Project Architecture

```
CHRONEX/
├── index.html              # Main HTML5 application shell & dialog modals
├── manifest.json           # Web App Manifest (standalone, theme, icons)
├── sw.js                   # Service Worker (offline cache-first strategy)
├── server.js               # Node.js dev server & /api/calendar caching proxy
├── start.bat               # Windows 1-click desktop launcher
├── README.md               # Project documentation & usage guide
├── css/
│   ├── style.css           # Design tokens, reset, header, dual clocks, layout
│   ├── sessions.css        # Market sessions cards, glows, and 24h master timeline
│   ├── countdown.css       # Event countdown cards, tags, urgency states
│   ├── calendar.css        # Live economic calendar table, metrics & chips
│   └── modal.css           # HTML5 <dialog> modal, forms, and inputs
├── js/
│   ├── app.js              # Application orchestrator, PWA install prompt, UI binds
│   ├── clock.js            # UTC, Local, 12/24h toggle, city timezones
│   ├── sessions.js         # Midnight wrap-around logic, progress %, overlap engine
│   ├── countdown.js        # Event countdown math, status triggers, filter & search
│   ├── calendar.js         # Live economic calendar API client, normalizer & pin engine
│   ├── storage.js          # LocalStorage CRUD, default presets, JSON export/import
│   └── audio.js            # Web Audio API sound synthesizer (zero audio assets)
└── assets/
    └── icons/
        ├── icon.svg        # Master vector icon
        ├── favicon.svg     # Browser tab favicon
        ├── icon-192.png    # PWA 192x192 icon
        ├── icon-512.png    # PWA 512x512 icon
        └── apple-touch-icon.png
```

---

## 🧮 Session Hours & UTC Math

Handling all session mathematics in **UTC continuous minutes (`[0, 1440)`)** ensures accuracy anywhere in the world regardless of daylight saving or local timezone:

$$\text{utcMinutes} = \text{hours} \times 60 + \text{minutes} + \frac{\text{seconds}}{60}$$

| Session | Open (UTC) | Close (UTC) | Open (Mins) | Close (Mins) | Duration |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Sydney** | 22:00 | 07:00 | 1320 | 420 | 9.0 hrs (540m) |
| **Tokyo** | 00:00 | 09:00 | 0 | 540 | 9.0 hrs (540m) |
| **London** | 08:00 | 16:30 | 480 | 990 | 8.5 hrs (510m) |
| **New York** | 13:30 | 20:00 | 810 | 1200 | 6.5 hrs (390m) |

### Midnight Wrap-Around Handling (Sydney)
Because Sydney opens at `22:00` (day $t$) and closes at `07:00` (day $t+1$), standard range checks fail. The logic evaluates:
```javascript
const isOpen = utcMinutes >= 1320 || utcMinutes < 420;
```
Progress percentage through the active session is computed as:
```javascript
let elapsed = utcMinutes >= 1320 
  ? (utcMinutes - 1320) 
  : ((1440 - 1320) + utcMinutes);
let progress = (elapsed / 540) * 100;
```

### Overlap Windows
- **London / New York Overlap**: `13:30 – 16:30 UTC` ($810 \le \text{utcMinutes} < 990$)
- **Sydney / Tokyo Overlap**: `00:00 – 07:00 UTC` ($0 \le \text{utcMinutes} < 420$)

---

## 💻 Running Chronex Locally

Because Chronex uses native ES6 JavaScript modules (`type="module"`) and Service Workers, it should be served via HTTP:

### Option 1: Using Node.js (Installed)
```bash
# Run any lightweight static server
npx serve .
# or
node -e "const http=require('http'),fs=require('fs'),path=require('path');http.createServer((q,s)=>{let f=path.join(process.cwd(),q.url==='/'?'index.html':q.url.split('?')[0]);fs.readFile(f,(e,c)=>{s.writeHead(e?404:200);s.end(c);});}).listen(3000,()=>console.log('http://localhost:3000'));"
```

### Option 2: Using VS Code Live Server
- Right-click `index.html` in VS Code.
- Click **"Open with Live Server"**.

Open your browser to `http://localhost:3000`.

---

## 📲 Deploying as a PWA

Chronex is 100% static web files and can be deployed with zero configuration:

1. **Deploy to Netlify or Vercel**:
   - Drag and drop the `CHRONEX` folder directly into [Netlify Drop](https://app.netlify.com/drop) or push to GitHub and import into Vercel.
2. **Install on Desktop (Windows / macOS / ChromeOS)**:
   - Visit the URL in Chrome, Edge, or Brave.
   - Click the **"Install App"** button in the header (or click the install icon in the address bar).
   - Chronex now runs in its own standalone, frameless desktop window with its own icon on your Taskbar/Desktop!
3. **Install on Mobile (iOS / Android)**:
   - **Android**: Tap the "Install App" banner or browser menu -> "Add to Home screen".
   - **iOS (Safari)**: Tap Share icon -> "Add to Home Screen".

---

## ⚡ Packaging as a Native Desktop App (.exe) with Tauri

If you wish to compile an actual `.exe` file on Windows later:
```bash
npm create tauri-app@latest
# Point the frontend build folder to your CHRONEX root directory
npm run tauri build
```
Because Chronex has **zero build dependencies**, Tauri wraps it into an ultra-fast ~10 MB native Windows binary that consumes minimal memory.

---

## 🎨 Design Philosophy
- **Palette**:
  - Deep dark background: `#0B0E14` / `#121620`
  - Muted border accents: `#1E2638`
  - Emerald status: `#10B981` (Open)
  - Amber status: `#F59E0B` (Overlap)
  - Slate status: `#64748B` (Closed)
- **Typography**:
  - `JetBrains Mono` with `tabular-nums` for clock and countdown digits, preventing layout reflow on tick.
  - `Inter` for clean, professional labels and headers.

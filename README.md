# Verde — Your Personal Carbon Coach

Verde is a full-stack web application designed to help individuals understand, track, and reduce their daily carbon footprint through simple actions and personalized, AI-powered insights. It is built using ES modules on the frontend, an Express proxy backend, and integrates with the Google Gemini API.

---

## Architecture Diagram

The application is structured to separate concern layers and keep the API keys secure on the backend:

```text
  [ User Browser ]
         │
         ▼ (HTML / CSS / JavaScript ES Modules)
  ┌────────────────────────────────────────────────────────┐
  │                   Frontend Client                      │
  │  Calculations.js  ◄───►  State.js   ◄───►  UI.js       │
  │  History.js       ◄───►  Chart.js   ◄───►  Chat.js     │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼ (Secure API Calls)
  ┌────────────────────────────────────────────────────────┐
  │                   Express Proxy Server                 │
  │  Server.js (Input validation, caching, rate-limiting)  │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼ (Google Gemini API Proxy)
  ┌────────────────────────────────────────────────────────┐
  │                    Gemini AI Service                   │
  │  Generates personalized carbon coaching & chat replies │
  └────────────────────────────────────────────────────────┘
```

---

## Features

1. **Carbon Footprint Tracking**: Log daily activities including transport trips, diet types, AC/device usages, flight hours, purchases, and food waste levels.
2. **AI-Powered Insights**: Generates personalized coaching recommendations using the Google Gemini API, incorporating the current daily footprint breakdown and history logs.
3. **Smart Local Fallbacks**: Operates seamlessly in rule-based mode if no API key is present, upgrading to AI mode automatically when `GEMINI_API_KEY` is provided.
4. **Streak & Weekly Goals Tracker**: Track streaks of consecutive logs and progress toward a weekly footprint goal (e.g. staying under the India average of 5.2 kg CO₂e for 5 days of the week).
5. **Interactive Data Trends**: Visual representation of logs history on an interactive line chart with comparative rolling trend insights.
6. **XSS & Content Security**: Complete input sanitization, HTML escaping for chat components, server-side numerical boundaries clamping, and Content-Security-Policy (CSP) headers.
7. **Accessibility Features**: Designed with `aria-live="polite"` anchors, keyboard navigation support, screen-reader fallback tables, and `prefers-reduced-motion` compliance.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Version 20 recommended)
- NPM

### Installation

1. Clone or navigate to the repository directory:
   ```bash
   cd verde-carbon-coach
   ```

2. Install all workspace and workspace dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   Create a `.env` file inside the `server/` directory:
   ```bash
   cp server/.env.example server/.env
   ```
   Add your Google Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   ```

---

## Scripts

Run commands from the root directory:

- **Run Dev Server**: Starts the backend Express server on port 8000.
  ```bash
  npm run dev:server
  ```
- **Run Dev Client**: Serves the frontend locally with hot reload using Vite.
  ```bash
  npm run dev:client
  ```
- **Build Client**: Bundles the frontend code into the production-ready `/dist` folder.
  ```bash
  npm run build
  ```
- **Lint Code**: Checks files for style and lint errors.
  ```bash
  npm run lint
  ```
- **Format Code**: Auto-formats frontend and server JavaScript, HTML, and CSS files.
  ```bash
  npm run format
  ```
- **Run Unit Tests**: Executes Vitest unit tests checking core math and streak calculations.
  ```bash
  npm run test:unit
  ```
- **Run E2E Tests**: Launches Playwright E2E browser tests for user flows and security.
  ```bash
  npm run test:e2e
  ```

---

## Verification & CI Workflow

A GitHub Actions workflow is configured in `.github/workflows/ci.yml` that triggers on push and pull requests to:
- Check formatting and style guidelines.
- Scan for high-severity package vulnerabilities (`npm audit`).
- Run Vitest unit tests (asserting a coverage threshold of **75%**).
- Spin up the Express server and run Playwright E2E tests.

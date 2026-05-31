# Gigflow: Autonomous Freelance Co-Pilot & Automated Bidding Engine

Gigflow is a highly polished, autonomous full-stack freelance platform co-pilot. It is designed to handle the end-to-end freelance workflow in real-time: scraping active roles from freelance platforms, dynamically matching and scoring them against your custom professional profile using Gemini/Local Heuristics, automatically writing highly persuasive proposals, and programmatically submitting proposals via Playwright.

---

## 🚀 Orchestrator & System Architecture

```
                      +-------------------+
                      |   Freelancer UI   |  <- React SPA Dashboard
                      +---------+---------+
                                |  (HTTP API / JSON)
                                v
                      +-------------------+
                      |   Express Server  |  <- `server.ts` System Entry Point
                      +---------+---------+
                                |
      +-------------------------+-------------------------+
      | (Autonomous Cron Loop)                            | (Real-time Actions)
      v                                                   v
+-----------+    Gemini Vetting    +-------------+   Auto Bidding Submission
| Scraper & | -------------------> | Gemini /    | ------------------------+
| Crawler   |                      | Heuristics  |                         |
+-----------+                      | Evaluation  |                         |
      ^                            +-------------+                         v
      |                                                              +-----------+
      | Active scraping (simulated / real paths)                     | Playwright|
      +--------------------------------------------------------------| Browser   |
                                                                     | Automation|
                                                                     +-----------+
```

---

## 🛠️ System Modules Matrix

### 1. Unified Control Server (`server.ts`)
* **Role**: Serves as the system entry point. It orchestrates the HTTP endpoints, static build delivery (`dist/`), and handles background automated worker runs.
* **Dev/Prod Multi-Mode**: 
  * In **Development**, spins up Vite as an Express middleware under `middlewareMode: true` so changes live-reload.
  * In **Production**, it compiles the entire database, proposal mechanisms, and server into a self-contained CommonJS target (`dist/server.cjs`) using `esbuild` to eliminate runtime relative import path issues and optimize start latency, serving the static dashboard natively.

### 2. High-Fidelity Local Database (`server/db.ts`)
* **Role**: Holds application state, including:
  * Opportunities scraped across freelancing channels.
  * Generated proposals, feedback metrics, and status logs.
  * Active Developer Profiles containing skills, technologies, custom-built templates, pricing bounds, and budget preferences.
  * Dynamic configurations for automation loops, Gemini model selection (e.g., `gemini-3.5-flash`), Telegram webhook notifications, and automated execution schedules.

### 3. Smart Vetter & Pitch Draft Generator (`server/proposal.ts`)
* **Dual-Core Vetting Pipeline (Gemini AI + Real-time Rule-based Heuristic)**:
  * Uses the modern `@google/genai` TypeScript SDK.
  * Compares job title, description, budget parameters, and requirements directly with your developer skills, portfolio, and experience level.
  * **Rate-Limit & Quota Protection Guard**: If the Gemini API returns status `429 RESOURCE_EXHAUSTED` (such as free-tier limit thresholds), the system logs the incident, enters a global `7-minute cool-down phase`, and switches seamlessly to high-fidelity, offline local rule-based heuristic calculations. 
  * **Offline Generator fallback**: Drafts localized proposal pitches using fine-tuned multilingually compliant (English/Arabic) templates. This structural resilience guarantees that the autonomous scraper pipeline remains fully online and active without breaking.

### 4. Autonomous Worker & Scraper Engine (`server/scraper.ts`)
* **Role**: Periodically runs checks on active platform endpoints.
* **Auto-Submit Hook**: If `settings.mode` is configured to `'auto'` and a newly-discovered job meets or exceeds `settings.autoApproveMinScore`, the engine:
  * Immediately logs an authorization request.
  * Generates a custom proposal draft.
  * Hands the draft off to the Playwright module for real-time automated submission.
  * Sends a Telegram broadcast signaling a proposal was dispatched block-free.

### 5. Playwright Browser Automation (`server/playwright-session.ts`)
* **Role**: Simulates safe, headless human-like workspace actions.
* **Actions**: Loads targeted freelancer portal pages, targets job proposal input fields, inserts credentials or tokenized parameters safely, populates proposal and budget text boxes, and returns the live submission success URL.

### 6. Notification Telegram Webhook (`server/telegram.ts`)
* **Role**: Forwards real-time notifications about exceptional match discoveries, proposal drafts, automatic bidding dispatches, and API status alerts directly to your mobile device.

---

## 💻 Elite React Dashboard Components

The client-side dashboard (`/src`) is built with responsive CSS, Lucide Icons, and Motion transition micro-animations.

* **Dashboard Overview (`DashboardView.tsx`)**: High-performance dashboard tracking critical metrics, match trends, active opportunities, automated bidding logs, and visual analytics indicators.
* **Opportunities Hub (`OpportunitiesView.tsx`)**: Filters job entries across statuses, shows match breakdowns, and offers natural language interactive queries to drill down into job criteria.
* **Proposal Queue (`ProposalQueueView.tsx`)**: Active workspace containing pitch drafts. Engineers can manually preview, rewrite inside a custom rich text interface, tweak the tone (Professional, Analytical, Persuasive, Friendly, Technical), change proposal length, or dispatch submissions.
* **Developer Profile Workspace (`ProfileView.tsx`)**: Controls professional credentials, skill listings, technology sets, and multilingual writing preferences.
* **Accounts Configuration (`AccountsView.tsx`)**: Securely configures platform access, browser profile automation, and session security.
* **Settings Panel (`SettingsView.tsx`)**: Finetunes automatic scraping intervals, auto-approve minimum score scales, and models.
* **Active Copilot Widget (`ChatbotWidget.tsx`)**: An interactive chat window anchored to the lower-right corner. It allows you to query active metrics, ask Gemini to analyze incoming roles, refine drafts, or command live site scans using natural language.

---

## ⚙️ Setup and Configuration

Configure your environment by duplicating `.env.example` into a local `.env`:

```env
# Gemini API Configuration
GEMINI_API_KEY=your-api-key-here

# Telegram Notification config (Optional)
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 🏃 Running the Application

1. **Install Base Packages**:
   ```bash
   npm install
   ```

2. **Boot the Integrated Platform Dev Server**:
   ```bash
   npm run dev
   ```
   The dev server binds port `3000` to direct routing, so the dashboard opens immediately at `http://localhost:3000`.

3. **Build & Bundle with production directives**:
   ```bash
   npm run build
   ```
   This bundles files inside `dist/` and runs `esbuild` to compile `server.ts` into a self-contained server backend.

4. **Launch production server**:
   ```bash
   npm run start
   ```

---

## 🎯 Robust Rate-Limit Handshake Flow & Execution

```
[ New Job Scraped ]
         |
         v
[ Gemini API Evaluation requested ]
         |
         |----------------------------------------------+
         | (Status 200 OK)                              | (Status 429 Rate-Limited)
         v                                              v
[ Generate score and detailed reasoning ]      [ Active global cooling-down initiated ]
         |                                              |
         v                                              v
[ Create custom proposal ]                     [ Fallback to high-quality local rules ]
                                                        |
                                                        v
                                               [ Parse English or Arabic heuristics ]
                                                        |
                                                        v
                                               [ Draft localized robust proposals ]
```

This ensures zero-downtime, continuous automation and robust client delivery during high-frequency platform sweeps.

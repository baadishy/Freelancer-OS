# Freelance OS - Project Architecture & Operational Blueprints

Welcome to the comprehensive technical documentation and system architecture breakdown of **Freelance OS**. 

This document serves as an exhaustive, top-to-bottom master guide detailing how every component, script, automated routine, and logical gate operates within the platform. It specifically details the mechanics of the newly updated **Khamsat Scraper Validation** and **Relative Date Extraction** engines.

---

## 1. High-Level System Overview
**Freelance OS** is a full-stack, AI-powered freelance assistant designed to automatedly discover opportunities on major freelancing portals (predominantly Arabic-speaking platforms such as **Khamsat** and **Mostaql**, alongside international platforms like **Fiverr**), analyze listings for skill/profile alignment, write tailored pitches using the official **Gemini API** (`@google/genai`), and auto-submit bids using robust **Playwright browser sessions**, all while delivering real-time logs and periodic reports directly to a specified **Telegram Channel/Bot**.

---

## 2. Directory Structure & Code Modules

```
├── .env.example                # Templates for system secrets (Telegram Bot Token, Gemini Key, etc.)
├── metadata.json               # Manifest file detailing the application capabilities and frame permissions
├── package.json                # Declares script commands and explicit dependency requirements
├── server.ts                   # Main Express application entry point (manages routing, middlewares, and server logic)
├── server/
│   ├── db.ts                   # In-memory and disk-based JSON persistence engine
│   ├── gemini.ts               # Establishes the Google Gen AI client wrapper and models
│   ├── playwright-session.ts   # Core automated browser orchestrator, validators, and submission flows
│   ├── proposal.ts             # Evaluation metrics and proposal draft formulations via Gemini
│   ├── scraper.ts              # Listing scraper schedules and active community parsers
│   └── telegram.ts             # Telegram broadcast notifications and daily reports scheduler
└── src/                        # React Frontend Workspace
    ├── App.tsx                 # Central screen coordinator and structural navigation controller
    ├── types.ts                # Unified TypeScript type declarations, enums, and interfaces
    ├── index.css               # Unified global stylesheets and Tailwind v4 theme definitions
    ├── main.tsx                # Frontend bootloader
    └── components/             # Modular dashboard interface components
        ├── AccountsView.tsx      # Configures secure Playwright browser cookie imports
        ├── ChatbotWidget.tsx     # Provides interactive floating chat assistant with the core backend agent
        ├── DashboardView.tsx     # Rich analytics widgets, stats gauges, and system status rails
        ├── LoginView.tsx         # User authentication page mapping profile configurations
        ├── OpportunitiesView.tsx # Displays scraped freelance listings with live checking states
        ├── ProfileView.tsx       # Configures freelancer bio, custom pitch length, and tailored tones
        ├── ProposalQueueView.tsx # Coordinates drafted proposals and submits them via active browser sessions
        ├── SettingsView.tsx      # System global configurations (Polling intervals, Telegram integrations, etc.)
        └── UrlDebuggerView.tsx   # Manual diagnostics terminal for instantly parsing and inspecting project links
```

---

## 3. Database State Engine (`/server/db.ts`)
Because this system requires persistence across browser reloads and container runs, **Freelance OS** features a fast, disk-synchronized transaction store within `/server/db.ts`. 

- **State Model**: State is loaded into memory on server boot from `data/db.json` (or created with default structures if missing).
- **Core Entity Schemas**:
  - `opportunities`: Stores scraped jobs containing links, budgets, platform names, titles, descriptions, and structural health checks (`validationStatus`, `validationReason`, `redirectDetected`, and `serviceId` keys).
  - `proposals`: Tracks drafts, pitch content, tone parameters, submission states (`draft`, `queued`, `submitted`, `rejected`), and live URLs of submissions.
  - `profile`: Houses freelancer metadata, including primary skills (e.g., 'React', 'HTML', 'Copywriting'), standard bidding budgets, preferred writing length (`short`, `medium`, `long`), and the pitch tone (`professional`, `persuasive`, `humorous`, `direct`).
  - `accounts`: Tracks browser automation states, showing connected accounts, platforms, username credentials, and associated cookie configurations.
  - `logs`: Log history records categorized by type (`info`, `warning`, `success`, `error`) and source (`scraper`, `automation`, `system`, `gemini`, `telegram`). Allows users to debug headless runs in real-time.
  - `settings`: Dictates automation loops, representing the polling configurations, Telegram chat IDs, and scheduler periods.

---

## 4. Frontend Interactive Dashboards (`/src/components`)
Designed with high-contrast displays, responsive layouts, and a cohesive palette, the frontend contains specific workspaces:
1. **DashboardView**: Displays cumulative pipeline status (Opportunities Found, Active Proposals, Submitted Bids, Integration Health) alongside live scrolling system logs and a quick-action command center.
2. **OpportunitiesView**: Aggregates extracted projects. It filters items by status (Active, New, Invalid) and showcases matching alignment scores. Includes a live **Verify** action that launches Playwright to recheck a gig and double-check if the link is still valid.
3. **ProposalQueueView**: Focuses on draft review. Users can edit AI-drafted pitches, adjust bidding variables, or hit **Auto-Submit via Browser** to let Playwright bid on the live platform.
4. **AccountsView**: Coordinates Playwright sessions. Explains step-by-step methods to extract JSON cookies and injects them to bypass 2-Factor Authentication (2FA) or captcha hurdles on target sites.
5. **UrlDebuggerView**: The diagnostic toolkit. Paste any freelance project URL, and the server immediately boots a browser inspect worker, performing parsing, similarity analysis, and redirects tracking, producing clean structural breakdowns.
6. **ChatbotWidget**: Interactive chat allowing the freelancer to communicate directly with the Gemini agent client. Users can type commands like `/scrape-vet-autosubmit` to initiate an automated run.

---

## 5. Playwright Browser Automation Mechanics (`/server/playwright-session.ts`)

Playwright serves as the programmatic "browser driver" that replicates realistic human behaviors on Fiverr, Khamsat, and Mostaql.

### browser Auto-Detection
The framework automatically detects local Google Chrome, Chromium, or Microsoft Edge binaries using platform-aware system sweeps:
- **macOS**: Looks in `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` & homebrew paths.
- **Windows**: Iterates through typical Program Files directories and registry locations.
- **Linux**: Scrapes popular location bins (`/usr/bin/google-chrome`, `/usr/bin/chromium-browser`, etc.).
- Falls back to a user-configured path in `settings` or defaults of the container.

---

## 6. Deep-Dive: Khamsat Scraper Validation & Relative Date Extraction
In Arabic micro-task community forums, particularly **Khamsat**, jobs are frequently posted, amended, removed, or closed. Users often encounter outdated links or deleted services. 
Below are the detailed, granular mechanics of how **Freelance OS** validates links and extracts the precise relative time of creation.

### A. Title Overlap Similarity Matching (`isTitleSimilar(t1, t2)`)
To avoid treating redirects or dead pages as active listings (e.g., when a deleted project redirects back to a portal's homepage or to a totally different gig), we apply a normalized linguistic overlap algorithm:
1. Both strings are forced to lowercase.
2. Character normalization rules are applied to Arabic letterforms:
   - All variations of Alif (`أ`, `إ`, `آ`) map to plain Alif (`ا`).
   - Teh Marbuta (`ة`) maps to Heh (`ه`).
   - Alef Maksura (`ى`) maps to Yeh (`ي`).
3. Non-Arabic and non-English symbols are removed; spaces are simplified.
4. The strings are split into arrays of keywords (filtering out short helper words under 2 characters).
5. If one title is a substring of the other, or if they match identically, they are instantly flagged as similar.
6. Otherwise, it calculates a **Jaccard-like word overlap ratio**:
   $$\text{overlap} = \frac{\text{matching words}}{\max(\text{words}(t_1), \text{words}(t_2))}$$
   If this overlap is $\ge 50\%$, the titles are accepted. If not, the system flags a **Title Mismatch** (identifying that the URL has redirected to an alternate service) and marks the record as `INVALID` with `validationReason: 'TITLE_MISMATCH'`.

### B. Relative Published Date Extraction
Khamsat lists the creation dates of requests dynamically on the service page, showing complex textual structures like `منذ 4 أيام و23 ساعة` (Since 4 days and 23 hours). We extract this text precisely inside `extractKhamsatOpportunity()`:
1. The scraper inspects specific tabular cell matches containing `تاريخ النشر` (Publication Date) or lists structured within `.post-meta`, `.meta-item`, and `.meta-text`.
2. It executes a comprehensive page evaluation context searching for Arabic time match regex patterns:
   `منذ\s+(?:\d+|يوم|يومين|أيام|ساعة|ساعتين|ساعات|دقيقة|دقائق|شهر|شهور|أشهر|أسبوع|أسابيع)\s*(?:و\s+\d+\s+(?:ساعة|ساعات|دقيقة|دقائق|يوم|أيام))?`
3. If matches are found, it captures the complete localized textual value (such as `منذ 4 أيام و23 ساعة`) and populates the `publishedAt` attribute of the opportunity. This is immediately locked into the Database and rendered in the frontend panels.

### C. Automated Redirect & Dead Page Filters
1. **Service ID Extraction (`extractKhamsatId(url)`)**: Parses URLs to detect the unique numerical identifier representing requests (e.g. `https://khamsat.com/community/requests/123456...`).
2. **Redirect Validation Check**: On opening an opportunity link, Playwright reads the resolved destination URL (`page.url()`). If the URL differs from the original, we compare service IDs. If the original service ID diverges from the final service ID, a redirect is documented:
   - System raises `redirectDetected: true`.
   - Opportunity status is marked as `REDIRECTED` and `validationStatus: 'INVALID'`.
   - The original opportunity is locked out from proposal generation or bidding.
3. **Invalid Page Detection**: The browser inspects the page body and title tags for known Arabic and English deletion indicators:
   - `الخدمة غير موجودة` (Service does not exist)
   - `الخدمة غير متوفرة` (Service unavailable)
   - `تم حذف الخدمة` (Service deleted)
   - `تم حذف الموضوع` / `طلب غير موجود` (Topic/Request deleted)
   - Code `404`, `page not found`, or `service unavailable`.
   If matched, the listing's validation status immediately resolves to `INVALID` with a granular description of the matched phrase.
4. **Presence Integrity Check**: Active projects must contain structural content:
   - **Title Integrity**: Finds primary header tags (`h1`, `.topic-title`, etc.) and determines if text content length is $\ge 4$ characters.
   - **Description Integrity**: Finds body content tags (`.post-content`, `.details`, etc.) and checks if text exists and is $\ge 15$ characters.
   - **User Ownership**: Locates user author links or avatar elements containing `/user/` or `/u/` to confirm a valid poster.
   - **Price/Budget Estimations**: Validates the presence of numeric metrics or localized currency variables representing budget thresholds (e.g. `$`, `دولار`, `الميزانية`).
   If any of these constraints fail, the validation state resolves to `INVALID`, preventing garbage database rows or AI token waste.

---

## 7. Automated Scraper loop (`/server/scraper.ts`)
The scraper script can run at user-defined interval triggers (configured in `/src/components/SettingsView.tsx`):
- **Mock Fallback**: If active scraping gets barred or blocked in some network regions, seed algorithms inject localized Arabic demo opportunities.
- **Active Scraper Verification Pipeline**:
  1. The loop starts by scraping candidate URLs from the main platform boards.
  2. For the top candidates, the scraper launches a Playwright session.
  3. Instead of blindly storing links, it routes each link through `validateOpportunity(platform, URL, page, expectedTitle)`.
  4. It extracts live description contents, client IDs, pricing estimates, and the dynamic `publishedAt` relative dates.
  5. Only healthy, validated, and unique records are saved to the database.

---

## 8. Proposal & Alignment Evaluation Engine (`/server/proposal.ts`)
Once an opportunity is successfully discovered and flagged as healthy (`validationStatus: 'VALID'`), the freelancer can prompt proposal generation.

- **Match Analysis**: The opportunity data along with the freelancer's bio-profile are fed into Gemini. The LLM translates the Arabic text, measures fit, and outputs:
  - An overall match score % (representing suitability).
  - An objective list of bulleted Pros and Cons.
  - A summary of skill gaps.
- **Safe Pitch Draft formulation**: 
  - To secure consistency, both proposal writing and match analyses are locked out for invalid opportunities. Attempting to draft a pitch for a dead or redirected job will throw a clean rejection error:
    `"Proposal Generation Refused: Target opportunity has validationStatus 'unvalidated' or 'INVALID'. Bids are only allowed on active, verified listings."`
  - When allowed, Gemini acts as the writer to draft tailored messages in the selected tone (e.g., *Humorous*, *Empathetic*, etc.) and length.

---

## 9. Telegram Operations and Notifications Hub (`/server/telegram.ts`)
The Telegram integration transforms the OS into a highly responsive, remote-monitored system:
- **Chatbot integration**: Operates an Express-side webhook configuration or a long-poll checker matching incoming messages against a secure Telegram Bot token.
- **Platform Telemetry Alerts**: If the scraper discovers a job alignment score of $\ge 80\%$, an immediate Telegram broadcast message is sent to the developer with the project description and direct UI links.
- **Interactive Command Executions**: Freelancers can message the bot commands like `/status` to get server performance updates, or `/brief` to trigger a beautiful markdown-based review containing the health of recent scrapes and active proposals.

---

## 10. Summary of Key Operational Workflows

```
[ Platform Board / Scraper Hub ]
               │
               ▼
   Candidate Link Extracted (URL + Expected Title)
               │
               ▼
   Launch Playwright Worker
               │
      ┌────────┴────────────────────────────────────────┐
      ▼                                                 ▼
[ Redirect Checks ]                           [ Deletion Content Scan ]
- Service ID Extract (url vs finalUrl)        - Matches Arabic phrases for deletion
- Check if Service IDs match                - Verifies Title overlap >= 50%
- If redirect detected -> Reject!             - Confirms Title, Desc, Owner structure
      │                                                 │
      └────────┬────────────────────────────────────────┘
               ▼
      Is Candidate Clean & Valid?
         ├── YES ──► Extract date: "منذ 4 أيام و23 ساعة" ──► Save as 'VALID' Opportunity
         └── NO  ──► Record as 'INVALID' Opportunity ─────► Exclude from Pitch Drafts
```

### Steps of manual inspection & automatic scraping:
1. Scraper wakes up on Cron or Chat command.
2. Navigates the headlessly initiated browser to the platforms requests board.
3. Obtains potential target anchors, mapping each anchor link and its visual text.
4. Visits individual items and processes the checks described above.
5. Populates the global database with newly validated active opportunities, noting the Arabic relative creation date.
6. Notifies the user via Telegram alerts of high-match projects.
7. Ready for proposal generation!

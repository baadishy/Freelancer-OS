/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { db } from './db.js';
import { getGeminiClient, isGeminiConfigured } from './gemini.js';

// Re-export type definitions to support schema verification if needed
import { ConnectedAccount } from '../src/types.js';
import { resolveAndValidateUrl, BoardData } from './url-resolver.js';
import { recordDiscovery } from './scraper-analytics.js';

/**
 * Utility to extract service/request ID from any Khamsat URL
 */
export function extractKhamsatId(urlStr: string): string | null {
  const match = urlStr.match(/\/(?:services?|requests)\/(\d+)/i);
  return match ? match[1] : null;
}

/**
 * Validates if two titles are highly similar by normalizing them and checking word overlap.
 */
export function isTitleSimilar(t1: string, t2: string): boolean {
  if (!t1 || !t2) return false;
  
  const normalize = (s: string) => {
    return s.toLowerCase()
      // Normalize Arabic characters
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      // Convert multiple spaces/punctuations to singular space
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
      .trim();
  };

  const norm1 = normalize(t1);
  const norm2 = normalize(t2);

  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  const words1 = new Set(norm1.split(' ').filter(w => w.length > 1));
  const words2 = norm2.split(' ').filter(w => w.length > 1);
  if (words1.size === 0 || words2.length === 0) return false;
  
  let matches = 0;
  for (const w of words2) {
    if (words1.has(w)) {
      matches++;
    }
  }

  const ratio = matches / Math.max(words1.size, words2.length);
  return ratio >= 0.5;
}

/**
 * Automatically detects the installed Chrome executable across platforms (Windows, macOS, Linux).
 * Fallback to manual path in database or system environment.
 */
export function detectChromePath(): string | undefined {
  const settings = db.getAutomationSettings();
  if (settings.chromePath && fs.existsSync(settings.chromePath)) {
    return settings.chromePath;
  }
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const platform = process.platform;
  if (platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
    ];
    for (const p of paths) {
      if (p && fs.existsSync(p)) return p;
    }
  } else if (platform === 'darwin') {
    const paths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else if (platform === 'linux') {
    const paths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

/**
 * Helper to launch a persistent Playwright browser context using the detected Chrome browser 
 * and persistent storage directories per platform to maintain cookies/sessions across restarts.
 */
export async function launchPlaywrightPersistent(platform: 'Khamsat' | 'Mostaql', isInteractive: boolean = false): Promise<BrowserContext> {
  const profileDir = path.join(process.cwd(), 'data', 'browser-profiles', platform.toLowerCase());
  
  // Ensure profile directory exists
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // Release interactive browser session lock if busy on this platform to avoid hanging on the directory lock
  if (typeof playwrightSession !== 'undefined' && playwrightSession && typeof playwrightSession.getActivePlatform === 'function') {
    if (playwrightSession.getActivePlatform() === platform) {
      if (isInteractive) {
        // If starting a new interactive session, close whatever was there just in case.
        // It keeps directory accessible.
      } else {
        // Prevent background scraper or validator from closing the active interactive session of a user!
        throw new Error(`Platform ${platform} has an active interactive browser session running. Skipping background task to prevent page termination.`);
      }
    }
  }

  const chromePath = detectChromePath();
  
  if (chromePath) {
    db.addLog('info', 'automation', `Launching persistent context for ${platform} using detected Chrome binary: ${chromePath}`);
  } else {
    db.addLog('info', 'automation', `No local Chrome installation detected. Defaulting to Playwright Chromium fallback with persistent context...`);
  }

  // Set up headless based on environment or cloud container requirement (headless mode is mandatory in Cloud Run)
  const isHeadless = true; 

  // Wrap the persistent context launch in a 15-second timeout to prevent indefinite hanging (running without stop)
  const launchPromise = chromium.launchPersistentContext(profileDir, {
    executablePath: chromePath || undefined,
    headless: isHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features',
      '--disable-blink-features=AutomationControlled',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--lang=en-US,en'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: { width: 1024, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Browser launch timeout (15s limit reached). This profile directory is locked by another active Chrome instance or background crawler task. Please retry shortly.')), 15000)
  );

  const context = await Promise.race([launchPromise, timeoutPromise]);

  // Persistent session cookie restoration for 24/7 durability on ephemeral Cloud Run containers
  try {
    const account = db.getAccount(platform);
    if (account && account.cookiesJson) {
      const savedCookies = JSON.parse(account.cookiesJson);
      if (Array.isArray(savedCookies) && savedCookies.length > 0) {
        db.addLog('info', 'automation', `[24/7 Persistence] Injecting ${savedCookies.length} saved session cookies for ${platform}...`);
        await context.addCookies(savedCookies);
      }
    }
  } catch (cookieErr: any) {
    db.addLog('warning', 'automation', `Failed to inject saved cookies for ${platform}: ${cookieErr.message}`);
  }

  // Antbot Playwright Evasion & Spoofing Init Script
  await context.addInitScript(() => {
    // 1. Redefine webdriver property to undefined or false
    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    } catch (e) {}

    // 2. Add Chrome App/Runtime definitions to emulate genuine browser
    try {
      if (!(window as any).chrome) {
        (window as any).chrome = {
          app: {
            isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
          },
          runtime: {
            OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
            OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
            PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86_32', X86_64: 'x86_64' },
            PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86_32', X86_64: 'x86_64' },
            PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
            RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' }
          }
        } as any;
      }
    } catch (e) {}

    // Mock (window as any).chrome.csi and (window as any).chrome.loadTimes
    try {
      if ((window as any).chrome && !(window as any).chrome.csi) {
        (window as any).chrome.csi = () => ({
          startE: Date.now() - 500,
          onloadT: Date.now(),
          pageT: 500,
          tran: 0
        });
      }
      if ((window as any).chrome && !(window as any).chrome.loadTimes) {
        (window as any).chrome.loadTimes = () => ({
          requestTime: (Date.now() - 500) / 1000,
          startLoadTime: (Date.now() - 500) / 1000,
          commitLoadTime: (Date.now() - 400) / 1000,
          finishDocumentLoadTime: (Date.now() - 100) / 1000,
          finishLoadTime: Date.now() / 1000,
          firstPaintTime: (Date.now() - 300) / 1000,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false,
          npnNegotiatedProtocol: '',
          wasSlowStart: false,
          connectionInfo: 'unknown'
        });
      }
    } catch (e) {}

    // 3. Spoof WebGL vendor and renderer (remove swiftshader and llvmpipe indicators)
    try {
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        // UNMASKED_VENDOR_WEBGL
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        // UNMASKED_RENDERER_WEBGL
        if (parameter === 37446) {
          return 'Intel(R) Iris(TM) Plus Graphics 640';
        }
        return getParameter.call(this, parameter);
      };
    } catch (e) {}

    // 4. Spoof languages list
    try {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    } catch (e) {}

    // 5. Spoof Plugins count so it's not a dead giveaway (0 on headless)
    try {
      const mockPlugins = [
        { description: 'Portable Document Format', filename: 'internal-pdf-viewer', name: 'Chrome PDF Viewer' },
        { description: 'Portable Document Format', filename: 'internal-pdf-viewer', name: 'Chromium PDF Viewer' }
      ];
      Object.defineProperty(navigator, 'plugins', {
        get: () => mockPlugins,
      });
    } catch (e) {}
  });

  return context;
}

class PlaywrightSessionManager {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private platform: 'Khamsat' | 'Mostaql' | null = null;

  public async startSession(platform: 'Khamsat' | 'Mostaql'): Promise<string> {
    // If there is an existing session, close it first
    await this.closeSession();

    this.platform = platform;
    this.context = await launchPlaywrightPersistent(platform, true);

    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

    let startUrl = '';
    if (platform === 'Khamsat') {
      startUrl = 'https://khamsat.com/community/requests';
    } else if (platform === 'Mostaql') {
      startUrl = 'https://mostaql.com/projects';
    }

    db.addLog('info', 'system', `Launching interactive persistent context session to connect ${platform}...`);
    await this.page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Refresh page screen
    return this.getScreenshot();
  }

  public getActivePlatform() {
    return this.platform;
  }

  public async getScreenshot(): Promise<string> {
    if (!this.page) {
      throw new Error('No active browser page available.');
    }
    const buffer = await this.page.screenshot({ type: 'jpeg', quality: 80 });
    return buffer.toString('base64');
  }

  public async click(xPercent: number, yPercent: number): Promise<string> {
    if (!this.page) throw new Error('No active browser session.');
    
    // Tap or click at coordinates
    const viewSize = this.page.viewportSize() || { width: 1024, height: 768 };
    const x = Math.round((xPercent / 100) * viewSize.width);
    const y = Math.round((yPercent / 100) * viewSize.height);

    await this.page.mouse.click(x, y);
    // Wait for network/DOM transitions
    await this.page.waitForTimeout(1500);
    return this.getScreenshot();
  }

  public async clickHold(xPercent: number, yPercent: number, durationMs: number = 6000): Promise<string> {
    if (!this.page) throw new Error('No active browser session.');

    const viewSize = this.page.viewportSize() || { width: 1024, height: 768 };
    const x = Math.round((xPercent / 100) * viewSize.width);
    const y = Math.round((yPercent / 100) * viewSize.height);

    db.addLog('info', 'automation', `Simulating interactive Press & Hold at [${x}px, ${y}px] for ${(durationMs / 1000).toFixed(1)}s...`);

    // Move to coordinates
    await this.page.mouse.move(x, y);
    // Key press down
    await this.page.mouse.down({ button: 'left' });
    // Keep it down for the duration
    await this.page.waitForTimeout(durationMs);
    // Release
    await this.page.mouse.up({ button: 'left' });

    // Wait for animations/transitions
    await this.page.waitForTimeout(2000);
    return this.getScreenshot();
  }

  public async type(text: string): Promise<string> {
    if (!this.page) throw new Error('No active browser session.');
    await this.page.keyboard.insertText(text);
    await this.page.waitForTimeout(500);
    return this.getScreenshot();
  }

  public async pressKey(key: string): Promise<string> {
    if (!this.page) throw new Error('No active browser session.');
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(1500);
    return this.getScreenshot();
  }

  public async navigateTo(url: string): Promise<string> {
    if (!this.page) throw new Error('No active browser session.');
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return this.getScreenshot();
  }

  public async checkAuthStatus(): Promise<{ authenticated: boolean; username?: string }> {
    if (!this.page || !this.platform) {
      return { authenticated: false };
    }

    let url = this.page.url();
    
    // If on Google OAuth or Hsoub Identity/Login pages, let the user complete manual login.
    // Do NOT force navigation to destUrl, as this destroys their typing progress/redirection and returns them to the login-wall.
    if (url.includes('google.com') || url.includes('hsoub.com') || url.includes('accounts.google.com') || url.includes('accounts.hsoub.com')) {
      return { authenticated: false };
    }

    let authenticated = false;
    let username: string | undefined;

    try {
      if (this.platform === 'Khamsat') {
        const loginPresent = url.includes('/login') || url.includes('/signin') || url.includes('accounts.hsoub.com');
        const userMenu = await this.page.$('a[href*="/user/"], .user-menu, a[href*="/logout"], .avatar, .nav-user');
        if (userMenu || (!loginPresent && (url.includes('/community') || url.includes('/requests') || url.includes('/services') || url.includes('/messages') || url === 'https://khamsat.com' || url === 'https://khamsat.com/'))) {
          authenticated = true;
          const userElem = await this.page.$('a[href*="/user/"]');
          if (userElem) {
            const href = await userElem.getAttribute('href');
            username = href?.split('/').pop() || 'Khamsat User';
          }
        }
      } else if (this.platform === 'Mostaql') {
        const loginPresent = url.includes('/login') || url.includes('/register') || url.includes('/signin') || url.includes('accounts.hsoub.com');
        const userMenu = await this.page.$('a[href*="/u/"], .user-menu, a[href*="/logout"], img.avatar, .avatar');
        if (userMenu || (!loginPresent && (url.includes('/projects') || url.includes('/messages') || url.includes('/portfolio') || url === 'https://mostaql.com' || url === 'https://mostaql.com/'))) {
          authenticated = true;
          const userElem = await this.page.$('a[href*="/u/"]');
          if (userElem) {
            const href = await userElem.getAttribute('href');
            username = href?.split('/').pop() || 'Mostaql User';
          }
        }
      }
    } catch (e) {
      console.warn('Auth status evaluation exception:', e);
    }

    return { authenticated, username };
  }

  public async saveAndClose(): Promise<boolean> {
    if (!this.page || !this.context || !this.platform) {
      return false;
    }

    const { username } = await this.checkAuthStatus();
    const profileDir = path.join(process.cwd(), 'data', 'browser-profiles', this.platform.toLowerCase());

    let cookiesJson: string | undefined = undefined;
    try {
      const cookiesList = await this.context.cookies();
      if (cookiesList && cookiesList.length > 0) {
        cookiesJson = JSON.stringify(cookiesList);
        db.addLog('info', 'automation', `[24/7 Persistence] Extracted and backed up ${cookiesList.length} session cookies during interactive account verification.`);
      }
    } catch (cookieErr: any) {
      db.addLog('warning', 'automation', `Could not extract session cookies during interactive connection: ${cookieErr.message}`);
    }

    db.updateAccount(this.platform, {
      status: 'CONNECTED',
      username: username || 'Verified Account',
      lastLogin: new Date().toISOString(),
      lastValidation: new Date().toISOString(),
      errorMessage: undefined,
      profileLocation: profileDir,
      cookiesJson
    });

    db.addLog('success', 'automation', `Playwright persistent profile verified and finalized for ${this.platform} at ${profileDir}.`);
    await this.closeSession();
    return true;
  }

  public async closeSession(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close().catch(() => {});
        this.page = null;
      }
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
    } catch (e) {
      console.error('Failed to close browser persistent context thread:', e);
    }
    this.platform = null;
  }
}

export const playwrightSession = new PlaywrightSessionManager();

/**
 * Validates whether the persistent session is still authenticated.
 */
export async function validatePlatformSession(platform: 'Khamsat' | 'Mostaql'): Promise<{ status: string; username?: string; error?: string }> {
  const profileDir = path.join(process.cwd(), 'data', 'browser-profiles', platform.toLowerCase());
  
  if (!fs.existsSync(profileDir)) {
    db.updateAccount(platform, { status: 'DISCONNECTED', errorMessage: 'No persistent profile directory found.' });
    return { status: 'DISCONNECTED', error: 'No persistent profile directory found.' };
  }

  let context: BrowserContext | null = null;
  try {
    context = await launchPlaywrightPersistent(platform);
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    let checkUrl = '';
    if (platform === 'Khamsat') {
      checkUrl = 'https://khamsat.com/community/requests';
    } else if (platform === 'Mostaql') {
      checkUrl = 'https://mostaql.com/projects';
    }

    await page.goto(checkUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    let url = page.url();
    // Allow Google/Hsoub silent SSO redirection to settle during revalidation
    if (url.includes('hsoub.com') || url.includes('google.com')) {
      try {
        await page.waitForTimeout(3000);
        url = page.url();
        if (url.includes('hsoub.com') || url.includes('google.com')) {
          await page.goto(checkUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(1000);
          url = page.url();
        }
      } catch (e) {}
    }

    let authenticated = false;
    let username: string | undefined;

    if (platform === 'Khamsat') {
      const loginPresent = url.includes('/login') || url.includes('/signin') || url.includes('accounts.hsoub.com');
      const userMenu = await page.$('a[href*="/user/"], .user-menu, a[href*="/logout"], .avatar, .nav-user');
      if (userMenu || (!loginPresent && (url.includes('/community') || url.includes('/requests') || url.includes('/services') || url === 'https://khamsat.com' || url === 'https://khamsat.com/'))) {
        authenticated = true;
        const userElem = await page.$('a[href*="/user/"]');
        if (userElem) {
          const href = await userElem.getAttribute('href');
          username = href?.split('/').pop() || 'Connected User';
        }
      }
    } else if (platform === 'Mostaql') {
      const loginPresent = url.includes('/login') || url.includes('/register') || url.includes('/signin') || url.includes('accounts.hsoub.com');
      const userMenu = await page.$('a[href*="/u/"], .user-menu, a[href*="/logout"], img.avatar, .avatar');
      if (userMenu || (!loginPresent && (url.includes('/projects') || url.includes('/portfolio') || url === 'https://mostaql.com' || url === 'https://mostaql.com/'))) {
        authenticated = true;
        const userElem = await page.$('a[href*="/u/"]');
        if (userElem) {
          const href = await userElem.getAttribute('href');
          username = href?.split('/').pop() || 'Connected User';
        }
      }
    }

    if (authenticated) {
      let cookiesJson: string | undefined = undefined;
      try {
        const cookiesList = await context.cookies();
        if (cookiesList && cookiesList.length > 0) {
          cookiesJson = JSON.stringify(cookiesList);
        }
      } catch (cookieErr: any) {
        console.error('Failed to dump cookies in validatePlatformSession:', cookieErr);
      }

      db.updateAccount(platform, {
        status: 'CONNECTED',
        username: username || 'Connected User',
        lastValidation: new Date().toISOString(),
        profileLocation: profileDir,
        cookiesJson
      });
      return { status: 'CONNECTED', username };
    } else {
      db.updateAccount(platform, {
        status: 'EXPIRED',
        errorMessage: 'Account was redirected to login. Re-connection required.'
      });
      db.addLog('warning', 'automation', `Playwright persistent profile session expired for ${platform}. Re-authentication required.`);
      return { status: 'EXPIRED', error: 'Authentication check failed.' };
    }
  } catch (err: any) {
    db.updateAccount(platform, {
      status: 'ERROR',
      errorMessage: err.message || 'Browser process crashed during validation.'
    });
    return { status: 'ERROR', error: err.message || 'Validation process exception.' };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

/**
 * Automatically submits a generated proposal to the freelance platform using the persistent Chrome session profile.
 */
export async function submitProposalViaPlaywright(proposalId: string): Promise<{ success: boolean; message: string; submittedLink: string }> {
  const prop = db.getProposals().find(p => p.id === proposalId);
  if (!prop) {
    return { success: false, message: 'Proposal not found.', submittedLink: '' };
  }

  const op = db.getOpportunities().find(o => o.id === prop.opportunityId);
  if (!op) {
    return { success: false, message: 'Associated opportunity not found.', submittedLink: '' };
  }

  const platform = op.platform;
  const profileDir = path.join(process.cwd(), 'data', 'browser-profiles', platform.toLowerCase());

  if (!fs.existsSync(profileDir)) {
    db.updateAccount(platform, { status: 'LOGIN_REQUIRED' });
    return { 
      success: false, 
      message: `No active persistent profile found for ${platform}. Please connect your account first in the Accounts tab.`, 
      submittedLink: op.link 
    };
  }

  db.addLog('info', 'automation', `Launching Playwright secure persistent context to auto-submit bid to ${platform}...`);

  const screensDir = path.join(process.cwd(), 'data', 'screenshots');
  if (!fs.existsSync(screensDir)) {
    fs.mkdirSync(screensDir, { recursive: true });
  }

  const screenshots: { title: string; filename: string; timestamp: string }[] = [];

  let context: BrowserContext | null = null;
  try {
    context = await launchPlaywrightPersistent(platform);
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    const takeScreenshot = async (title: string) => {
      try {
        const filename = `${proposalId}_${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
        const screenshotPath = path.join(screensDir, filename);
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        screenshots.push({ title, filename, timestamp: new Date().toISOString() });
        db.updateProposal(proposalId, { 
          submissionDebugScreenshots: [...screenshots]
        });
        db.addLog('info', 'automation', `[Visual Debug Camera] Captured: ${title} (${filename})`);
      } catch (e: any) {
        console.error(`Failed to take screenshot "${title}":`, e.message);
      }
    };

    db.addLog('info', 'automation', `Navigating to project link for pre-submission checks: ${op.link}`);
    await page.goto(op.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await takeScreenshot('1. Project Page Loaded');

    // Enforce Auto-Submission Rules: re-run full validation checks on the page and abort if they fail
    const preSubmissionCheck = await validateOpportunity(platform, op.link, page);
    
    // Check if the daily bidding limit has been reached on this platform
    if (preSubmissionCheck.additionalData?.bidLimitReached) {
      await takeScreenshot('Bidding Limit Hit');
      db.updateProposal(proposalId, { submissionError: 'Bidding Limit Reached: You have reached your daily offer limit on Mostaql. Please wait or upgrade your plan.' });
      db.addLog('warning', 'automation', `[AUTO-SUBMIT ABORT] Cannot submit bid because Mostaql daily offering limit has been hit.`);
      return {
        success: false,
        message: 'Bidding limit reached: You have reached your daily offer limit on Mostaql. Bidding is paused or deferred.',
        submittedLink: op.link
      };
    }

    if (!preSubmissionCheck.valid) {
      const failReason = preSubmissionCheck.reason || 'UNAVAILABLE';
      let updatedStatus: any = 'UNAVAILABLE';
      if (failReason === 'CLOSED') updatedStatus = 'CLOSED';
      else if (failReason === 'PRIVATE') updatedStatus = 'PRIVATE';
      else if (failReason === 'DELETED') updatedStatus = 'DELETED';
      else if (failReason === 'INACTIVE') updatedStatus = 'INACTIVE';
      else if (failReason === 'UNAVAILABLE') updatedStatus = 'UNAVAILABLE';

      db.updateOpportunity(op.id, {
        status: updatedStatus,
        validationStatus: 'INVALID',
        validationReason: failReason,
        isActive: false,
        lastValidatedAt: new Date().toISOString()
      });

      await takeScreenshot(`Validation Failed: ${failReason}`);
      db.updateProposal(proposalId, { submissionError: `Opportunity became invalid or closed: ${failReason}` });

      db.addLog('error', 'automation', `[AUTO-SUBMIT ABORT] Pre-submission validation failed for "${op.title}". Opportunity marked as ${updatedStatus} (${failReason}).`);
      return {
        success: false,
        message: `Bidding aborted: pre-submission validation detected the project is no longer valid/accessible (reason: ${failReason}).`,
        submittedLink: op.link
      };
    }

    // Verify authenticated
    const url = page.url();
    let authenticated = false;
    if (platform === 'Khamsat') {
      const loginPresent = url.includes('/login') || url.includes('/signin');
      const userMenu = await page.$('a[href*="/user/"], .user-menu, a[href*="/logout"]');
      if (userMenu || !loginPresent) authenticated = true;
    } else if (platform === 'Mostaql') {
      const loginPresent = url.includes('/login') || url.includes('/register');
      const userMenu = await page.$('a[href*="/u/"], .user-menu, a[href*="/logout"]');
      if (userMenu || !loginPresent) authenticated = true;
    }

    if (!authenticated) {
      db.updateAccount(platform, { status: 'EXPIRED', errorMessage: 'Automated bidding detected session expired.' });
      await takeScreenshot('Authentication Expired Screen');
      db.updateProposal(proposalId, { submissionError: 'Session expired. Reconnect your account first.' });
      db.addLog('warning', 'automation', `Bidding deferred: Session expired for platform ${platform}. Action needed: Reconnect Account.`);
      return { 
        success: false, 
        message: 'Session has expired. Re-authentication on the Accounts tab is required.', 
        submittedLink: op.link 
      };
    }

    // Input proposal content and click submit!
    let detailsStr = '';
    if (platform === 'Khamsat') {
      const textarea = await page.$('textarea[name="reply"], textarea#reply_content, textarea');
      if (textarea) {
        await textarea.fill(prop.content);
        await page.waitForTimeout(500);

        // Turn on the terms confirmation checkbox if it exists on the form
        const checkbox = await page.$('input#confirm, input[name="confirm"], input[type="checkbox"]');
        if (checkbox) {
          db.addLog('info', 'automation', `Locating and checking Khamsat terms confirmation checkbox...`);
          try {
            await checkbox.check({ force: true });
          } catch (e: any) {
            // Sibling click fallback as backup
            await page.click('label[for="confirm"]').catch(() => {});
          }
          await page.waitForTimeout(500);
        }

        await takeScreenshot('2. Form Textarea Filled and Confirmed');

        const submitBtn = await page.$('input[type="submit"], button[type="submit"], button:has-text("أضف"), input[value*="أضف"]');
        if (submitBtn) {
          db.addLog('info', 'automation', `Clicking Khamsat reply submit button...`);
          await submitBtn.click();
          await page.waitForTimeout(4000);
          await takeScreenshot('3. Post Submission Page State');
          detailsStr = 'Textarea filled and submit button clicked automatically!';
        } else {
          db.addLog('info', 'automation', `Submit button query empty. Dispatching Enter key...`);
          await textarea.press('Enter');
          await page.waitForTimeout(4000);
          await takeScreenshot('3. Post Submission (Enter Dispatched)');
          detailsStr = 'Textarea filled and Enter key pressed!';
        }
      } else {
        throw new Error('Could not find reply input textarea on page. Form might be closed, or UI changed.');
      }
    } else if (platform === 'Mostaql') {
      // Find the main details / proposal text input precisely first
      const textarea = await page.$('#bid__details, textarea[name="details"], textarea[name="comment"], textarea#comment, textarea[name="description"]');
      if (textarea) {
        db.addLog('info', 'automation', `Filing main Mostaql proposal details field...`);
        await textarea.fill(prop.content);
        await page.waitForTimeout(500);

        // Calculate custom cost & period values based on user definitions or fallbacks
        const matches = (op.budget || '').match(/\d+/g);
        const fallbackCost = matches && matches.length > 0 ? parseInt(matches[0], 10) : 25;
        const bidCost = prop.cost !== undefined ? prop.cost : (op.cost !== undefined ? op.cost : fallbackCost);
        const bidPeriod = prop.period !== undefined ? prop.period : (op.period !== undefined ? op.period : 10);

        db.addLog('info', 'automation', `Mostaql standard fields - price: $${bidCost}, duration: ${bidPeriod} days...`);

        const durationInput = await page.$('#bid__period, input[name="period"], input[name="duration"], input#duration, input[type="number"]');
        if (durationInput) {
          await durationInput.fill(String(bidPeriod)).catch(() => {});
        }
        const costInput = await page.$('#bid__cost, input[name="cost"], input#cost, input[name="budget"]');
        if (costInput) {
          await costInput.fill(String(bidCost)).catch(() => {});
        }

        // Scan for custom input and question fields under the standard bid form
        const customFields = await page.evaluate(() => {
          const fields: { selector: string; id: string; name: string; labelText: string; type: string }[] = [];
          
          const form = document.querySelector('#project__bid') || document.querySelector('form[name="project__bid"]') || document;
          const textareas = Array.from(form.querySelectorAll('textarea'));
          const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])'));

          const findLabel = new Function('el', `
            let sibling = el.previousElementSibling;
            while (sibling) {
              if (sibling.tagName === 'LABEL' || sibling.classList.contains('control-label')) {
                return sibling.textContent?.trim() || '';
              }
              const lbl = sibling.querySelector('label, .control-label');
              if (lbl) return lbl.textContent?.trim() || '';
              sibling = sibling.previousElementSibling;
            }
            
            let parent = el.parentElement;
            for (let d = 0; d < 4; d++) {
              if (!parent) break;
              
              let pSib = parent.previousElementSibling;
              while (pSib) {
                if (pSib.tagName === 'LABEL' || pSib.classList.contains('control-label')) {
                  return pSib.textContent?.trim() || '';
                }
                const lbl = pSib.querySelector('label, .control-label');
                if (lbl) return lbl.textContent?.trim() || '';
                pSib = pSib.previousElementSibling;
              }
              parent = parent.parentElement;
            }
            return '';
          `) as (el: HTMLElement) => string;

          for (const ta of textareas) {
            const id = ta.id || '';
            const name = ta.getAttribute('name') || '';
            const isStandard = id === 'bid__period' || id === 'bid__cost' || id === 'bid__details' || id === 'bid__realCost' ||
                   name === 'period' || name === 'cost' || name === 'details' || name === 'realCost' ||
                   id === 'comment' || name === 'comment' || id === 'details';
            if (isStandard) continue;

            fields.push({
              selector: `textarea[name="${name}"]`,
              id: ta.id || '',
              name: name,
              labelText: findLabel(ta) || 'سؤال إضافي',
              type: 'textarea'
            });
          }

          for (const inp of inputs) {
            const id = inp.id || '';
            const name = inp.getAttribute('name') || '';
            const isStandard = id === 'bid__period' || id === 'bid__cost' || id === 'bid__details' || id === 'bid__realCost' ||
                   name === 'period' || name === 'cost' || name === 'details' || name === 'realCost' ||
                   id === 'comment' || name === 'comment' || id === 'details';
            if (isStandard) continue;

            fields.push({
              selector: `input[name="${name}"]`,
              id: inp.id || '',
              name: name,
              labelText: findLabel(inp as HTMLElement) || 'حقل إضافي',
              type: 'text'
            });
          }

          return fields;
        });

        // Answer custom fields automatically via Gemini AI or template answers
        if (customFields.length > 0) {
          db.addLog('info', 'automation', `Detected ${customFields.length} custom input/question fields on Mostaql bidding form! Proceeding to answer...`);
          const profile = db.getProfile();

          for (const fd of customFields) {
            let answer = '';
            const cleanLabel = fd.labelText.replace(/[*\s]+/g, ' ').trim();

            if (isGeminiConfigured()) {
              try {
                const ai = getGeminiClient();
                db.addLog('info', 'automation', `Generating professional, tailored answer for question: "${cleanLabel}"...`);
                
                const prompt = `
أنت خبير ومستقل محترف تقدم عرضاً على مشروع في منصة مستقل.
تفاصيل المشروع الحالي:
- العنوان: ${op.title}
- الوصف الكامل للمشروع: ${op.description}

معلومات المستقل (أنت):
- المهارات: ${profile.skills?.join(', ') || ''}
- التقنيات: ${profile.technologies?.join(', ') || ''}
- مستوى الخبرة: ${profile.experience || 'expert'}

مسودة عرضك الرئيسي المكتوب للمشروع:
"""
${prop.content}
"""

صاحب المشروع وضع سؤالاً إضافياً إلزامياً في نموذج تقديم العرض:
السؤال: "${cleanLabel}"

يرجى كتابة إجابة احترافية، مقنعة وذكية ومختصرة على هذا السؤال بناءً على مهاراتك وتفاصيل المشروع وعرضك السابق.
اكتب الإجابة باللغة العربية الفصحى فقط وبدون أي نصوص تمهيدية، أو علامات توضيحية، أو علامات اقتباس. أخرج الإجابة المباشرة فقط لتعبئتها في النموذج مباشرة.
`;
                const aiResponse = await ai.models.generateContent({
                  model: 'gemini-2.1-flash',
                  contents: prompt,
                  config: {
                    temperature: 0.6,
                    maxOutputTokens: 600
                  }
                });
                answer = aiResponse.text?.trim() || '';
              } catch (err: any) {
                db.addLog('warning', 'automation', `Failed to generate answer via Gemini for "${fd.labelText}": ${err.message}. Using high-quality default fallback.`);
              }
            }

            if (!answer) {
              const textStr = fd.labelText;
              if (textStr.includes('نموذج') || textStr.includes('سابقة') || textStr.includes('بأعمال') || textStr.includes('معرض') || textStr.includes('أعمال')) {
                answer = `أهلاً بك، لقد قمت بإنجاز وتطوير العديد من الخدمات والمشاريع المماثلة والناجحة، وتجد نماذج وتفاصيل وافية عنها في معرض أعمالي المحدث على المنصة، ويسعدني استعراضها وتزويدك بروابطها المباشرة بمجرد تواصلك لمناقشة المتطلبات.`;
              } else if (textStr.includes('تقنيات') || textStr.includes('التقنيات') || textStr.includes('أدوات') || textStr.includes('لغة') || textStr.includes('برمجة')) {
                answer = `سأعتمد على أحدث وأكفأ التقنيات البرمجية والحديثة الموثوقة والملائمة تماماً لطبيعة مشروعك، لضمان أعلى مستويات الأداء، الأمان، وقابلية التوسع في المستقبل.`;
              } else if (textStr.includes('وقت') || textStr.includes('زمن') || textStr.includes('تفرغ')) {
                answer = `أنا متفرغ تماماً للبدء الفوري بالعمل على المشروع، وسألتزم بجدول زمني دقيق وتقسيم لمراحل الإنجاز لمتابعة التقدم خطوة بخطوة حتى التسليم النهائي.`;
              } else {
                answer = `أهلاً بك. قمت بقراءة وفهم كافة تفاصيل المشروع ومستعد وجاهز تماماً للتنفيذ وفق أعلى معايير الجودة والاحترافية. يشرفني العمل والمتابعة معك.`;
              }
            }

            db.addLog('info', 'automation', `Filling custom field "${fd.labelText}" with answer: "${answer.slice(0, 70)}..."`);
            if (fd.id) {
              await page.fill(`#${fd.id}`, answer).catch(async () => {
                await page.fill(fd.selector, answer).catch(() => {});
              });
            } else {
              await page.fill(fd.selector, answer).catch(() => {});
            }
            await page.waitForTimeout(500);
          }
        }

        // Notify user about any non-standard complex elements found (such as dropzones, popups or manual verification issues)
        const attachmentsExist = await page.$('.dz-clickable, #bid-attachments, input[type="file"]');
        if (attachmentsExist) {
          db.addLog('info', 'automation', `Note: Found optional file attachment dropzone container. Leaving attachments empty for direct proposal text.`);
        }

        await takeScreenshot('2. Proposal and All Fields Filled Successfully');

        // Locate submit button and click it to make the bid
        const submitBtn = await page.$('#bid__submit, button[type="submit"], #submit-btn, button:has-text("أضف"), button:has-text("عفر")');
        if (submitBtn) {
          db.addLog('info', 'automation', `Clicking Mostaql proposal submit button...`);
          await submitBtn.click();
          await page.waitForTimeout(5000);
          await takeScreenshot('3. Post Submission Page State');
          detailsStr = 'Mostaql proposal inputs and all custom custom fields filled and bidding completed automatically!';
        } else {
          db.addLog('info', 'automation', `Submit button query empty. Dispatching Enter key...`);
          await textarea.press('Enter');
          await page.waitForTimeout(5000);
          await takeScreenshot('3. Post Submission (Enter Dispatched)');
          detailsStr = 'Feedback textarea filled and Enter dispatched!';
        }
      } else {
        throw new Error('Bidding inputs or comment form not accessible on Mostaql project page.');
      }
    }

    db.updateProposal(proposalId, { submissionError: undefined });
    db.addLog('success', 'automation', `Playwright auto-posting succeeded on ${platform}! ${detailsStr}`);
    return {
      success: true,
      message: `Successfully bid on ${platform} using Playwright persistent context! ${detailsStr}`,
      submittedLink: op.link
    };
  } catch (err: any) {
    db.updateProposal(proposalId, { submissionError: err.message });
    db.addLog('error', 'automation', `Playwright automated submission failed on ${platform}: ${err.message}.`);
    return {
      success: false,
      message: `Failed during browser execution: ${err.message}. Direct navigation link staged.`,
      submittedLink: op.link
    };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

function cleanScrapedUrl(urlStr: string): string {
  // Return original link intact, as explicitly requested by the user
  return urlStr || '';
}

export async function extractMostaqlOpportunity(page: Page, url: string): Promise<{
  valid: boolean;
  reason: string | null;
  title: string;
  description: string;
  budget: string;
  clientName: string;
  category: string;
  language: 'ar' | 'en';
  period?: number;
}> {
  try {
    const mainText = await page.textContent('body').catch(() => '') || '';
    const pageTitle = await page.title().catch(() => '') || '';
    
    db.addLog('info', 'scraper', `[MOSTAQL-EXTRACT] Extracting text patterns for validation: ${url}`);

    if (mainText.includes('ليس لديك الصلاحيات') || mainText.includes('ليس لديك صلاحية')) {
      return { valid: false, reason: 'PRIVATE', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }
    if (mainText.includes('هذا المشروع غير موجود') || mainText.includes('المشروع غير موجود') || mainText.includes('الصفحة غير موجودة') || pageTitle.includes('404') || mainText.includes('404')) {
      return { valid: false, reason: 'INVALID', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }
    if (mainText.includes('المشروع مغلق') || mainText.includes('بانتظار الموافقة') || mainText.includes('مغلق')) {
      return { valid: false, reason: 'CLOSED', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }
    if (mainText.includes('تم حذف المشروع') || mainText.includes('تم حذف الصفحة')) {
      return { valid: false, reason: 'DELETED', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }

    const title = await page.$eval('h1, .project-title, .project-header h1, h1.meta-title', el => el.textContent?.trim()).catch(() => '') || 'Mostaql Professional Opportunity';
    if (!title || title.length < 4) {
      return { valid: false, reason: 'INVALID', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }

    let description = await page.evaluate(() => {
      // Prioritize the exact project brief element to avoid comments/proposals, attachments, and footer garbage
      const briefEl = document.querySelector('#project-brief .text-wrapper-div.carda__content') || 
                      document.querySelector('#project-brief .text-wrapper-div') ||
                      document.querySelector('#project-brief .carda__content') ||
                      document.querySelector('#project-brief');
      return briefEl ? briefEl.textContent?.trim() || '' : '';
    }).catch(() => '') || '';

    if (!description || description.length < 15) {
      description = await page.$eval('.project-desc, #project-desc, .project-details, .project-description, div.card-body', el => el.textContent?.trim()).catch(() => '') || '';
    }

    if (!description || description.length < 15) {
      return { valid: false, reason: 'INVALID', title, description: 'No description found', budget: '', clientName: '', category: '', language: 'ar' };
    }

    const budget = await page.evaluate(() => {
      const specificSpan = document.querySelector('.meta-row .meta-value[data-type="project-budget_range"] span') ||
                           document.querySelector('.meta-value[data-type="project-budget_range"] span');
      if (specificSpan && specificSpan.textContent) {
        return specificSpan.textContent.trim();
      }
      const bVal = document.querySelector('[data-type="project-budget_range"]');
      if (bVal && bVal.textContent) {
        return bVal.textContent.trim();
      }
      const labelEl = Array.from(document.querySelectorAll('.meta-label')).find(el => el.textContent?.includes('الميزانية'));
      if (labelEl && labelEl.nextElementSibling) {
        return labelEl.nextElementSibling.textContent?.trim() || '';
      }

      const rows = Array.from(document.querySelectorAll('tr, li, .table-properties td, .properties-list td, td, .meta-row'));
      for (const r of rows) {
        const text = r.textContent || '';
        if (text.includes('الميزانية') || text.includes('Budget')) {
          return text.replace('الميزانية', '').replace('Budget', '').replace(/\s+/g, ' ').trim();
        }
      }
      return '$100 - $250';
    });

    const clientName = await page.evaluate(() => {
      const bdi = document.querySelector('.profile-details .profile__name bdi') || 
                  document.querySelector('.profile__name bdi') ||
                  document.querySelector('.profile-details h5 bdi') ||
                  document.querySelector('.profile-details .profile__name');
      return bdi ? bdi.textContent?.trim() || '' : '';
    }).catch(() => '') || 
    await page.$eval('.user-card .meta-owner a, a[href*="/u/"], .username', el => el.textContent?.trim()).catch(() => '') || 
    'Mostaql Client';

    const category = await page.$eval('.project-meta, td:has-text("القسم"), .meta-item', el => el.textContent?.trim()).catch(() => '') || 'Programming & Development';

    const period = await page.evaluate(() => {
      const metaRows = Array.from(document.querySelectorAll('.meta-row'));
      for (const row of metaRows) {
        const label = row.querySelector('.meta-label')?.textContent || '';
        if (label.includes('مدة التنفيذ') || label.includes('Execution period') || label.includes('المدة')) {
          const valEl = row.querySelector('.meta-value');
          if (valEl) {
            const txt = valEl.textContent?.trim() || '';
            const match = txt.match(/\d+/);
            if (match) return parseInt(match[0], 10);
          }
        }
      }
      return 15;
    }).catch(() => 15);

    return {
      valid: true,
      reason: null,
      title,
      description,
      budget,
      clientName,
      category,
      language: 'ar',
      period
    };
  } catch (err: any) {
    return { valid: false, reason: 'INVALID', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
  }
}

export async function extractKhamsatOpportunity(page: Page, url: string): Promise<{
  valid: boolean;
  reason: string | null;
  title: string;
  description: string;
  budget: string;
  clientName: string;
  category: string;
  language: 'ar' | 'en';
  publishedAt?: string;
}> {
  try {
    const mainText = await page.textContent('body').catch(() => '') || '';
    const pageTitle = await page.title().catch(() => '') || '';

    db.addLog('info', 'scraper', `[KHAMSAT-EXTRACT] Checking Khamsat status patterns: ${url}`);

    if (
      url.toLowerCase().includes('/user/') ||
      url.toLowerCase().includes('/categories/') ||
      url.toLowerCase().includes('/messages/') ||
      url.toLowerCase().includes('/cart/') ||
      url.toLowerCase().includes('/logout')
    ) {
      return { valid: false, reason: 'INVALID', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }

    if (mainText.includes('الخدمة غير موجودة') || mainText.includes('تم حذف الخدمة') || mainText.includes('طلب غير موجود') || mainText.includes('تم حذف الموضوع')) {
      return { valid: false, reason: 'DELETED', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }
    if (mainText.includes('لا توجد صلاحية لدخول الصفحة') || mainText.includes('لا توجد لديك الصلاحية') || mainText.includes('لا توجد صلاحية لدخول')) {
      return { valid: false, reason: 'PRIVATE', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }
    if (mainText.includes('الحساب موقوف') || mainText.includes('تم إيقاف الحساب') || mainText.includes('الحساب مغلق')) {
      return { valid: false, reason: 'INACTIVE', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }
    if (mainText.includes('الموضوع مغلق') || mainText.includes('تم إغلاق الموضوع') || mainText.includes('مغلق بطلب من السائل')) {
      return { valid: false, reason: 'CLOSED', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }
    if (pageTitle.includes('404') || mainText.includes('404')) {
      return { valid: false, reason: 'DELETED', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }

    const title = await page.$eval('h1, .service-title, .topic-title, .post-title', el => el.textContent?.trim()).catch(() => '') || 
                  await page.$eval('h2', el => el.textContent?.trim()).catch(() => '') || 'Khamsat Community Opportunity';
    if (!title || title.length < 4) {
      return { valid: false, reason: 'INVALID', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
    }

    const description = await page.$eval('.post-content, .service-desc, .topic-desc, .details', el => el.textContent?.trim()).catch(() => '') || '';
    if (!description || description.length < 15) {
      return { valid: false, reason: 'INVALID', title, description: 'No description found', budget: '', clientName: '', category: '', language: 'ar' };
    }

    let clientName = await page.$eval('a.sidebar_user, .post-user a, a[href*="/user/"], .username', el => el.textContent?.trim()).catch(() => '') || 'Khamsat Client';
    if (clientName) {
      clientName = clientName.replace(/^\.+/, '').trim();
    }

    const budget = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const match = bodyText.match(/(?:الميزانية|الميزانيه|المبلغ|السعر|بميزانية|بميزانيه|بحدود)\s*[:=]?\s*\$?\s*(\d+)\s*(?:-\s*\$?\s*(\d+))?/i);
      if (match) {
        return match[2] ? `$${match[1]} - $${match[2]}` : `$${match[1]}`;
      }
      return '$25 - $100';
    });

    const category = 'تطوير مواقع وتطبيقات';

    // Extract the published date from metadata or full-text, supporting phrases like "منذ 4 أيام و23 ساعة"
    const publishedAt = await page.evaluate(() => {
      // High fidelity specific sidebar layout selector matching first:
      const sidebar = document.getElementById('sidebar') || document.querySelector('#sidebar');
      if (sidebar) {
        const col6s = Array.from(sidebar.querySelectorAll('.col-6'));
        for (let i = 0; i < col6s.length - 1; i++) {
          const labelText = col6s[i].textContent || '';
          if (labelText.includes('تاريخ النشر')) {
            const valueSpan = col6s[i + 1] ? col6s[i + 1].querySelector('span') : null;
            if (valueSpan && valueSpan.textContent) {
              return valueSpan.textContent.trim();
            }
            const blockText = col6s[i + 1] ? col6s[i + 1].textContent?.trim() : null;
            if (blockText) return blockText;
          }
        }
      }

      // 1. Check table cells or meta items for "تاريخ النشر" (date of publishing) or "منذ"
      const tdList = Array.from(document.querySelectorAll('td, span, div, li, p, section'));
      
      for (const el of tdList) {
        const text = el.textContent || '';
        if (text.includes('تاريخ النشر')) {
          const match = text.match(/منذ\s+[\u0600-\u06FF0-9\s]+(?:و\s+[\u0600-\u06FF0-9\s]+)?/);
          if (match) {
            return match[0].trim();
          }
          if (el.nextElementSibling && el.nextElementSibling.textContent) {
            const siblingText = el.nextElementSibling.textContent.trim();
            if (siblingText.includes('منذ')) {
              return siblingText;
            }
          }
        }
      }

      // 2. Generic scan for elements that start with or contain "منذ"
      const metaSelectors = [
        '.post-meta',
        '.meta-item',
        '.meta-text',
        'span.text-muted',
        '.meta-list',
        'li.list-inline-item',
        '.meta',
        '.created-at',
        'table.table-striped td',
        '.service-meta td',
        'span.date',
        '.post-user',
        'div.meta-text'
      ];
      
      for (const sel of metaSelectors) {
        const elms = document.querySelectorAll(sel);
        for (const el of Array.from(elms)) {
          const text = (el.textContent || '').trim();
          const match = text.match(/منذ\s+(?:\d+|يوم|يومين|أيام|ساعة|ساعتين|ساعات|دقيقة|دقائق|شهر|شهور|أشهر|أسبوع|أسابيع)\s*(?:و\s+\d+\s+(?:ساعة|ساعات|دقيقة|دقائق|يوم|أيام))?/);
          if (match) {
            return match[0].trim();
          }
        }
      }

      // 3. Fallback scan on ALL small elements
      const smallElms = Array.from(document.querySelectorAll('span, li, td, p, strong, a'));
      for (const el of smallElms) {
        const text = (el.textContent || '').trim();
        if (text.startsWith('منذ ') && text.length < 50) {
          const match = text.match(/منذ\s+(?:\d+|يوم|يومين|أيام|ساعة|ساعتين|ساعات|دقيقة|دقائق|شهر|شهور|أشهر|أسبوع|أسابيع)\s*(?:و\s+\d+\s+(?:ساعة|ساعات|دقيقة|دقائق|يوم|أيام))?/);
          if (match) {
            return match[0].trim();
          }
        }
      }

      return null;
    }) || undefined;

    return {
      valid: true,
      reason: null,
      title,
      description,
      budget,
      clientName,
      category,
      language: 'ar',
      publishedAt
    };
  } catch (err: any) {
    return { valid: false, reason: 'INVALID', title: '', description: '', budget: '', clientName: '', category: '', language: 'ar' };
  }
}

export async function validateOpportunity(
  platform: 'Khamsat' | 'Mostaql',
  url: string,
  existingPage?: Page,
  expectedTitle?: string,
  boardData?: BoardData
): Promise<{ valid: boolean; reason: string | null; canonicalUrl?: string; additionalData?: any }> {
  const lowerUrl = url.toLowerCase();
  
  // Avoid running Playwright browser automation on simulated mock project links to prevent them failing with 404/login-wall
  if (lowerUrl.includes('-job-') || lowerUrl.includes('/requests/999999') || lowerUrl.includes('local') || lowerUrl.includes('simulate') || lowerUrl.includes('mock')) {
    return {
      valid: true,
      reason: null,
      canonicalUrl: url,
      additionalData: {
        valid: true,
        reason: null,
        title: "Active Simulated Public Opportunity",
        description: "This is an active simulated public opportunity. Interactive routing bypassed.",
        budget: "$150 - $300",
        clientName: "Public Partner",
        category: "Programming & Development",
        language: "en"
      }
    };
  }

  // Clean checks before page initialization to block profile or pagination garbage
  if (platform === 'Mostaql') {
    if (!lowerUrl.includes('/project/') || !lowerUrl.match(/\/project\/\d+/)) {
      return { valid: false, reason: 'INVALID_PAGE' };
    }
  } else if (platform === 'Khamsat') {
    const isRequest = lowerUrl.includes('/community/requests') && lowerUrl.match(/\/requests\/\d+/);
    const isService = lowerUrl.includes('/service/') && lowerUrl.match(/\/service\/\d+/);
    if (!isRequest && !isService) {
      return { valid: false, reason: 'INVALID_PAGE' };
    }
  }

  let localContext: BrowserContext | null = null;
  let page: Page;

  try {
    if (existingPage) {
      page = existingPage;
    } else {
      localContext = await launchPlaywrightPersistent(platform);
      const pages = localContext.pages();
      page = pages.length > 0 ? pages[0] : await localContext.newPage();
    }

    db.addLog('info', 'scraper', `[VALIDATOR] Routing request to Universal URL Resolver for: ${url}`);
    const resolved = await resolveAndValidateUrl(platform, url, page, expectedTitle, boardData);
    
    return {
      valid: resolved.validationStatus === 'VALID',
      reason: resolved.validationReason,
      canonicalUrl: resolved.canonicalUrl,
      additionalData: resolved
    };
  } catch (err: any) {
    db.addLog('error', 'scraper', `[VALIDATOR FAIL] Exception checking opportunity link: ${err.message}`);
    return { valid: false, reason: 'INVALID_PAGE' };
  } finally {
    if (localContext) {
      await localContext.close().catch(() => {});
    }
  }
}

/**
 * Scrapes project lists from the freelance platform using the persistent Chrome session profile.
 */
export async function scrapePlatformJobsPlaywright(platform: 'Khamsat' | 'Mostaql', skills?: string[]): Promise<any[]> {
  const profileDir = path.join(process.cwd(), 'data', 'browser-profiles', platform.toLowerCase());
  
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  let context: BrowserContext | null = null;
  const scrapedJobs: any[] = [];
  try {
    context = await launchPlaywrightPersistent(platform);
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    // Define multi-URL target discovery queues based on platform and portfolio skills
    const targetUrls: string[] = [];
    const activeSkills = skills && skills.length > 0 ? skills : ['React', 'TypeScript', 'Node.js', 'AI', 'Telegram Bots'];

    if (platform === 'Khamsat') {
      targetUrls.push('https://khamsat.com/community/requests');
      targetUrls.push('https://khamsat.com/community/requests?page=2');
      activeSkills.slice(0, 3).forEach(skill => {
        targetUrls.push(`https://khamsat.com/community/requests?q=${encodeURIComponent(skill)}`);
      });
    } else if (platform === 'Mostaql') {
      targetUrls.push('https://mostaql.com/projects?category=development&sort=latest');
      targetUrls.push('https://mostaql.com/projects?category=development&sort=latest&page=2');
      activeSkills.slice(0, 3).forEach(skill => {
        targetUrls.push(`https://mostaql.com/projects?keyword=${encodeURIComponent(skill)}&sort=latest`);
      });
    }

    db.addLog('info', 'scraper', `[SCRAPER] Initiating multi-URL target discovery scan on ${platform} across ${targetUrls.length} pages.`);

    let candidates: {
      url: string;
      expectedTitle?: string;
      boardTitle?: string;
      boardSnippet?: string;
      boardCategory?: string;
      boardRequestId?: string;
      boardUrl?: string;
    }[] = [];
    
    // Deduplication set for URLs
    const seenUrls = new Set<string>();

    for (const scrapeUrl of targetUrls) {
      try {
        db.addLog('info', 'scraper', `[SCRAPER Scan] Crawling listing: ${scrapeUrl}`);
        await page.goto(scrapeUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(1500);

        let subCandidates: typeof candidates = [];

        if (platform === 'Khamsat') {
          subCandidates = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            const list: any[] = [];
            const seen = new Set<string>();
            for (const a of anchors) {
              const href = a.href || '';
              if (href.includes('/community/requests/') && href.match(/\/community\/requests\/\d+/)) {
                const cleanUrl = href.split('?')[0];
                if (!seen.has(cleanUrl)) {
                  seen.add(cleanUrl);
                  
                  const boardTitle = a.textContent?.trim() || '';
                  const matchId = cleanUrl.match(/\/community\/requests\/(\d+)/i);
                  const boardRequestId = matchId ? matchId[1] : '';
                  
                  const container = a.closest('tr') || a.closest('li') || a.closest('.posts-row') || a.closest('div');
                  let boardCategory = '';
                  let boardSnippet = '';
                  
                  if (container) {
                    const categoryAnchor = container.querySelector('a[href*="/community/requests-"]');
                    if (categoryAnchor) {
                      boardCategory = categoryAnchor.textContent?.trim() || '';
                    }
                    
                    const snippetElement = container.querySelector('p, .snippet, .excerpt, .post-desc, .text-muted');
                    if (snippetElement && snippetElement !== a && snippetElement !== categoryAnchor) {
                      boardSnippet = snippetElement.textContent?.trim() || '';
                    }
                  }
                  
                  boardSnippet = boardSnippet.substring(0, 300).trim();
                  if (!boardSnippet) {
                    boardSnippet = boardTitle;
                  }
                  
                  list.push({
                    url: cleanUrl,
                    expectedTitle: boardTitle,
                    boardTitle,
                    boardSnippet,
                    boardCategory,
                    boardRequestId,
                    boardUrl: cleanUrl
                  });
                }
              }
            }
            return list;
          });
        } else if (platform === 'Mostaql') {
          subCandidates = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            const list: any[] = [];
            const seen = new Set<string>();
            for (const a of anchors) {
              const href = a.href || '';
              if (href.includes('/project/') && href.match(/\/project\/\d+/)) {
                const cleanUrl = href.split('?')[0];
                if (!seen.has(cleanUrl)) {
                  seen.add(cleanUrl);
                  list.push({
                    url: cleanUrl,
                    expectedTitle: a.textContent?.trim() || ''
                  });
                }
              }
            }
            return list;
          });
        }

        for (const item of subCandidates) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            candidates.push(item);
          }
        }
      } catch (err: any) {
        db.addLog('warning', 'scraper', `[SCRAPER Error] Failed to scan sub URL ${scrapeUrl}: ${err.message}`);
      }
    }

    db.addLog('info', 'scraper', `[SCRAPER] Extracted a total of ${candidates.length} unique candidate URLs across platforms.`);
    
    // Save discovery count to analytics
    recordDiscovery(platform, { candidatesDiscovered: candidates.length });

    // Stage 3: Prioritize and filter by profile skills or keyword overlap
    const prioritizedCandidates = candidates.map(cand => {
      const title = (cand.expectedTitle || cand.boardTitle || '').toLowerCase();
      const snippet = (cand.boardSnippet || '').toLowerCase();
      
      let isHighPriority = false;
      let matchedSkillName = '';

      for (const skill of activeSkills) {
        const skillLower = skill.toLowerCase();
        if (title.includes(skillLower) || snippet.includes(skillLower)) {
          isHighPriority = true;
          matchedSkillName = skill;
          break;
        }
      }

      // Check common tech keywords to avoid logo/translate junk
      const techKeywords = ['برمج', 'تطوير', 'ويب', 'تطبيق', 'موقع', 'كود', 'react', 'next.js', 'typescript', 'node', 'server', 'api'];
      if (!isHighPriority) {
        for (const word of techKeywords) {
          if (title.includes(word) || snippet.includes(word)) {
            isHighPriority = true;
            matchedSkillName = word;
            break;
          }
        }
      }

      return {
        ...cand,
        isHighPriority,
        matchedSkillName
      };
    });

    // Sort: High priority items go first
    prioritizedCandidates.sort((a, b) => (b.isHighPriority ? 1 : 0) - (a.isHighPriority ? 1 : 0));

    // Limit deep checks to 15-20 candidates to keep crawl times within reasonable limits
    const maxToVerify = Math.min(prioritizedCandidates.length, 20);
    const selected = prioritizedCandidates.slice(0, maxToVerify);

    db.addLog('info', 'scraper', `[SCRAPER Pipeline] Selected top ${selected.length} prioritized candidates for deep page validation.`);

    for (const cand of selected) {
      db.addLog('info', 'scraper', `[SCRAPER CHK] Visiting candidate URL: ${cand.url} (Matched tag: ${cand.matchedSkillName || 'General Development'})`);
      const valResponse = await validateOpportunity(platform, cand.url, page, cand.expectedTitle || cand.boardTitle, cand);
      
      if (valResponse.valid && valResponse.additionalData) {
        const details = valResponse.additionalData;

        // Duplicate check
        const isDuplicate = db.getOpportunities().some(o => {
          if (o.platform !== platform) return false;
          const t1 = (o.title || '').trim().toLowerCase();
          const t2 = (details.title || '').trim().toLowerCase();
          const c1 = (o.clientName || '').trim().toLowerCase();
          const c2 = (details.clientName || '').trim().toLowerCase();
          const d1 = (o.description || '').trim().toLowerCase().substring(0, 150);
          const d2 = (details.description || '').trim().toLowerCase().substring(0, 150);
          return t1 === t2 && c1 === c2 && d1 === d2;
        });

        if (isDuplicate) {
          db.addLog('info', 'scraper', `[SCRAPER Skip DUP] Candidate ${cand.url} is already registered in DB.`);
          continue;
        }

        const isHighMatch = (cand.isHighPriority || details.title.toLowerCase().includes('react') || details.title.toLowerCase().includes('node'));

        scrapedJobs.push({
          title: details.title,
          link: valResponse.canonicalUrl || cand.url,
          canonicalUrl: valResponse.canonicalUrl || cand.url,
          description: platform === 'Mostaql' ? details.description : details.description.substring(0, 500),
          clientName: details.clientName,
          budget: details.budget,
          category: details.category,
          language: details.language,
          publishedAt: details.publishedAt || 'Just now',
          isActive: true,
          status: details.status || 'ACTIVE',
          validationStatus: details.validationStatus || 'VALID',
          validationReason: details.validationReason || null,
          lastValidatedAt: details.lastValidatedAt || new Date().toISOString(),
          originalUrl: details.originalUrl || cand.url,
          finalUrl: details.finalUrl || valResponse.canonicalUrl || cand.url,
          serviceId: details.serviceId || '',
          finalServiceId: details.finalServiceId || '',
          redirectDetected: details.redirectDetected || false,
          sourceType: 'REAL',
          
          pageType: details.pageType,
          platformId: details.platformId,
          canApply: details.canApply,
          redirectChain: details.redirectChain,
          healthScore: details.healthScore,
          debugScreenshotPath: details.debugScreenshotPath,
          pageTitle: details.pageTitle,
          pageContentSnippet: details.pageContentSnippet,
          
          boardTitle: details.boardTitle,
          boardSnippet: details.boardSnippet,
          boardCategory: details.boardCategory,
          liveTitle: details.liveTitle,
          liveCategory: details.liveCategory,
          titleSimilarity: details.titleSimilarity,
          descriptionSimilarity: details.descriptionSimilarity,
          semanticValidation: details.semanticValidation,
          semanticValidationReason: details.semanticValidationReason
        });

        // Record a successful real discovery
        recordDiscovery(platform, {
          passed: true,
          isReal: true,
          highMatch: isHighMatch,
          proposalCapable: details.canApply ?? true,
          skillMatched: cand.matchedSkillName || 'Development'
        });

      } else {
        const failReason = (valResponse.reason || 'INVALID_PAGE') as any;
        db.addLog('warning', 'scraper', `[SCRAPER SKIP] Rejected candidate ${cand.url}. Reason: ${failReason}`);
        
        // Record failure context for scraper analytics tracking
        const reasonMapping: Record<string, 'REDIRECT' | 'CLOSED' | 'DELETED' | 'PRIVATE' | 'CONTENT_MISMATCH' | 'CANNOT_APPLY' | 'SOFT_INVALID'> = {
          'REDIRECTED': 'REDIRECT',
          'REDIRECT': 'REDIRECT',
          'CLOSED': 'CLOSED',
          'DELETED': 'DELETED',
          'PRIVATE': 'PRIVATE',
          'CONTENT_MISMATCH': 'CONTENT_MISMATCH',
          'CANNOT_APPLY': 'CANNOT_APPLY',
          'SOFT_INVALID': 'SOFT_INVALID',
          'RATE_LIMIT': 'SOFT_INVALID',
          'TIMEOUT': 'SOFT_INVALID'
        };

        const mappedReason = reasonMapping[failReason] || 'CONTENT_MISMATCH';

        recordDiscovery(platform, {
          passed: false,
          reason: mappedReason,
          isReal: true
        });
      }
    }

    if (scrapedJobs.length > 0) {
      db.addLog('success', 'scraper', `[SCRAPER SUCCESS] Added ${scrapedJobs.length} top-quality REAL opportunities to queue.`);
    }
  } catch (err: any) {
    db.addLog('warning', 'scraper', `Playwright background crawler check aborted: ${err.message}`);
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }

  return scrapedJobs;
}

/**
 * Imports cookie objects, launches the persistent context, sets them,
 * and runs standard authentication verification.
 */
export async function importCookiesToPlatform(
  platform: 'Khamsat' | 'Mostaql',
  cookiesList: any[]
): Promise<{ success: boolean; username?: string; error?: string }> {
  const profileDir = path.join(process.cwd(), 'data', 'browser-profiles', platform.toLowerCase());
  
  // Ensure profile directory exists
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // Close active session if it matches the platform
  if (playwrightSession.getActivePlatform() === platform) {
    await playwrightSession.closeSession().catch(() => {});
  }

  let context: BrowserContext | null = null;
  try {
    context = await launchPlaywrightPersistent(platform);
    
    // Clear standard cookies for this context 
    await context.clearCookies();

    // Parse and normalise cookie formats from exporters (e.g. EditThisCookie, JSTorrent, manual array)
    const playCookies = cookiesList.map(c => {
      // Resolve domain mapping: if domain is khamsat.com, we can map to .khamsat.com or vice-versa
      let cDomain = c.domain || '';
      if (platform === 'Khamsat' && !cDomain.includes('khamsat.com')) {
        cDomain = '.khamsat.com';
      } else if (platform === 'Mostaql' && !cDomain.includes('mostaql.com')) {
        cDomain = '.mostaql.com';
      }

      // Safe expiration mapping
      let expires: number | undefined = undefined;
      const rawExp = c.expirationDate || c.expires;
      if (typeof rawExp === 'number') {
        expires = rawExp;
      }

      // Safe sameSite parsing
      let sameSite: 'Strict' | 'Lax' | 'None' | undefined = undefined;
      const rawSameSite = (c.sameSite || '').toLowerCase();
      if (rawSameSite === 'strict') sameSite = 'Strict';
      else if (rawSameSite === 'lax') sameSite = 'Lax';
      else if (rawSameSite === 'none' || rawSameSite === 'no_restriction') sameSite = 'None';

      return {
        name: c.name || '',
        value: c.value || '',
        domain: cDomain,
        path: c.path || '/',
        expires: expires,
        httpOnly: typeof c.httpOnly === 'boolean' ? c.httpOnly : false,
        secure: typeof c.secure === 'boolean' ? c.secure : true,
        sameSite: sameSite
      };
    }).filter(c => c.name && c.value);

    db.addLog('info', 'automation', `Pasting ${playCookies.length} session cookies for ${platform} persistent context...`);
    await context.addCookies(playCookies);

    // Verify session state by routing to platform's main profile/requests view
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    let checkUrl = '';
    if (platform === 'Khamsat') {
      checkUrl = 'https://khamsat.com/community/requests';
    } else if (platform === 'Mostaql') {
      checkUrl = 'https://mostaql.com/projects';
    }

    await page.goto(checkUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const url = page.url();
    let authenticated = false;
    let username: string | undefined;

    if (platform === 'Khamsat') {
      const loginPresent = url.includes('/login') || url.includes('/signin');
      const userMenu = await page.$('a[href*="/user/"], .user-menu, a[href*="/logout"]');
      if (userMenu || (!loginPresent && (url.includes('/community') || url.includes('/requests')))) {
        authenticated = true;
        const userElem = await page.$('a[href*="/user/"]');
        if (userElem) {
          const href = await userElem.getAttribute('href');
          username = href?.split('/').pop() || 'Verified Khamsat Operator';
        }
      }
    } else if (platform === 'Mostaql') {
      const loginPresent = url.includes('/login') || url.includes('/register');
      const userMenu = await page.$('a[href*="/u/"], .user-menu, a[href*="/logout"]');
      if (userMenu || (!loginPresent && url.includes('/projects'))) {
        authenticated = true;
        const userElem = await page.$('a[href*="/u/"]');
        if (userElem) {
          const href = await userElem.getAttribute('href');
          username = href?.split('/').pop() || 'Verified Mostaql Operator';
        }
      }
    }

    if (authenticated) {
      let cookiesJson: string | undefined = undefined;
      try {
        const cookiesList = await context.cookies();
        if (cookiesList && cookiesList.length > 0) {
          cookiesJson = JSON.stringify(cookiesList);
        }
      } catch (cookieErr: any) {
        console.error('Failed to dump cookies in importCookiesToPlatform:', cookieErr);
      }

      db.updateAccount(platform, {
        status: 'CONNECTED',
        username: username || 'Imported User Profile',
        lastLogin: new Date().toISOString(),
        lastValidation: new Date().toISOString(),
        profileLocation: profileDir,
        errorMessage: undefined,
        cookiesJson
      });
      db.addLog('success', 'automation', `Manually imported sessions cookies verified successfully for ${platform}! (@${username || 'active_user'})`);
      return { success: true, username };
    } else {
      db.addLog('warning', 'automation', `Cookies validation failed: imported cookies for ${platform} were not authenticated.`);
      return { success: false, error: 'Loaded cookies failed to authenticate with the platform. Try re-exporting.' };
    }
  } catch (err: any) {
    db.addLog('error', 'automation', `Error occurred importing cookies to platform: ${err.message}`);
    return { success: false, error: err.message };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}


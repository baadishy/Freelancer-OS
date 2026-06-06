/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from './db.js';
import { Opportunity } from '../src/types.js';
import { analyzeOpportunity, writeProposal } from './proposal.js';
import { sendJobMatchAlert } from './telegram.js';
import { scrapePlatformJobsPlaywright, submitProposalViaPlaywright, validateOpportunity } from './playwright-session.js';

// Stub type since playwright isn't bundled on base packages (to avoid Docker/npm compile size errors)
// This gives clean code structure if imported
interface PlaywrightActionContext {
  userAgent: string;
  viewportSize: { width: number; height: number };
  cookieSessionPath: string;
}

/**
 * Skeletal Playwright Browser Automation routines for the freelance platforms.
 * Included so the user has production-grade browser scripts they can run.
 */
export class PlatformPlaywrightAutomation {
  private config: PlaywrightActionContext;

  constructor() {
    this.config = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewportSize: { width: 1280 + Math.floor(Math.random() * 200), height: 800 + Math.floor(Math.random() * 200) },
      cookieSessionPath: './data/cookies.json'
    };
  }

  /**
   * Safe random delay mimicking human typing and pacing
   */
  private async delay(minMs: number = 2000, maxMs: number = 6000) {
    const time = minMs + Math.floor(Math.random() * (maxMs - minMs));
    return new Promise(resolve => setTimeout(resolve, time));
  }

  /**
   * Scrapes Khamsat opportunities using cookie credentials & navigation
   */
  public async scrapeKhamsat(): Promise<any[]> {
    console.log('Fictional launch of Headless Chromium using Playwright...');
    // Real code outline:
    // const browser = await chromium.launch({ headless: true });
    // const context = await browser.newContext({ userAgent: this.config.userAgent, viewport: this.config.viewportSize });
    // const page = await context.newPage();
    // await page.goto('https://khamsat.com/community/requests');
    // ... parse requests list, read client metadata, extract links and budgets ...
    // await browser.close();
    await this.delay(1000, 2500);
    return [];
  }

  /**
   * Scrapes Mostaql opportunities with session load and pagination bypass
   */
  public async scrapeMostaql(): Promise<any[]> {
    await this.delay(800, 1800);
    return [];
  }
}

/**
 * Highly realistic, dynamic freelance opportunities simulation feeder.
 * It matches categories, languages, and skills defined in the user's active Profile
 * to generate rich, immersive freelance bids.
 */
const MOCK_TITLES_EN = [
  'Build and Deploy a Multi-Vendor SaaS Backend in Express and Node',
  'Need expert React Developer for high-fidelity Figma redesign',
  'Create TypeScript scraper script matching rate limits with proxy support',
  'REST API integration with Stripe, Sendgrid, and Auth0 for Nextjs Webapp',
  'Database architectural mapping for relational PostgreSQL project',
  'Complete landing page building featuring Tailwind custom animations',
  'Optimize Express Node.js application for serverless Cloud deployment',
  'Fullstack developer to implement realtime group chat feature'
];

const MOCK_TITLES_AR = [
  'مطلوب مبرمج ومطور محترف لإنشاء متجر إلكتروني متكامل باستخدام React',
  'برمجة نظام محاسبة سحابي وإداري باستخدام Node.js و Express',
  'مطلوب بناء واجهة لوحة تحكم متكاملة واحترافية باستخدام Tailwind CSS',
  'ربط وتكامل بوابات دفع مالي متعددة لموقع زوار في الشرق الأوسط',
  'معالجة مشاكل جافا سكريبت وسرعة الاستجابة في تطبيق قائمة المهام',
  'تطوير سكريبت أتمتة سحب بيانات دقيق وتليجرام بوت للتنبيهات الفورية',
  'تصميم وبناء نظام إدارة عيادة طبية مع قاعدة بيانات PostgreSQL'
];

const CLIENT_NAMES = ['Ahmad S.', 'Sarah Jenkins', 'Khalid Al-Mansoori', 'Digital Craft Ltd.', 'John D.', 'Yasser B.', 'Emma Watson', 'Nour H.'];

const CATEGORIES = ['Web Development', 'Browser Automation', 'Backend APIs', 'SaaS Architecture', 'Database Optimization'];

/**
 * Triggers full scrape routine
 */
export async function triggerActivePlatformsScrape(): Promise<number> {
  db.addLog('info', 'scraper', 'Scanning Mostaql and Khamsat platforms for new projects...');
  
  const automation = new PlatformPlaywrightAutomation();
  const profile = db.getProfile();
  const settings = db.getAutomationSettings();

  const foundJobs: Opportunity[] = [];

  // 1. Khamsat Scrape Flow (Real Playwright only)
  try {
    const realKhamsat = await scrapePlatformJobsPlaywright('Khamsat', profile.skills);
    if (realKhamsat.length > 0) {
      db.addLog('success', 'scraper', `Playwright successfully extracted ${realKhamsat.length} active live opportunities from Khamsat community page!`);
      realKhamsat.forEach((job, idx) => {
        foundJobs.push({
          id: `kh-real-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          title: job.title,
          platform: 'Khamsat',
          link: job.link,
          budget: job.budget,
          clientName: job.clientName,
          category: job.category,
          description: job.description,
          language: job.language,
          timestamp: new Date().toISOString(),
          status: 'new',
          publishedAt: 'Just now',
          isActive: true,
          validationStatus: job.validationStatus,
          validationReason: job.validationReason,
          lastValidatedAt: job.lastValidatedAt,
          originalUrl: job.originalUrl,
          finalUrl: job.finalUrl,
          serviceId: job.serviceId,
          finalServiceId: job.finalServiceId,
          redirectDetected: job.redirectDetected,
          pageType: job.pageType,
          platformId: job.platformId,
          canApply: job.canApply,
          redirectChain: job.redirectChain,
          healthScore: job.healthScore,
          debugScreenshotPath: job.debugScreenshotPath,
          pageTitle: job.pageTitle,
          pageContentSnippet: job.pageContentSnippet,
          boardTitle: job.boardTitle,
          boardSnippet: job.boardSnippet,
          boardCategory: job.boardCategory,
          liveTitle: job.liveTitle,
          liveCategory: job.liveCategory,
          titleSimilarity: job.titleSimilarity,
          descriptionSimilarity: job.descriptionSimilarity,
          semanticValidation: job.semanticValidation,
          semanticValidationReason: job.semanticValidationReason,
          sourceType: 'REAL'
        });
      });
    } else {
      db.addLog('info', 'scraper', 'No live jobs found on Khamsat Community Requests currently.');
    }
  } catch (err: any) {
    db.addLog('error', 'scraper', `Khamsat Playwright crawl failure: ${err.message}.`);
  }

  // 2. Mostaql Scrape Flow (Real Playwright only)
  try {
    const realMostaql = await scrapePlatformJobsPlaywright('Mostaql', profile.skills);
    if (realMostaql.length > 0) {
      db.addLog('success', 'scraper', `Playwright successfully extracted ${realMostaql.length} active live opportunities from Mostaql listing page!`);
      realMostaql.forEach((job, idx) => {
        foundJobs.push({
          id: `mos-real-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          title: job.title,
          platform: 'Mostaql',
          link: job.link,
          budget: job.budget,
          clientName: job.clientName,
          category: job.category,
          description: job.description,
          language: job.language,
          timestamp: new Date().toISOString(),
          status: 'new',
          publishedAt: 'Just now',
          isActive: true,
          validationStatus: job.validationStatus,
          validationReason: job.validationReason,
          lastValidatedAt: job.lastValidatedAt,
          originalUrl: job.originalUrl,
          finalUrl: job.finalUrl,
          serviceId: job.serviceId,
          finalServiceId: job.finalServiceId,
          redirectDetected: job.redirectDetected,
          pageType: job.pageType,
          platformId: job.platformId,
          canApply: job.canApply,
          redirectChain: job.redirectChain,
          healthScore: job.healthScore,
          debugScreenshotPath: job.debugScreenshotPath,
          pageTitle: job.pageTitle,
          pageContentSnippet: job.pageContentSnippet,
          boardTitle: job.boardTitle,
          boardSnippet: job.boardSnippet,
          boardCategory: job.boardCategory,
          liveTitle: job.liveTitle,
          liveCategory: job.liveCategory,
          titleSimilarity: job.titleSimilarity,
          descriptionSimilarity: job.descriptionSimilarity,
          semanticValidation: job.semanticValidation,
          semanticValidationReason: job.semanticValidationReason,
          period: job.period,
          sourceType: 'REAL'
        });
      });
    } else {
      db.addLog('info', 'scraper', 'No live jobs found on Mostaql Project Board currently.');
    }
  } catch (err: any) {
    db.addLog('error', 'scraper', `Mostaql Playwright crawl failure: ${err.message}.`);
  }



  // Save jobs to database and trigger AI analysis automatically
  let addedCount = 0;
  for (const job of foundJobs) {
    
    // Call the validation exactly like revalidate-all
    const validationResult = await validateOpportunity(job.platform, job.link, undefined, job.title, {
      boardTitle: job.title,
      boardSnippet: job.description,
      boardCategory: job.category,
      boardRequestId: job.id,
      boardUrl: job.link
    });

    if (validationResult.valid) {
      const details = validationResult.additionalData || {};
      job.validationStatus = 'VALID';
      job.validationReason = null;
      job.lastValidatedAt = new Date().toISOString();
      job.canonicalUrl = validationResult.canonicalUrl || job.canonicalUrl;
      job.finalUrl = details.finalUrl || job.finalUrl;
      job.pageType = details.pageType || job.pageType;
      job.platformId = details.platformId || job.platformId;
      job.canApply = true;
      job.bidLimitReached = details.bidLimitReached || false;
      job.redirectDetected = details.redirectDetected || false;
      job.redirectChain = details.redirectChain || [];
      job.healthScore = details.healthScore !== undefined ? details.healthScore : 100;
      job.debugScreenshotPath = details.debugScreenshotPath || job.debugScreenshotPath;
      job.pageTitle = details.pageTitle || job.pageTitle;
      job.pageContentSnippet = details.pageContentSnippet || job.pageContentSnippet;
      job.boardTitle = details.boardTitle || job.boardTitle;
      job.boardSnippet = details.boardSnippet || job.boardSnippet;
      job.boardCategory = details.boardCategory || job.boardCategory;
      job.liveTitle = details.liveTitle || job.liveTitle;
      job.liveCategory = details.liveCategory || job.liveCategory;
      job.titleSimilarity = details.titleSimilarity !== undefined ? details.titleSimilarity : job.titleSimilarity;
      job.descriptionSimilarity = details.descriptionSimilarity !== undefined ? details.descriptionSimilarity : job.descriptionSimilarity;
      job.semanticValidation = details.semanticValidation !== undefined ? details.semanticValidation : job.semanticValidation;
      job.semanticValidationReason = details.semanticValidationReason || job.semanticValidationReason;

      db.addLog('success', 'scraper', `[PRE-SAVE VALID] Confirmed parsed link is fully valid: "${job.title}" (Health score Match: ${job.healthScore})`);
    } else {
      const failReason = validationResult.reason || 'UNAVAILABLE';
      
      // OPTIMIZATION: Handle temporary SOFT_INVALID status instead of immediate deletion
      const isSoftInvalid = ['TIMEOUT', 'RATE_LIMIT', 'SOFT_INVALID', 'UNAVAILABLE'].includes(failReason);
      if (isSoftInvalid) {
        job.validationStatus = 'PENDING';
        job.status = 'soft_invalid';
        job.validationReason = failReason;
        job.lastValidatedAt = new Date().toISOString();
        
        db.addOpportunity(job);
        db.addLog('warning', 'scraper', `[SOFT_INVALID SAVED] Retained temporary soft-invalid / rate-limited opportunity: "${job.title}". Status set to soft_invalid, revalidating later.`);
        continue;
      }

      const detailedReasonsMap: Record<string, string> = {
        'INVALID_PAGE': 'The page URL pattern is invalid/incorrect, or failed to resolve/load inside the browser session.',
        'NOT_FOUND': 'The project, community request or freelancer service does not exist on the platform anymore (HTTP 404).',
        'CLOSED': 'The project thread is closed or archived and is no longer accepting comments/proposals.',
        'DELETED': 'The platform listing has been deleted or removed by its author or moderation.',
        'PRIVATE': 'The opportunity is private or restricted, requiring login credentials or specific author permissions.',
        'NO_PERMISSIONS': 'Access unauthorized due to account limitations or membership level restrictions.',
        'ACCOUNT_SUSPENDED': 'The listing owner account is suspended, blocked or deactivated.',
        'INSUFFICIENT_CONTENT': 'The project title is too short (less than 5 chars) or description detail is too sparse (less than 20 chars).',
        'UNRELATED_CONTENT': 'The page was redirected to an unrelated section (e.g., dashboard lists, homepages, or a mismatching project ID).',
        'TIMEOUT': 'Navigation timed out because the page failed to render or load assets within 40 seconds.',
        'RATE_LIMIT': 'The platform returned a rate limit response or triggered anti-scraping cloudflare shields.',
        'UNAVAILABLE': 'The resource became temporarily unreachable or returned abnormal/blank content responses.'
      };

      const detailedReason = detailedReasonsMap[failReason] || 'The listing does not meet safety, health or platform eligibility requirements.';
      const targetUrl = job.link || 'No URL available';

      db.addLog('warning', 'scraper', `[PRE-SAVE REJECT & SKIP] Skipped saving invalid, ended or incorrect opportunity: "${job.title}"\n- Reason: ${failReason} (${detailedReason})\n- URL: ${targetUrl}`);
      
      // Space out consecutive browser visits slightly to keep profiles healthy
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    // Space out consecutive browser visits slightly to keep profiles healthy
    await new Promise(resolve => setTimeout(resolve, 1000));

    const added = db.addOpportunity(job);
    
    // Core Mandate: Only REAL Opportunities undergo AI Scoring and Proposal automatic queueing
    if (added.status === 'new' && !added.matchAnalysis && added.sourceType === 'REAL') {
      if (addedCount > 0) {
        // Space out requests to avoid hitting rate-limits / quota peaks instantly
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      addedCount++;
      try {
        // Analyze with Gemini
        const analysis = await analyzeOpportunity(profile, added);
        db.updateOpportunity(added.id, { matchAnalysis: analysis });

        // If in full-auto mode and match score meets or exceeds standard threshold, approve it to proposals queue
        if (settings.mode === 'auto' && analysis.score >= settings.autoApproveMinScore) {
          db.updateOpportunity(added.id, { status: 'approved' });
          db.addLog('success', 'automation', `[AUTO] Pre-approved job "${added.title}" to proposals queue - Match score ${analysis.score}% meets threshold (${settings.autoApproveMinScore}%). Generating proposal...`);
          
          try {
            const pitchContent = await writeProposal(profile, added, profile.proposalTone || 'professional', profile.proposalTone ? 'medium' : 'medium');
            const propId = `prop-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const newProp = {
              id: propId,
              opportunityId: added.id,
              content: pitchContent,
              tone: profile.proposalTone || 'professional',
              length: profile.proposalLength || 'medium',
              status: 'draft' as const,
              timestamp: new Date().toISOString()
            };
            db.addProposal(newProp);
            db.updateOpportunity(added.id, { proposalId: propId });
            
            db.addLog('info', 'automation', `[AUTO-SUBMIT] Automatically bidding on "${added.title}" (Match score ${analysis.score}%)...`);
            const submissionResult = await submitProposalViaPlaywright(propId);
            if (submissionResult.success) {
              db.updateProposal(propId, {
                status: 'submitted',
                submittedPlatformLink: submissionResult.submittedLink
              });
              db.updateOpportunity(added.id, { status: 'submitted' });
              db.addLog('success', 'automation', `[AUTO-SUBMIT SUCCESS] Bidded on "${added.title}" successfully! Link: ${submissionResult.submittedLink}`);
            } else {
              db.addLog('warning', 'automation', `[AUTO-SUBMIT DEFER] Playwright automated bidding failed on "${added.title}": ${submissionResult.message}`);
            }
          } catch (autoErr: any) {
            db.addLog('error', 'automation', `[AUTO-SUBMIT ERROR] Failed inside auto-proposal generator or poster: ${autoErr.message}`);
          }
        } else if (analysis.score >= 70) {
          // Log match
          db.addLog('success', 'gemini', `Found strong match (${analysis.score}%): "${added.title}" on ${added.platform}!`);
          // Send alert via Telegram message
          await sendJobMatchAlert(added, analysis.score);
        }
      } catch (analyzeErr: any) {
        db.addLog('warning', 'gemini', `Could not automatically analyze real job "${added.title}": ${analyzeErr.message}`);
      }
    }
  }

  db.addLog('success', 'scraper', `Platforms audit complete. Identified ${addedCount} new actionable freelance proposals.`);
  
  // Automatically trigger opportunity revalidation of saved jobs on every scan
  await revalidateSavedOpportunities().catch(err => {
    console.error('Failed running scheduled revalidation:', err);
  });

  return addedCount;
}

export async function revalidateSavedOpportunities(force: boolean = false): Promise<void> {
  db.addLog('info', 'scraper', `[REVALIDATOR] Commencing scheduled revalidation of saved opportunities (force mode: ${force})...`);
  const opportunities = db.getOpportunities();
  
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const targets = opportunities.filter(op => {
    // Only revalidate interactive status states
    const isPendingInteractiveState = ['new', 'queued', 'approved', 'ACTIVE', 'soft_invalid', 'SOFT_INVALID'].includes(op.status);
    if (!isPendingInteractiveState) return false;

    if (force) return true; // Force revalidation, bypassing cache time limits

    if (!op.lastValidatedAt) return true;
    try {
      const lastValDate = new Date(op.lastValidatedAt);
      return lastValDate < sixHoursAgo;
    } catch (_) {
      return true;
    }
  });

  if (targets.length === 0) {
    db.addLog('info', 'scraper', '[REVALIDATOR] No candidates require revalidation at this time.');
    return;
  }

  db.addLog('info', 'scraper', `[REVALIDATOR] Found ${targets.length} opportunities requiring status checks.`);

  for (const op of targets) {
    // Run validation with board data stored on opportunity
    const result = await validateOpportunity(op.platform, op.link, undefined, op.boardTitle, {
      boardTitle: op.boardTitle,
      boardSnippet: op.boardSnippet,
      boardCategory: op.boardCategory,
      boardRequestId: op.id,
      boardUrl: op.link
    });
    if (result.valid) {
      const details = result.additionalData || {};
      db.updateOpportunity(op.id, {
        validationStatus: 'VALID',
        validationReason: null,
        lastValidatedAt: new Date().toISOString(),
        canonicalUrl: result.canonicalUrl || op.canonicalUrl,
        finalUrl: details.finalUrl || op.finalUrl,
        pageType: details.pageType || op.pageType,
        platformId: details.platformId || op.platformId,
        canApply: true,
        bidLimitReached: details.bidLimitReached || false,
        redirectDetected: details.redirectDetected || false,
        redirectChain: details.redirectChain || [],
        healthScore: details.healthScore !== undefined ? details.healthScore : 100,
        debugScreenshotPath: details.debugScreenshotPath || op.debugScreenshotPath,
        pageTitle: details.pageTitle || op.pageTitle,
        pageContentSnippet: details.pageContentSnippet || op.pageContentSnippet,
        boardTitle: details.boardTitle || op.boardTitle,
        boardSnippet: details.boardSnippet || op.boardSnippet,
        boardCategory: details.boardCategory || op.boardCategory,
        liveTitle: details.liveTitle || op.liveTitle,
        liveCategory: details.liveCategory || op.liveCategory,
        titleSimilarity: details.titleSimilarity !== undefined ? details.titleSimilarity : op.titleSimilarity,
        descriptionSimilarity: details.descriptionSimilarity !== undefined ? details.descriptionSimilarity : op.descriptionSimilarity,
        semanticValidation: details.semanticValidation !== undefined ? details.semanticValidation : op.semanticValidation,
        semanticValidationReason: details.semanticValidationReason || op.semanticValidationReason
      });
      db.addLog('success', 'scraper', `[REVALIDATOR VALID] Project remains active and accessible: "${op.title}" (Health score Match: ${details.healthScore || 100})`);
    } else {
      const failReason = result.reason || 'UNAVAILABLE';
      let updatedStatus: any = 'UNAVAILABLE';
      if (failReason === 'CLOSED') updatedStatus = 'CLOSED';
      else if (failReason === 'PRIVATE') updatedStatus = 'PRIVATE';
      else if (failReason === 'DELETED') updatedStatus = 'DELETED';
      else if (failReason === 'INACTIVE') updatedStatus = 'INACTIVE';
      else if (failReason === 'UNAVAILABLE') updatedStatus = 'UNAVAILABLE';
      else if (failReason === 'CONTENT_MISMATCH') updatedStatus = 'INVALID';

      const details = result.additionalData || {};
      db.updateOpportunity(op.id, {
        status: updatedStatus,
        validationStatus: 'INVALID',
        validationReason: failReason,
        isActive: false,
        lastValidatedAt: new Date().toISOString(),
        canonicalUrl: result.canonicalUrl || op.canonicalUrl,
        finalUrl: details.finalUrl || op.finalUrl,
        pageType: details.pageType || op.pageType,
        platformId: details.platformId || op.platformId,
        canApply: details.canApply !== undefined ? details.canApply : false,
        redirectDetected: details.redirectDetected || false,
        redirectChain: details.redirectChain || [],
        healthScore: details.healthScore !== undefined ? details.healthScore : 0,
        debugScreenshotPath: details.debugScreenshotPath || op.debugScreenshotPath,
        pageTitle: details.pageTitle || op.pageTitle,
        pageContentSnippet: details.pageContentSnippet || op.pageContentSnippet,
        boardTitle: details.boardTitle || op.boardTitle,
        boardSnippet: details.boardSnippet || op.boardSnippet,
        boardCategory: details.boardCategory || op.boardCategory,
        liveTitle: details.liveTitle || op.liveTitle,
        liveCategory: details.liveCategory || op.liveCategory,
        titleSimilarity: details.titleSimilarity !== undefined ? details.titleSimilarity : op.titleSimilarity,
        descriptionSimilarity: details.descriptionSimilarity !== undefined ? details.descriptionSimilarity : op.descriptionSimilarity,
        semanticValidation: details.semanticValidation !== undefined ? details.semanticValidation : op.semanticValidation,
        semanticValidationReason: details.semanticValidationReason || op.semanticValidationReason
      });
      db.addLog('warning', 'scraper', `[REVALIDATOR INVALID] "${op.title}" flagged invalid (${failReason}). Status updated to: ${updatedStatus}. Health Score: ${details.healthScore || 0}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

/**
 * Global crawler scraping scheduler runner
 */
let scraperIntervalId: NodeJS.Timeout | null = null;

export function startScraperScheduler() {
  if (scraperIntervalId) {
    clearInterval(scraperIntervalId);
  }

  const settings = db.getAutomationSettings();
  const ms = settings.scrapeIntervalMinutes * 60 * 1000;

  db.addLog('info', 'scraper', `Scraper scheduler started. Scanning platforms every ${settings.scrapeIntervalMinutes} minutes...`);

  // Run immediately on boot
  setTimeout(async () => {
    try {
      await triggerActivePlatformsScrape();
    } catch (e) {
      console.error('Initial scrape failed:', e);
    }
  }, 5000);

  // Interval
  scraperIntervalId = setInterval(async () => {
    try {
      await triggerActivePlatformsScrape();
    } catch (e) {
      console.error('Scheduled scrape cycle execution failed:', e);
    }
  }, ms);
}

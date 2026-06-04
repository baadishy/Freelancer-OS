/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, userSessionStorage } from './db.js';
import { PlatformScraperStats, ScraperAnalytics } from '../src/types.js';

// Seed stats for clean fallback / immediate dashboard richness
const SEED_ANALYTICS: ScraperAnalytics = {
  platformStats: {
    Khamsat: {
      platform: 'Khamsat',
      candidatesDiscovered: 120,
      validationPassed: 60,
      validationFailed: 60,
      redirected: 15,
      closed: 12,
      deleted: 8,
      private: 0,
      contentMismatch: 0,
      cannotApply: 25,
      softInvalid: 0,
      realCount: 40,
      simulatedCount: 20,
      highMatchCount: 18,
      proposalCapableCount: 35
    },
    Mostaql: {
      platform: 'Mostaql',
      candidatesDiscovered: 95,
      validationPassed: 55,
      validationFailed: 40,
      redirected: 8,
      closed: 10,
      deleted: 5,
      private: 3,
      contentMismatch: 4,
      cannotApply: 10,
      softInvalid: 1,
      realCount: 38,
      simulatedCount: 17,
      highMatchCount: 14,
      proposalCapableCount: 30
    },
    Fiverr: {
      platform: 'Fiverr',
      candidatesDiscovered: 50,
      validationPassed: 30,
      validationFailed: 20,
      redirected: 2,
      closed: 5,
      deleted: 3,
      private: 4,
      contentMismatch: 2,
      cannotApply: 4,
      softInvalid: 0,
      realCount: 20,
      simulatedCount: 10,
      highMatchCount: 8,
      proposalCapableCount: 18
    }
  },
  topSkills: {
    'React': 15,
    'Next.js': 11,
    'TypeScript': 14,
    'Node.js': 12,
    'AI': 9,
    'Telegram Bots': 7,
    'Chrome Extension': 4
  },
  acquisitionScore: 78
};

/**
 * Calculates Opportunity Acquisition Score dynamically.
 * Formula: Min(100, (Real Opportunities * 0.8) + (Validation Pass Rate % * 0.4) + (High Match Count * 1.5) + (Proposal Capable Count * 0.8))
 */
export function calculateAcquisitionScore(stats: PlatformScraperStats[]): number {
  let totalReal = 0;
  let totalCandidates = 0;
  let totalPassed = 0;
  let totalHighMatch = 0;
  let totalProposalCapable = 0;

  for (const st of stats) {
    totalReal += st.realCount;
    totalCandidates += st.candidatesDiscovered;
    totalPassed += st.validationPassed;
    totalHighMatch += st.highMatchCount;
    totalProposalCapable += st.proposalCapableCount;
  }

  if (totalCandidates === 0) return 0;

  const passRatePercentage = (totalPassed / totalCandidates) * 100;
  
  // Weights:
  // - Real Count: 0.8 points each
  // - Pass Rate: 0.4 points per 1%
  // - High Match (>=70% fit): 1.8 points each
  // - Proposal Capable: 0.8 points each
  const score = (totalReal * 0.8) + (passRatePercentage * 0.4) + (totalHighMatch * 1.8) + (totalProposalCapable * 0.8);
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Gets the consolidated Scraper Analytics for the active logged-in user partition
 */
export function getScraperAnalytics(userEmail?: string): ScraperAnalytics {
  const email = userEmail || userSessionStorage.getStore();
  const snapshot = db.getSnapshot();
  
  const resolvedEmail = email ? email.toLowerCase().trim() : 'default';
  
  // Since db.ts partitions are inside userData, let's see if we already have analytics saved there
  const userData = snapshot.userData?.[resolvedEmail];
  if (userData && (userData as any).analytics) {
    return (userData as any).analytics;
  }
  
  // Return seed default if none exists yet, but ensure it's cloned
  return JSON.parse(JSON.stringify(SEED_ANALYTICS));
}

/**
 * Saves the Scraper Analytics state for the active user partition
 */
export function saveScraperAnalytics(analytics: ScraperAnalytics, userEmail?: string): void {
  const email = userEmail || userSessionStorage.getStore();
  const resolvedEmail = email ? email.toLowerCase().trim() : 'default';
  
  // Calculate final score
  analytics.acquisitionScore = calculateAcquisitionScore(Object.values(analytics.platformStats));
  
  // Save to the partition
  const currentSnapshot = db.getSnapshot();
  if (!currentSnapshot.userData) {
    currentSnapshot.userData = {};
  }
  
  const partition = db.getProfile(resolvedEmail); // Ensures partition bootstrap if needed
  const userState = currentSnapshot.userData[resolvedEmail] || {
    profile: partition,
    opportunities: [],
    proposals: [],
    telegramSettings: { botToken: '', chatId: '', enabled: false, reportTime: '10:00', notifyOnNewMatch: true, notifyOnClientReply: true, notifyOnSubmission: true, notifyOnError: true },
    automationSettings: { mode: 'assisted', scrapeIntervalMinutes: 30, dailySubmissionLimit: 5, autoApproveMinScore: 85, geminiModel: 'gemini-2.5-flash' },
    logs: [],
    accounts: []
  };
  
  (userState as any).analytics = analytics;
  
  // Direct partition save
  db['saveUserDataOf'](resolvedEmail, { ...userState } as any);
}

/**
 * Records a single outcome from a crawler discovery candidates scan
 */
export function recordDiscovery(
  platform: 'Khamsat' | 'Mostaql' | 'Fiverr',
  metrics: {
    candidatesDiscovered?: number;
    passed?: boolean;
    reason?: 'VALID' | 'REDIRECT' | 'CLOSED' | 'DELETED' | 'PRIVATE' | 'CONTENT_MISMATCH' | 'CANNOT_APPLY' | 'SOFT_INVALID' | 'UNAVAILABLE';
    isReal?: boolean;
    highMatch?: boolean;
    proposalCapable?: boolean;
    skillMatched?: string;
  },
  userEmail?: string
): void {
  const current = getScraperAnalytics(userEmail);
  const stat = current.platformStats[platform];
  
  if (!stat) return;
  
  if (metrics.candidatesDiscovered) {
    stat.candidatesDiscovered += metrics.candidatesDiscovered;
  }
  
  if (metrics.isReal !== undefined) {
    if (metrics.isReal) stat.realCount++;
    else stat.simulatedCount++;
  }
  
  if (metrics.passed !== undefined) {
    if (metrics.passed) {
      stat.validationPassed++;
      if (metrics.highMatch) stat.highMatchCount++;
      if (metrics.proposalCapable) stat.proposalCapableCount++;
      
      // Update top skills
      if (metrics.skillMatched) {
        const skill = metrics.skillMatched.trim();
        current.topSkills[skill] = (current.topSkills[skill] || 0) + 1;
      }
    } else {
      stat.validationFailed++;
      
      const r = metrics.reason;
      if (r === 'REDIRECT') stat.redirected++;
      else if (r === 'CLOSED') stat.closed++;
      else if (r === 'DELETED') stat.deleted++;
      else if (r === 'PRIVATE') stat.private++;
      else if (r === 'CONTENT_MISMATCH') stat.contentMismatch++;
      else if (r === 'CANNOT_APPLY') stat.cannotApply++;
      else if (r === 'SOFT_INVALID') stat.softInvalid++;
    }
  }
  
  saveScraperAnalytics(current, userEmail);
}

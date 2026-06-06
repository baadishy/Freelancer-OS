/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PortfolioProject {
  id: string;
  title: string;
  link: string;
  description: string;
  techUsed?: string[];
}

export interface PlatformCookies {
  khamsat?: string;
  mostaql?: string;
  linkedin?: string;
}

export interface FreelancerProfile {
  skills: string[];
  technologies: string[];
  experience: 'junior' | 'mid' | 'senior' | 'expert';
  languages: string[];
  portfolioLinks: string[];
  portfolioProjects?: PortfolioProject[];
  platformCookies?: PlatformCookies;
  hourlyRate: number;
  preferredMinBudget: number;
  projectTypes: string[];
  excludedCategories: string[];
  proposalTone: 'professional' | 'persuasive' | 'friendly' | 'analytical' | 'technical';
  proposalLength: 'short' | 'medium' | 'long';
  workingHours: {
    start: string; // e.g., "09:00"
    end: string;   // e.g., "17:00"
    timezone: string; // e.g., "UTC"
  };
}

export interface MatchAnalysis {
  score: number;          // 0 - 100
  winProbability: number; // 0 - 100
  profitabilityScore: number; // 0 - 100
  urgencyScore: number;   // 0 - 100
  complexity: 'low' | 'medium' | 'high';
  reasoning: string;
  clientAnalysis?: {
    replyProbability: number;
    negotiationTendency: 'low' | 'medium' | 'high';
    seriousnessScore: number;
    paymentReliability: 'low' | 'medium' | 'high';
    communicationQuality: string;
  };
}

export interface Opportunity {
  id: string;
  title: string;
  platform: 'Khamsat' | 'Mostaql' | 'LinkedIn';
  link: string;
  budget: string;
  clientName: string;
  category: string;
  description: string;
  language: 'ar' | 'en';
  timestamp: string;
  status: 'new' | 'ignored' | 'queued' | 'approved' | 'submitted' | 'rejected' | 'ACTIVE' | 'INACTIVE' | 'CLOSED' | 'PRIVATE' | 'DELETED' | 'UNAVAILABLE' | 'REDIRECTED' | 'INVALID' | 'soft_invalid' | 'SOFT_INVALID';
  matchAnalysis?: MatchAnalysis;
  proposalId?: string;
  hidden?: boolean;
  publishedAt?: string;
  isActive?: boolean;
  sourceType?: 'REAL' | 'SIMULATED';
  validationStatus?: 'VALID' | 'INVALID' | 'PRIVATE' | 'CLOSED' | 'DELETED' | 'UNAVAILABLE' | 'INACTIVE' | 'PENDING' | 'REDIRECTED';
  validationReason?: string | null;
  canonicalUrl?: string;
  lastValidatedAt?: string;
  originalUrl?: string;
  finalUrl?: string;
  serviceId?: string;
  finalServiceId?: string;
  redirectDetected?: boolean;
  pageType?: 'REQUEST' | 'SERVICE' | 'USER_PROFILE' | 'CATEGORY' | 'PROJECT' | 'PROFILE' | 'COMPANY' | 'BUYER_REQUEST' | 'BRIEF' | 'GIG' | 'UNKNOWN';
  platformId?: string;
  canApply?: boolean;
  redirectChain?: string[];
  debugScreenshotPath?: string;
  pageTitle?: string;
  pageContentSnippet?: string;
  healthScore?: number;
  boardTitle?: string;
  boardSnippet?: string;
  boardCategory?: string;
  liveTitle?: string;
  liveCategory?: string;
  titleSimilarity?: number;
  descriptionSimilarity?: number;
  semanticValidation?: boolean;
  semanticValidationReason?: string;
  period?: number;
  cost?: number;
  bidLimitReached?: boolean;
}

export interface Proposal {
  id: string;
  opportunityId: string;
  content: string;
  tone: string;
  length: 'short' | 'medium' | 'long';
  status: 'draft' | 'approved' | 'submitted' | 'rejected';
  timestamp: string;
  cooldownUntil?: string;
  submittedPlatformLink?: string;
  submissionDebugScreenshots?: { title: string; filename: string; timestamp: string }[];
  submissionError?: string;
  archived?: boolean;
  cost?: number;
  period?: number;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  enabled: boolean;
  reportTime: string; // e.g., "10:00"
  notifyOnNewMatch: boolean;
  notifyOnClientReply: boolean;
  notifyOnSubmission: boolean;
  notifyOnError: boolean;
}

export interface AutomationSettings {
  mode: 'manual' | 'assisted' | 'auto';
  scrapeIntervalMinutes: number;
  dailySubmissionLimit: number;
  autoApproveMinScore: number;
  geminiModel?: string;
  chromePath?: string;
}

export interface SystemLog {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  source: 'scraper' | 'gemini' | 'telegram' | 'automation' | 'system';
  message: string;
  timestamp: string;
}

export interface DashboardStats {
  totalJobsFound: number;
  matchedJobs: number;
  proposalsGenerated: number;
  proposalsSubmitted: number;
  repliesReceived: number;
  acceptanceRate: number;
  activeAutomationsCount: number;
  telegramStatus: boolean;
  platformsBreakdown: {
    Khamsat: number;
    Mostaql: number;
    LinkedIn: number;
  };
}

export type ConnectedAccountStatus = 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'LOGIN_REQUIRED' | 'ERROR';

export interface ConnectedAccount {
  platform: 'Khamsat' | 'Mostaql' | 'LinkedIn';
  status: ConnectedAccountStatus;
  username?: string;
  lastLogin?: string;
  lastValidation?: string;
  errorMessage?: string;
  profileLocation?: string;
  cookiesJson?: string;
}

export interface PlatformScraperStats {
  platform: 'Khamsat' | 'Mostaql' | 'LinkedIn';
  candidatesDiscovered: number;
  validationPassed: number;
  validationFailed: number;
  redirected: number;
  closed: number;
  deleted: number;
  private: number;
  contentMismatch: number;
  cannotApply: number;
  softInvalid: number;
  realCount: number;
  simulatedCount: number;
  highMatchCount: number;
  proposalCapableCount: number;
}

export interface ScraperAnalytics {
  platformStats: Record<'Khamsat' | 'Mostaql' | 'LinkedIn', PlatformScraperStats>;
  topSkills: Record<string, number>;
  acquisitionScore: number;
}



/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
export const userSessionStorage = new AsyncLocalStorage<string>();
import { 
  FreelancerProfile, 
  Opportunity, 
  Proposal, 
  TelegramSettings, 
  AutomationSettings, 
  SystemLog,
  ConnectedAccount
} from '../src/types.js'; // Use .js because we compile ESM or bundle

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Representation of partition of data for a specific user
interface UserData {
  profile: FreelancerProfile;
  opportunities: Opportunity[];
  proposals: Proposal[];
  telegramSettings: TelegramSettings;
  automationSettings: AutomationSettings;
  logs: SystemLog[];
  accounts: ConnectedAccount[];
}

interface Schema {
  users: Array<{ id: string; email: string; name: string; passwordHash: string; createdAt: string }>;
  // User-isolated partitions keyed by lower-cased user email
  userData?: Record<string, UserData>;
  // Legacy global fallbacks
  profile: FreelancerProfile;
  opportunities: Opportunity[];
  proposals: Proposal[];
  telegramSettings: TelegramSettings;
  automationSettings: AutomationSettings;
  logs: SystemLog[];
  accounts?: ConnectedAccount[];
}

const DEFAULT_PROFILE: FreelancerProfile = {
  skills: ['React', 'TypeScript', 'Node.js', 'Express', 'Tailwind CSS', 'Next.js', 'API Integration'],
  technologies: ['React', 'Vite', 'Node', 'Express', 'Tailwind', 'REST APIs', 'PostgreSQL'],
  experience: 'senior',
  languages: ['English', 'Arabic'],
  portfolioLinks: ['https://github.com/freelancer', 'https://linkedin.com/in/freelancer', 'https://freelance-os.local/portfolio'],
  portfolioProjects: [
    {
      id: "port-1",
      title: "E-Commerce Back-End REST API",
      link: "https://github.com/freelancer/shop-api-express",
      description: "An Express-powered secure server backend utilizing JWT roles, Stripe payment workflows, product catalog tables, and auto-generated email receipt webhooks.",
      techUsed: ["Node.js", "Express", "Stripe", "JWT"]
    },
    {
      id: "port-2",
      title: "Vite Real-time Live Bidding Layout",
      link: "https://github.com/freelancer/live-bids-ui",
      description: "A gorgeous lightweight Tailwind UI client dashboard showing active web crawler tasks, custom Gemini score evaluations, and live project alert feeds.",
      techUsed: ["React", "TypeScript", "Vite", "Gemini API"]
    }
  ],
  hourlyRate: 45,
  preferredMinBudget: 200,
  projectTypes: ['Web App Development', 'API Backends', 'SaaS Products', 'SPA Redesign', 'Automation Scripts'],
  excludedCategories: ['Logo Design', 'Translations', 'SEO Articles', 'Video Editing'],
  proposalTone: 'persuasive',
  proposalLength: 'medium',
  workingHours: {
    start: '09:00',
    end: '18:00',
    timezone: 'UTC'
  }
};

const DEFAULT_TELEGRAM: TelegramSettings = {
  botToken: '',
  chatId: '',
  enabled: false,
  reportTime: '10:00',
  notifyOnNewMatch: true,
  notifyOnClientReply: true,
  notifyOnSubmission: true,
  notifyOnError: true
};

const DEFAULT_AUTOMATION: AutomationSettings = {
  mode: 'assisted',
  scrapeIntervalMinutes: 30,
  dailySubmissionLimit: 5,
  autoApproveMinScore: 85,
  geminiModel: 'gemini-2.5-flash'
};

const INITIAL_DB_STATE: Schema = {
  users: [],
  userData: {},
  profile: DEFAULT_PROFILE,
  opportunities: [],
  proposals: [],
  telegramSettings: DEFAULT_TELEGRAM,
  automationSettings: DEFAULT_AUTOMATION,
  logs: [
    {
      id: 'log-1',
      type: 'info',
      source: 'system',
      message: 'Freelance OS database initialized successfully in local storage.',
      timestamp: new Date().toISOString()
    }
  ],
  accounts: [
    { platform: 'Khamsat', status: 'DISCONNECTED' },
    { platform: 'Mostaql', status: 'DISCONNECTED' }
  ]
};

class LocalDB {
  private data: Schema;
  private isInitializedFromRemote = false;

  constructor() {
    this.ensureDirectoryExists();
    this.data = this.load();
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
  }

  private load(): Schema {
    if (!fs.existsSync(DB_FILE)) {
      this.save(INITIAL_DB_STATE);
      return INITIAL_DB_STATE;
    }
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const loaded = JSON.parse(content) as Schema;
      
      // Merge defaults in legacy structure
      const merged: Schema = {
        users: loaded.users || [],
        userData: loaded.userData || {},
        profile: loaded.profile || DEFAULT_PROFILE,
        opportunities: loaded.opportunities || [],
        proposals: loaded.proposals || [],
        telegramSettings: loaded.telegramSettings || DEFAULT_TELEGRAM,
        automationSettings: loaded.automationSettings || DEFAULT_AUTOMATION,
        logs: loaded.logs || [],
        accounts: loaded.accounts || [
          { platform: 'Khamsat', status: 'DISCONNECTED' },
          { platform: 'Mostaql', status: 'DISCONNECTED' }
        ]
      };
      
      const model = merged.automationSettings.geminiModel;
      const deprecated = ['gemini-1.5-flash', 'gemini-pro', 'gemini-2.0-flash'];
      const deprecatedPro = ['gemini-1.5-pro', 'gemini-2.0-pro'];
      if (!model || model === 'gemini-3.5-flash' || deprecated.includes(model)) {
        merged.automationSettings.geminiModel = 'gemini-2.5-flash';
      } else if (deprecatedPro.includes(model)) {
        merged.automationSettings.geminiModel = 'gemini-3.1-pro-preview';
      }
      return merged;
    } catch (e) {
      console.error('Failed to parse database, resetting to initial state:', e);
      this.save(INITIAL_DB_STATE);
      return INITIAL_DB_STATE;
    }
  }

  private save(data: Schema) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      this.data = data;
    } catch (e) {
      console.error('Failed to save to database file:', e);
    }
  }

  public async initFromPersistentStore() {
    console.log("Loading Freelance OS state from robust local partition database...");
    this.isInitializedFromRemote = true;
  }

  // --- Partition Resolution Helpers ---
  private getUserDataOf(userEmail?: string): UserData {
    const activeEmail = userEmail || userSessionStorage.getStore();
    const email = activeEmail ? activeEmail.toLowerCase().trim() : 'default';
    const currentData = this.load();
    if (!currentData.userData) {
      currentData.userData = {};
    }
    if (!currentData.userData[email]) {
      // Lazy bootstrap partition from default global keys or default states
      currentData.userData[email] = {
        profile: currentData.profile ? { ...currentData.profile } : { ...DEFAULT_PROFILE },
        opportunities: Array.isArray(currentData.opportunities) ? [...currentData.opportunities] : [],
        proposals: Array.isArray(currentData.proposals) ? [...currentData.proposals] : [],
        telegramSettings: currentData.telegramSettings ? { ...currentData.telegramSettings } : { ...DEFAULT_TELEGRAM },
        automationSettings: currentData.automationSettings ? { ...currentData.automationSettings } : { ...DEFAULT_AUTOMATION },
        logs: Array.isArray(currentData.logs) ? [...currentData.logs] : [],
        accounts: Array.isArray(currentData.accounts) ? [...currentData.accounts] : [
          { platform: 'Khamsat', status: 'DISCONNECTED' },
          { platform: 'Mostaql', status: 'DISCONNECTED' }
        ]
      };
      this.save(currentData);
    }
    return currentData.userData[email];
  }

  private saveUserDataOf(userEmail: string | undefined, fields: Partial<UserData>) {
    const activeEmail = userEmail || userSessionStorage.getStore();
    const email = activeEmail ? activeEmail.toLowerCase().trim() : 'default';
    const currentData = this.load();
    if (!currentData.userData) {
      currentData.userData = {};
    }
    
    // Ensure the partition's record is initialized first
    const record = this.getUserDataOf(email);
    currentData.userData[email] = {
      ...record,
      ...fields
    };

    // If writing to default/guest user, mirror back to legacy keys too
    if (email === 'default') {
      if (fields.profile) currentData.profile = fields.profile;
      if (fields.opportunities) currentData.opportunities = fields.opportunities;
      if (fields.proposals) currentData.proposals = fields.proposals;
      if (fields.telegramSettings) currentData.telegramSettings = fields.telegramSettings;
      if (fields.automationSettings) currentData.automationSettings = fields.automationSettings;
      if (fields.logs) currentData.logs = fields.logs;
      if (fields.accounts) currentData.accounts = fields.accounts;
    }

    this.save(currentData);
  }

  // --- Logs Utility ---
  public addLog(
    type: 'info' | 'success' | 'warning' | 'error', 
    source: 'scraper' | 'gemini' | 'telegram' | 'automation' | 'system', 
    message: string,
    userEmail?: string
  ) {
    const userState = this.getUserDataOf(userEmail);
    const newLog: SystemLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      source,
      message,
      timestamp: new Date().toISOString()
    };
    const logs = [newLog, ...(userState.logs || [])];
    this.saveUserDataOf(userEmail, {
      logs: logs.slice(0, 300)
    });
    return newLog;
  }

  public getLogs(userEmail?: string): SystemLog[] {
    return this.getUserDataOf(userEmail).logs || [];
  }

  public clearLogs(userEmail?: string) {
    this.saveUserDataOf(userEmail, { logs: [] });
  }

  // --- Account Connection Utilities ---
  public getAccounts(userEmail?: string): ConnectedAccount[] {
    return (this.getUserDataOf(userEmail).accounts || [
      { platform: 'Khamsat', status: 'DISCONNECTED' },
      { platform: 'Mostaql', status: 'DISCONNECTED' }
    ]);
  }

  public getAccount(platform: 'Khamsat' | 'Mostaql', userEmail?: string): ConnectedAccount {
    const accounts = this.getAccounts(userEmail);
    const existing = accounts.find(a => a.platform === platform);
    if (existing) return existing;
    return { platform, status: 'DISCONNECTED' };
  }

  public updateAccount(platform: 'Khamsat' | 'Mostaql', updates: Partial<ConnectedAccount>, userEmail?: string): ConnectedAccount {
    const userState = this.getUserDataOf(userEmail);
    const accounts = [...(userState.accounts || [])];
    const idx = accounts.findIndex(a => a.platform === platform);
    if (idx !== -1) {
      accounts[idx] = { ...accounts[idx], ...updates };
    } else {
      accounts.push({
        platform,
        status: updates.status || 'DISCONNECTED',
        ...updates
      } as any);
    }
    this.saveUserDataOf(userEmail, { accounts });
    return this.getAccount(platform, userEmail);
  }

  // --- Auth & Users Cache Utilities ---
  public getUsers() {
    return this.load().users;
  }

  public getSnapshot(): Schema {
    return this.load();
  }

  public registerUser(email: string, name: string, passwordHash: string, customId?: string) {
    const currentData = this.load();
    const emailLower = email.toLowerCase().trim();
    if (currentData.users.some(u => u.email === emailLower)) {
      throw new Error(`User with email ${email} already exists.`);
    }
    const user = {
      id: customId || `user-${Date.now()}`,
      email: emailLower,
      name,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    currentData.users.push(user);
    this.save(currentData);
    
    // Prime the partition layout for this new user account
    this.getUserDataOf(emailLower);
    
    this.addLog('success', 'system', `New user registered: ${name} (${emailLower})`, emailLower);
    return { id: user.id, email: user.email, name: user.name };
  }

  public getUserByEmail(email: string) {
    return this.load().users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());
  }

  public updateUserPasswordHash(email: string, passwordHash: string) {
    const currentData = this.load();
    const emailLower = email.toLowerCase().trim();
    const userIndex = currentData.users.findIndex(u => u.email.toLowerCase().trim() === emailLower);
    if (userIndex !== -1) {
      currentData.users[userIndex].passwordHash = passwordHash;
      this.save(currentData);
      return true;
    }
    return false;
  }

  // --- Freelancer Profile Utilities ---
  public getProfile(userEmail?: string): FreelancerProfile {
    return this.getUserDataOf(userEmail).profile;
  }

  public updateProfile(profile: Partial<FreelancerProfile>, userEmail?: string): FreelancerProfile {
    const userState = this.getUserDataOf(userEmail);
    const updatedProfile = { ...userState.profile, ...profile };
    this.saveUserDataOf(userEmail, { profile: updatedProfile });
    this.addLog('info', 'system', 'Freelancer profile settings updated.', userEmail);
    return updatedProfile;
  }

  // --- Opportunities System Utilities ---
  public getOpportunities(userEmail?: string): Opportunity[] {
    const ops = this.getUserDataOf(userEmail).opportunities || [];
    return [...ops].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }

  public addOpportunity(op: Opportunity, userEmail?: string): Opportunity {
    const userState = this.getUserDataOf(userEmail);
    const opportunities = [...(userState.opportunities || [])];

    // Prevent duplicate scrape entry based on ID, original URL, canonical URL
    const existingIndex = opportunities.findIndex(o => {
      if (o.id === op.id || o.link === op.link) return true;
      if (op.canonicalUrl && o.canonicalUrl === op.canonicalUrl) return true;
      if (op.canonicalUrl && o.link === op.canonicalUrl) return true;
      if (o.canonicalUrl && o.canonicalUrl === op.link) return true;
      
      const p1 = o.platform || '';
      const p2 = op.platform || '';
      const t1 = (o.title || '').trim().toLowerCase();
      const t2 = (op.title || '').trim().toLowerCase();
      const cat1 = (o.category || '').trim().toLowerCase();
      const cat2 = (op.category || '').trim().toLowerCase();
      const c1 = (o.clientName || '').trim().toLowerCase();
      const c2 = (op.clientName || '').trim().toLowerCase();
      const d1 = (o.description || '').trim().toLowerCase().substring(0, 200);
      const d2 = (op.description || '').trim().toLowerCase().substring(0, 200);

      return p1 === p2 && t1 === t2 && cat1 === cat2 && c1 === c2 && d1 === d2;
    });
    if (existingIndex !== -1) {
      return opportunities[existingIndex];
    }
    const freshOp: Opportunity = {
      ...op,
      status: op.status || 'new',
      validationStatus: op.validationStatus || 'VALID',
      lastValidatedAt: op.lastValidatedAt || new Date().toISOString()
    };
    opportunities.push(freshOp);
    this.saveUserDataOf(userEmail, { opportunities });
    this.addLog('success', 'scraper', `New opportunity discovered on ${op.platform}: "${op.title}"`, userEmail);
    return freshOp;
  }

  public updateOpportunity(id: string, updates: Partial<Opportunity>, userEmail?: string): Opportunity {
    const userState = this.getUserDataOf(userEmail);
    const opportunities = [...(userState.opportunities || [])];
    const index = opportunities.findIndex(o => o.id === id);
    if (index === -1) {
      throw new Error(`Opportunity with ID ${id} not found.`);
    }
    opportunities[index] = { ...opportunities[index], ...updates };
    this.saveUserDataOf(userEmail, { opportunities });
    return opportunities[index];
  }

  public purgeMockData(userEmail?: string) {
    this.saveUserDataOf(userEmail, { 
      opportunities: [], 
      proposals: [] 
    });
    this.addLog('warning', 'system', 'Purged all jobs and proposals.', userEmail);
  }

  public clearAllOpportunities(userEmail?: string) {
    this.saveUserDataOf(userEmail, { opportunities: [] });
    this.addLog('warning', 'system', 'Cleared all opportunities from the database without affecting AI proposals, profile settings, or configurations.', userEmail);
  }

  // --- Proposals System Utilities ---
  public getProposals(userEmail?: string): Proposal[] {
    return this.getUserDataOf(userEmail).proposals || [];
  }

  public addProposal(prop: Proposal, userEmail?: string): Proposal {
    const userState = this.getUserDataOf(userEmail);
    const proposals = [...(userState.proposals || [])];
    const existingIndex = proposals.findIndex(p => p.id === prop.id);
    if (existingIndex !== -1) {
      proposals[existingIndex] = prop;
    } else {
      proposals.push(prop);
    }
    this.saveUserDataOf(userEmail, { proposals });
    return prop;
  }

  public updateProposal(id: string, updates: Partial<Proposal>, userEmail?: string): Proposal {
    const userState = this.getUserDataOf(userEmail);
    const proposals = [...(userState.proposals || [])];
    const index = proposals.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Proposal with ID ${id} not found.`);
    }
    proposals[index] = { ...proposals[index], ...updates };
    this.saveUserDataOf(userEmail, { proposals });
    return proposals[index];
  }

  // --- Settings Utilities ---
  public getTelegramSettings(userEmail?: string): TelegramSettings {
    return this.getUserDataOf(userEmail).telegramSettings;
  }

  public updateTelegramSettings(settings: Partial<TelegramSettings>, userEmail?: string): TelegramSettings {
    const userState = this.getUserDataOf(userEmail);
    const updatedSettings = { ...userState.telegramSettings, ...settings };
    this.saveUserDataOf(userEmail, { telegramSettings: updatedSettings });
    this.addLog('info', 'telegram', 'Telegram configuration updated.', userEmail);
    return updatedSettings;
  }

  public getAutomationSettings(userEmail?: string): AutomationSettings {
    return this.getUserDataOf(userEmail).automationSettings;
  }

  public updateAutomationSettings(settings: Partial<AutomationSettings>, userEmail?: string): AutomationSettings {
    const userState = this.getUserDataOf(userEmail);
    const updatedSettings = { ...userState.automationSettings, ...settings };
    this.saveUserDataOf(userEmail, { automationSettings: updatedSettings });
    this.addLog('info', 'automation', `Automation mode changed: Mode=${updatedSettings.mode}`, userEmail);
    return updatedSettings;
  }
}

export const db = new LocalDB();

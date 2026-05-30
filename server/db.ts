/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
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

interface Schema {
  users: Array<{ id: string; email: string; name: string; passwordHash: string; createdAt: string }>;
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
    { platform: 'Mostaql', status: 'DISCONNECTED' },
    { platform: 'Fiverr', status: 'DISCONNECTED' }
  ]
};

class LocalDB {
  private data: Schema;

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
      // Merge defaults to support back-compat if schema grows
      const merged = {
        users: loaded.users || [],
        profile: { ...DEFAULT_PROFILE, ...loaded.profile },
        opportunities: loaded.opportunities || [],
        proposals: loaded.proposals || [],
        telegramSettings: { ...DEFAULT_TELEGRAM, ...loaded.telegramSettings },
        automationSettings: { ...DEFAULT_AUTOMATION, ...loaded.automationSettings },
        logs: loaded.logs || [],
        accounts: loaded.accounts || [
          { platform: 'Khamsat', status: 'DISCONNECTED' },
          { platform: 'Mostaql', status: 'DISCONNECTED' },
          { platform: 'Fiverr', status: 'DISCONNECTED' }
        ]
      };
      
      const model = merged.automationSettings.geminiModel;
      const deprecated = ['gemini-1.5-flash', 'gemini-pro', 'gemini-2.0-flash'];
      const deprecatedPro = ['gemini-1.5-pro', 'gemini-2.0-pro'];
      if (deprecated.includes(model)) {
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
      console.error('Failed to save to local database file:', e);
    }
  }

  // --- Logs Utility ---
  public addLog(type: 'info' | 'success' | 'warning' | 'error', source: 'scraper' | 'gemini' | 'telegram' | 'automation' | 'system', message: string) {
    const freshData = this.load();
    const newLog: SystemLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      source,
      message,
      timestamp: new Date().toISOString()
    };
    freshData.logs.unshift(newLog);
    // Keep logs size reasonable (last 300)
    if (freshData.logs.length > 300) {
      freshData.logs = freshData.logs.slice(0, 300);
    }
    this.save(freshData);
    return newLog;
  }

  public getLogs(): SystemLog[] {
    return this.load().logs;
  }

  public clearLogs() {
    const data = this.load();
    data.logs = [];
    this.save(data);
  }

  // --- Account Connection Utilities ---
  public getAccounts(): ConnectedAccount[] {
    const data = this.load();
    return data.accounts || [
      { platform: 'Khamsat', status: 'DISCONNECTED' },
      { platform: 'Mostaql', status: 'DISCONNECTED' },
      { platform: 'Fiverr', status: 'DISCONNECTED' }
    ];
  }

  public getAccount(platform: 'Khamsat' | 'Mostaql' | 'Fiverr'): ConnectedAccount {
    const accounts = this.getAccounts();
    const existing = accounts.find(a => a.platform === platform);
    if (existing) return existing;
    return { platform, status: 'DISCONNECTED' };
  }

  public updateAccount(platform: 'Khamsat' | 'Mostaql' | 'Fiverr', updates: Partial<ConnectedAccount>): ConnectedAccount {
    const data = this.load();
    if (!data.accounts) {
      data.accounts = [
        { platform: 'Khamsat', status: 'DISCONNECTED' },
        { platform: 'Mostaql', status: 'DISCONNECTED' },
        { platform: 'Fiverr', status: 'DISCONNECTED' }
      ];
    }
    const idx = data.accounts.findIndex(a => a.platform === platform);
    if (idx !== -1) {
      data.accounts[idx] = { ...data.accounts[idx], ...updates };
    } else {
      data.accounts.push({
        platform,
        status: updates.status || 'DISCONNECTED',
        ...updates
      });
    }
    this.save(data);
    return this.getAccount(platform);
  }

  // --- Auth Utilities ---
  public getUsers() {
    return this.load().users;
  }

  public getSnapshot(): Schema {
    return this.load();
  }

  public registerUser(email: string, name: string, passwordHash: string, customId?: string) {
    const data = this.load();
    const emailLower = email.toLowerCase().trim();
    if (data.users.some(u => u.email === emailLower)) {
      throw new Error(`User with email ${email} already exists.`);
    }
    const user = {
      id: customId || `user-${Date.now()}`,
      email: emailLower,
      name,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    data.users.push(user);
    this.save(data);
    this.addLog('success', 'system', `New user registered: ${name} (${emailLower})`);
    return { id: user.id, email: user.email, name: user.name };
  }

  public getUserByEmail(email: string) {
    return this.load().users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());
  }

  public updateUserPasswordHash(email: string, passwordHash: string) {
    const data = this.load();
    const emailLower = email.toLowerCase().trim();
    const userIndex = data.users.findIndex(u => u.email.toLowerCase().trim() === emailLower);
    if (userIndex !== -1) {
      data.users[userIndex].passwordHash = passwordHash;
      this.save(data);
      return true;
    }
    return false;
  }

  // --- Freelancer Profile Utilities ---
  public getProfile(): FreelancerProfile {
    return this.load().profile;
  }

  public updateProfile(profile: Partial<FreelancerProfile>): FreelancerProfile {
    const data = this.load();
    data.profile = { ...data.profile, ...profile };
    this.save(data);
    this.addLog('info', 'system', 'Freelancer profile settings updated.');
    return data.profile;
  }

  // --- Opportunities System Utilities ---
  public getOpportunities(): Opportunity[] {
    // Sort so newest are first
    return [...this.load().opportunities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public addOpportunity(op: Omit<Opportunity, 'status'>): Opportunity {
    const data = this.load();
    // Prevent duplicate scrape entry
    const existingIndex = data.opportunities.findIndex(o => o.id === op.id || o.link === op.link);
    if (existingIndex !== -1) {
      // Return existing without overwrite, unless update requested
      return data.opportunities[existingIndex];
    }
    const freshOp: Opportunity = {
      ...op,
      status: 'new'
    };
    data.opportunities.push(freshOp);
    this.save(data);
    this.addLog('success', 'scraper', `New opportunity discovered on ${op.platform}: "${op.title}"`);
    return freshOp;
  }

  public updateOpportunity(id: string, updates: Partial<Opportunity>): Opportunity {
    const data = this.load();
    const index = data.opportunities.findIndex(o => o.id === id);
    if (index === -1) {
      throw new Error(`Opportunity with ID ${id} not found.`);
    }
    data.opportunities[index] = { ...data.opportunities[index], ...updates };
    this.save(data);
    return data.opportunities[index];
  }

  public purgeMockData() {
    const data = this.load();
    data.opportunities = [];
    data.proposals = [];
    this.save(data);
    this.addLog('warning', 'system', 'Purged all jobs and proposals.');
  }

  // --- Proposals System Utilities ---
  public getProposals(): Proposal[] {
    return this.load().proposals;
  }

  public addProposal(prop: Proposal): Proposal {
    const data = this.load();
    // Exists check
    const existingIndex = data.proposals.findIndex(p => p.id === prop.id);
    if (existingIndex !== -1) {
      data.proposals[existingIndex] = prop;
    } else {
      data.proposals.push(prop);
    }
    this.save(data);
    return prop;
  }

  public updateProposal(id: string, updates: Partial<Proposal>): Proposal {
    const data = this.load();
    const index = data.proposals.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Proposal with ID ${id} not found.`);
    }
    data.proposals[index] = { ...data.proposals[index], ...updates };
    this.save(data);
    return data.proposals[index];
  }

  // --- Settings Utilities ---
  public getTelegramSettings(): TelegramSettings {
    return this.load().telegramSettings;
  }

  public updateTelegramSettings(settings: Partial<TelegramSettings>): TelegramSettings {
    const data = this.load();
    data.telegramSettings = { ...data.telegramSettings, ...settings };
    this.save(data);
    this.addLog('info', 'telegram', 'Telegram configuration updated.');
    return data.telegramSettings;
  }

  public getAutomationSettings(): AutomationSettings {
    return this.load().automationSettings;
  }

  public updateAutomationSettings(settings: Partial<AutomationSettings>): AutomationSettings {
    const data = this.load();
    data.automationSettings = { ...data.automationSettings, ...settings };
    this.save(data);
    this.addLog('info', 'automation', `Automation mode changed: Mode=${data.automationSettings.mode}`);
    return data.automationSettings;
  }
}

export const db = new LocalDB();
